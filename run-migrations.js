const { execSync } = require('child_process');
try {
    console.log('Running prisma migrate deploy...');
    const out = execSync('docker compose exec api npx prisma migrate deploy').toString();
    console.log(out);
} catch (e) {
    console.error('Migration failed:');
    if (e.stdout) console.error(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
}
