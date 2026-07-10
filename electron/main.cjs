const { app, BrowserWindow, shell, globalShortcut, dialog, utilityProcess } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const net = require("net");

const isDev = !app.isPackaged || process.env.IS_DEV === "true";
const PORT = 3847;
let serverProcess = null;

// Increment this version to force a fresh database reset on next app launch.
// Users' AppData database will be replaced with the clean seed database.
const DB_RESET_VERSION = "v2.5-production-reset";

function killProcessOnPort(port) {
  try {
    const cmd = process.platform === "win32"
      ? `netstat -ano | findstr :${port}`
      : `lsof -t -i:${port}`;
    const output = execSync(cmd).toString().trim();
    if (output) {
      const lines = output.split("\n");
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 0) {
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid) && pid !== "0") {
            pids.add(pid);
          }
        }
      }
      for (const pid of pids) {
        console.log(`Killing process ${pid} occupying port ${port}...`);
        if (process.platform === "win32") {
          execSync(`taskkill /F /PID ${pid}`);
        } else {
          execSync(`kill -9 ${pid}`);
        }
      }
    }
  } catch (err) {
    // Port is likely free
  }
}
let nitroProcess = null;
let mainWindow = null;
let logStream = null;

function getDbPath() {
  if (isDev) {
    return path.join(__dirname, "..", "margalla.db");
  }
  // Use app name 'margalla-gateway' folder (actual Electron userData)
  return path.join(app.getPath("userData"), "data", "margalla.db");
}

// Returns true if the stored DB version doesn't match the current reset version.
// This triggers a fresh database copy from the seed.
function shouldResetDatabase(dbPath) {
  try {
    const versionFile = path.join(path.dirname(dbPath), "db_version.txt");
    if (!fs.existsSync(versionFile)) return true;
    const stored = fs.readFileSync(versionFile, "utf8").trim();
    return stored !== DB_RESET_VERSION;
  } catch (e) {
    return true;
  }
}

function markDatabaseVersion(dbPath) {
  try {
    const versionFile = path.join(path.dirname(dbPath), "db_version.txt");
    fs.writeFileSync(versionFile, DB_RESET_VERSION, "utf8");
  } catch (e) {}
}

function verifyAppIntegrity() {
  if (app.isPackaged) {
    const asarPath = path.join(process.resourcesPath, 'app.asar');
    const appFolder = path.join(process.resourcesPath, 'app');
    if (!fs.existsSync(asarPath) && !fs.existsSync(appFolder)) {
      console.error("Security Alert: App integrity compromised! Missing core bundle.");
      app.quit();
      return false;
    }
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
  }
  return true;
}

function findServerExe() {
  const paths = [
    path.join(__dirname, "..", "server.exe"),
    path.join(process.resourcesPath, "server", "server.exe"),
    path.join(path.dirname(process.execPath), "server.exe"),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

function startServer() {
  killProcessOnPort(PORT);
  const env = {
    ...process.env,
    PORT: String(PORT),
    DB_MODE: "sqlite",
    SQLITE_PATH: getDbPath(),
    IS_DESKTOP: "true",
    SYNC_CLOUD_URL: process.env.SYNC_CLOUD_URL || "",
    SYNC_API_KEY: process.env.SYNC_API_KEY || "",
  };

  if (!logStream) {
    const logPath = path.join(path.dirname(getDbPath()), "server.log");
    logStream = fs.createWriteStream(logPath, { flags: "a" });
  }
  logStream.write(`\n--- SERVER START AT ${new Date().toISOString()} ---\n`);

  const serverExe = findServerExe();
  if (serverExe) {
    console.log("Spawning server.exe from:", serverExe);
    serverProcess = spawn(serverExe, [], {
      detached: false,
      stdio: ["ignore", logStream, logStream],
      env,
    });
  } else {
    if (isDev) {
      const serverEntry = path.join(__dirname, "..", "server", "src", "index.ts");
      serverProcess = spawn("npx", ["tsx", serverEntry], {
        env,
        cwd: path.join(__dirname, ".."),
        shell: true,
        stdio: "inherit",
      });
    } else {
      const serverEntry = path.join(process.resourcesPath, "server", "index.cjs");
      const serverCwd = path.join(process.resourcesPath, "server");
      
      const spawnNodeFallback = () => {
        console.log("Spawning server fallback via node:", serverEntry);
        const proc = spawn("node", ["index.cjs"], {
          detached: false,
          stdio: ["ignore", "pipe", "pipe"],
          cwd: serverCwd,
          env,
        });
        
        proc.stdout.on("data", (data) => {
          console.log("Backend Output:", data.toString());
          logStream.write(data);
        });
        
        proc.stderr.on("data", (data) => {
          console.error("Backend Error:", data.toString());
          logStream.write(data);
        });
        
        proc.on("error", (err) => {
          console.error("Backend process error during fallback:", err);
          logStream.write(`Backend process error during fallback: ${err.message}\n`);
        });
        
        return proc;
      };

      console.log("Spawning server via utilityProcess:", serverEntry);
      try {
        const utilProc = utilityProcess.fork(serverEntry, [], {
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });
        
        utilProc.stdout.on("data", (data) => {
          console.log("Backend Output:", data.toString());
          logStream.write(data);
        });
        
        utilProc.stderr.on("data", (data) => {
          console.error("Backend Error:", data.toString());
          logStream.write(data);
        });
        
        serverProcess = utilProc;
      } catch (err) {
        console.error("utilityProcess fork failed, trying global node spawn fallback:", err);
        logStream.write(`utilityProcess fork failed: ${err.message}. Falling back to node...\n`);
        serverProcess = spawnNodeFallback();
      }
    }
  }

  if (serverProcess) {
    serverProcess.on("error", (err) => {
      console.error("Express API Server failed:", err);
      logStream.write(`Express API Server error event: ${err.message}\n`);
    });
  }

  // Nitro SSR Server disabled for pure client-side SPA
}

function checkPortReady(port, callback) {
  const socket = new net.Socket();
  const onError = () => {
    socket.destroy();
    callback(false);
  };

  socket.setTimeout(150);
  socket.once("connect", () => {
    socket.destroy();
    callback(true);
  });
  socket.once("error", onError);
  socket.once("timeout", onError);
  socket.connect(port, "127.0.0.1");
}

function loadPageWhenReady(win, url, port) {
  const check = () => {
    checkPortReady(port, (ready) => {
      if (ready) {
        console.log(`Port ${port} is ready! Loading page: ${url}`);
        win.loadURL(url);
      } else {
        console.log(`Waiting for port ${port} to bind...`);
        setTimeout(check, 100);
      }
    });
  };
  check();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false, // Start hidden to prevent white-flash blink on load
    backgroundColor: '#030712', // Dark slate to match app theme
    title: "Margalla Gateway — Rental Management",
    icon: path.join(__dirname, "..", "public", "icons", "icon-512.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allow loading remote Google Fonts and assets under file://
    },
  });

  if (isDev) {
    const port = 8080;
    const url = "http://localhost:8080/#/welcome";
    loadPageWhenReady(mainWindow, url, port);
  } else {
    const indexPath = path.join(__dirname, "..", "dist", "client", "index.html");
    console.log("Loading static SPA entry point from:", indexPath);
    mainWindow.loadFile(indexPath, { hash: "/welcome" });
  }

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Forward browser console logs to main process file stream
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const logMsg = `[Renderer Console] ${message} (Source: ${sourceId}:${line})\n`;
    console.log(logMsg.trim());
    if (logStream) {
      logStream.write(logMsg);
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    const errorMsg = `[Load Error] Page failed to load: ${validatedURL} (error ${errorCode}: ${errorDescription})\n`;
    console.error(errorMsg.trim());
    if (logStream) {
      logStream.write(errorMsg);
    }
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // Show window immediately when it's ready to render, eliminating delay
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      return { action: "allow" };
    }
    // Only open actual external website links in default OS browser
    if (url.startsWith("http:") || url.startsWith("https:")) {
      if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
        return { action: "allow" };
      }
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
}

