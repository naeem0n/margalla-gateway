const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\Admin\\AppData\\Roaming\\margalla-gateway\\data\\server.log';

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  console.log(`=== LAST 150 LINES OF SERVER.LOG (${lines.length} lines total) ===`);
  console.log(lines.slice(-150).join('\n'));
} else {
  console.log(`Log file not found at ${logPath}`);
}
