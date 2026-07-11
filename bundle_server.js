import esbuild from 'esbuild';
import fs from 'fs';

const importMetaUrlPlugin = {
  name: 'import-meta-url',
  setup(build) {
    build.onLoad({ filter: /\.ts$/ }, async (args) => {
      let contents = await fs.promises.readFile(args.path, 'utf8');
      contents = contents.replace(/import\.meta\.url/g, "require('url').pathToFileURL(__filename).href");
      return { contents, loader: 'ts' };
    });
  }
};

esbuild.build({
  entryPoints: ['server/src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: 'server/index.cjs',
  format: 'cjs',
  external: ['pg', 'express', 'cors', 'bcryptjs', 'jsonwebtoken', 'multer'],
  plugins: [importMetaUrlPlugin]
}).then(() => {
  console.log('Server API bundled successfully!');
  fs.copyFileSync('server/src/db/schema.sql', 'server/schema.sql');
  console.log('schema.sql copied to server/schema.sql successfully!');
  fs.copyFileSync('server/index.cjs', 'server/server.js');
  console.log('server/server.js copied successfully!');

  // Find compiled client JS and CSS files dynamically
  const clientAssetsDir = 'dist/client/assets';
  let clientJsFile = '';
  let clientCssFile = '';
  if (fs.existsSync(clientAssetsDir)) {
    const files = fs.readdirSync(clientAssetsDir);
    const jsFiles = files.filter(f => f.startsWith('index-') && f.endsWith('.js'));
    // Sort by file size descending to pick the main bundle (largest index-*.js file)
    jsFiles.sort((a, b) => {
      const sizeA = fs.statSync(clientAssetsDir + '/' + a).size;
      const sizeB = fs.statSync(clientAssetsDir + '/' + b).size;
      return sizeB - sizeA;
    });
    const jsFile = jsFiles[0];
    const cssFile = files.find(f => f.startsWith('styles-') && f.endsWith('.css'));
    if (jsFile) clientJsFile = `/assets/${jsFile}`;
    if (cssFile) clientCssFile = `/assets/${cssFile}`;
  }
  console.log(`Found production client JS: ${clientJsFile}`);
  console.log(`Found production client CSS: ${clientCssFile}`);

  // Clean dev main.tsx script tags and inject production assets
  const cleanupFile = (filePath) => {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('/src/main.tsx')) {
        let replacement = '';
        if (clientJsFile) {
          replacement += `<script type="module" src="${clientJsFile}"></script>`;
        }
        content = content.replace(/<script type="module" src="\/src\/main\.tsx"\s*><\\?\/script>/gi, replacement);
        
        // Also inject the CSS link in head if it exists and is not already present
        if (clientCssFile && !content.includes(clientCssFile)) {
          const cssLink = `<link rel="stylesheet" href="${clientCssFile}">`;
          content = content.replace('</head>', `${cssLink}</head>`);
        }

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Successfully patched production entry scripts and styles in ${filePath}!`);
      }
    } catch (e) {
      console.error(`Failed to cleanup ${filePath}:`, e.message);
    }
  };

  const walkDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = `${dir}/${file}`;
      if (fs.statSync(fullPath).isDirectory()) {
        walkDir(fullPath);
      } else if (file.endsWith('.mjs') || file.endsWith('.js')) {
        cleanupFile(fullPath);
      }
    }
  };
  
  console.log('Running post-build template script tag cleanup and asset injection...');
  walkDir('dist/server');

  // Copy _shell.html to index.html for static SPA loading in Electron
  const clientDir = 'dist/client';
  const shellPath = `${clientDir}/_shell.html`;
  const indexPath = `${clientDir}/index.html`;
  if (fs.existsSync(shellPath)) {
    let content = fs.readFileSync(shellPath, 'utf8');
    
    // Safety check/replacement: rewrite absolute paths to relative paths to support file:// protocol
    content = content.replace(/\/(\.)?\/assets\//gi, 'assets/');
    content = content.replace(/href="\/manifest\.webmanifest"/gi, 'href="manifest.webmanifest"');
    content = content.replace(/href="\/icons\//gi, 'href="icons/');
    content = content.replace(/href="\/favicon\.ico"/gi, 'href="favicon.ico"');
    
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log(`Successfully generated static entry file with relative paths: ${indexPath}`);
  } else {
    console.warn(`Warning: SPA shell file not found at ${shellPath}`);
  }
}).catch((err) => {
  console.error('Bundling failed:', err);
  process.exit(1);
});