async function waitForServer() {
  const ports = [PORT, 5000];
  const paths = ["/health", "/api/health"];

  for (let i = 0; i < 30; i++) {
    for (const port of ports) {
      for (const p of paths) {
        try {
          const res = await fetch(`http://127.0.0.1:${port}${p}`);
          if (res.ok) return true;
        } catch {}
        try {
          const res = await fetch(`http://localhost:${port}${p}`);
          if (res.ok) return true;
        } catch {}
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

app.whenReady().then(async () => {
  if (!verifyAppIntegrity()) return;
  
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  // Initialize logStream early to catch seed database logging
  const logPath = path.join(path.dirname(dbPath), "server.log");
  logStream = fs.createWriteStream(logPath, { flags: "a" });
  logStream.write(`\n--- APP START AT ${new Date().toISOString()} ---\n`);

  // In production: copy seed database if it doesn't exist OR if reset version changed.
  // Incrementing DB_RESET_VERSION forces a clean database on next launch.
  if (!isDev) {
    const seedDbPath = path.join(process.resourcesPath, "server", "margalla.db");
    const needsReset = !fs.existsSync(dbPath) || shouldResetDatabase(dbPath);
    logStream.write(`DB reset check: needsReset=${needsReset}, version=${DB_RESET_VERSION}\n`);

    if (needsReset && fs.existsSync(seedDbPath)) {
      try {
        // Backup existing database before overwriting
        if (fs.existsSync(dbPath)) {
          const backupPath = dbPath + ".backup_" + Date.now();
          fs.copyFileSync(dbPath, backupPath);
          logStream.write(`Old database backed up to: ${backupPath}\n`);
        }
        fs.copyFileSync(seedDbPath, dbPath);
        
        // CRITICAL: Delete WAL and SHM files so SQLite doesn't recover old data into the new seed DB
        try { if (fs.existsSync(dbPath + "-wal")) fs.unlinkSync(dbPath + "-wal"); } catch (e) {}
        try { if (fs.existsSync(dbPath + "-shm")) fs.unlinkSync(dbPath + "-shm"); } catch (e) {}
        
        markDatabaseVersion(dbPath);
        const seedMsg = `Clean seed database deployed to: ${dbPath} (version: ${DB_RESET_VERSION})\n`;
        console.log(seedMsg.trim());
        logStream.write(seedMsg);
      } catch (err) {
        const errMsg = `Failed to deploy seed database: ${err.message}\n`;
        console.error(errMsg.trim());
        logStream.write(errMsg);
      }
    } else if (!needsReset) {
      logStream.write(`Database is current (version: ${DB_RESET_VERSION}). No reset needed.\n`);
    } else {
      logStream.write(`Seed database not found at: ${seedDbPath}\n`);
    }
  }

  startServer();

  const ready = await waitForServer();

  if (!ready) {
    dialog.showErrorBox(
      "Server Error",
      "Local API failed to start."
    );
    app.quit();
    return;
  }

  createWindow();

  // Ctrl + Alt + A shortcut register
  globalShortcut.register("CommandOrControl+Alt+A", () => {
    console.log("Global Shortcut CommandOrControl+Alt+A Pressed - Focus & Navigate");
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("navigate", "/thirdparty");
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (nitroProcess) nitroProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) serverProcess.kill();
  if (nitroProcess) nitroProcess.kill();
});
