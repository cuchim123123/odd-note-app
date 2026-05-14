const { execSync } = require('child_process');
const fs = require('fs');

try {
  const logs = execSync('docker compose logs api').toString();
  fs.writeFileSync('api-logs.txt', logs);
} catch (e) {
  fs.writeFileSync('api-logs.txt', (e.stdout || e.message).toString());
}
