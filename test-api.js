const { execSync } = require('child_process');
try {
    const res = execSync('curl -i http://localhost:4000/api/health').toString();
    console.log(res);
} catch (e) {
    console.error(e.message);
    if (e.stdout) console.error(e.stdout.toString());
}
