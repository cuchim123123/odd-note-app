const { execSync } = require('child_process');

try {
  const commit = {
    files: 'docker-compose.yml apps/web/Dockerfile README.md',
    msg: 'chore: add frontend dockerfile and update compose configuration'
  };

  console.log(`Adding ${commit.files}...`);
  execSync(`git add ${commit.files}`, { stdio: 'pipe' });
  console.log(`Committing: ${commit.msg}...`);
  execSync(`git commit -m "${commit.msg}"`, { 
    stdio: 'pipe',
    env: { ...process.env, CI: 'true', FORCE_COLOR: '0', TERM: 'dumb' }
  });
  console.log('Success!');
} catch (error) {
  console.error('Error occurred:');
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
}
