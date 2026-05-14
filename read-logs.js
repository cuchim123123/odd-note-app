const { execSync } = require('child_process');
try {
    const logs = execSync('docker logs --tail 100 odd-note-app-api-1').toString();
    console.log(logs);
} catch (e) {
    console.error(e.message);
    if (e.stderr) console.error(e.stderr.toString());
}
