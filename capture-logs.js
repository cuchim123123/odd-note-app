const { execSync } = require('child_process');
const fs = require('fs');

try {
  const logs = execSync('docker compose logs api --tail 200 2>&1', { maxBuffer: 1024 * 1024 }).toString();
  fs.writeFileSync('d:\\odd-todo-app\\odd-note-app\\api-logs.txt', logs, 'utf8');
  console.log('Logs written to api-logs.txt (' + logs.length + ' chars)');
} catch (e) {
  const out = (e.stdout ? e.stdout.toString() : '') + '\n' + (e.stderr ? e.stderr.toString() : '') + '\n' + e.message;
  fs.writeFileSync('d:\\odd-todo-app\\odd-note-app\\api-logs.txt', out, 'utf8');
  console.log('Error logs written to api-logs.txt');
}
