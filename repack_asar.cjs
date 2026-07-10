const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const asarPath = path.join(rootDir, 'dist-electron', 'win-unpacked', 'resources', 'app.asar');
const unpackDir = path.join(rootDir, 'dist-electron', 'app-unpacked-tmp');

async function repack() {
  try {
    if (!fs.existsSync(asarPath)) {
      console.error(`app.asar not found at ${asarPath}`);
      return;
    }

    console.log('1. Unpacking existing app.asar...');
    if (fs.existsSync(unpackDir)) {
      fs.rmSync(unpackDir, { recursive: true, force: true });
    }
    
    // Unpack using npx asar
    execSync(`npx asar extract "${asarPath}" "${unpackDir}"`, { stdio: 'inherit' });
    console.log('Unpacked successfully.');

    console.log('2. Overwriting client and server files...');
    
    // Copy built client assets (Vite output) into unpacked/dist/client
    const clientDest = path.join(unpackDir, 'dist', 'client');
    const clientSrc = path.join(rootDir, 'dist', 'client');
    if (fs.existsSync(clientSrc)) {
      console.log('Copying client files...');
      fs.cpSync(clientSrc, clientDest, { recursive: true, force: true });
    }

    // Copy built server assets
    const serverDest = path.join(unpackDir, 'dist', 'server');
    const serverSrc = path.join(rootDir, 'dist', 'server');
    if (fs.existsSync(serverSrc)) {
      console.log('Copying server files...');
      fs.cpSync(serverSrc, serverDest, { recursive: true, force: true });
    }
    
    // Also copy package.json if needed
    fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(unpackDir, 'package.json'));

    console.log('3. Packing back into app.asar...');
    
    // Backup old app.asar
    fs.renameSync(asarPath, asarPath + '.bak');
    
    // Pack back using npx asar
    execSync(`npx asar pack "${unpackDir}" "${asarPath}"`, { stdio: 'inherit' });
    console.log('Packed successfully!');

    // Cleanup temp unpack dir
    fs.rmSync(unpackDir, { recursive: true, force: true });
    console.log('Cleaned up temporary folders. In-place update complete! 🎉');
  } catch (err) {
    console.error('Repack failed:', err);
    // Restore backup if exists and target doesn't
    if (fs.existsSync(asarPath + '.bak') && !fs.existsSync(asarPath)) {
      fs.renameSync(asarPath + '.bak', asarPath);
    }
  }
}

repack();
