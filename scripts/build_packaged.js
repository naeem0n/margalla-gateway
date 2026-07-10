import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const distElectron = path.join(rootDir, 'dist-electron');
const tmpDir = path.join(distElectron, 'win-unpacked.tmp');
const targetDir = path.join(distElectron, 'win-unpacked');

console.log('=== starting production build script ===');

// 1. Run standard vite build and server bundle
console.log('1. Building frontend & server...');
execSync('npm run build', { stdio: 'inherit', cwd: rootDir });

// Clean previous dist-electron directory if it exists
if (fs.existsSync(distElectron)) {
  console.log('2. Cleaning previous dist-electron folder...');
  try {
    fs.rmSync(distElectron, { recursive: true, force: true });
    console.log('dist-electron cleaned successfully.');
  } catch (err) {
    console.warn(`Warning: Could not fully clean dist-electron (${err.code}). Proceeding anyway — electron-builder will overwrite files.`);
  }
}

// 2. Package electron app into directory first
console.log('3. Running electron-builder to generate directory (--dir)...');
try {
  execSync('npx electron-builder --dir --win', { stdio: 'inherit', cwd: rootDir });
} catch (err) {
  console.log('Note: electron-builder finished (may have hit rename/EPERM lock). Checking directories...');
}

// 3. Handle EPERM rename if win-unpacked.tmp exists but win-unpacked does not
if (fs.existsSync(tmpDir) && !fs.existsSync(targetDir)) {
  console.log('Detected unrenamed win-unpacked.tmp. Attempting delay-and-rename or copy fallback loop...');
  let renamed = false;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      console.log(`Attempt ${attempt}: Renaming ${tmpDir} -> ${targetDir}...`);
      fs.renameSync(tmpDir, targetDir);
      console.log('✅ Successfully renamed win-unpacked.tmp to win-unpacked!');
      renamed = true;
      break;
    } catch (e) {
      console.log(`Rename failed: ${e.message}. Trying copy fallback...`);
      try {
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
        fs.mkdirSync(targetDir, { recursive: true });
        fs.cpSync(tmpDir, targetDir, { recursive: true });
        console.log('✅ Successfully copied win-unpacked.tmp to win-unpacked!');
        renamed = true;
        break;
      } catch (cpErr) {
        console.log(`Copy failed: ${cpErr.message}. Retrying in 2 seconds...`);
        const end = Date.now() + 2000;
        while (Date.now() < end) {}
      }
    }
  }
  if (!renamed) {
    console.error('❌ Failed to rename or copy win-unpacked.tmp after 10 attempts. Exiting.');
    process.exit(1);
  }
}

// 4. Compile the prepackaged directory into NSIS Installer
console.log('4. Compiling prepackaged directory into NSIS installer...');
execSync('npx electron-builder --win nsis --prepackaged dist-electron/win-unpacked', { stdio: 'inherit', cwd: rootDir });

console.log('🎉 BUILD COMPLETED SUCCESSFULLY!');
