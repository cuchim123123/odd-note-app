const { execSync } = require('child_process');

try {
  console.log('Running eslint on web...');
  const webOutput = execSync('npx eslint src --ext .ts,.tsx', { cwd: 'd:/odd-todo-app/odd-note-app/apps/web', stdio: 'pipe' }).toString();
  console.log('Web lint passed!');
} catch (e) {
  console.error('Web lint failed:\n', e.stdout ? e.stdout.toString() : e.message);
}

try {
  console.log('\nRunning eslint on api...');
  const apiOutput = execSync('npx eslint src --ext .ts', { cwd: 'd:/odd-todo-app/odd-note-app/apps/api', stdio: 'pipe' }).toString();
  console.log('Api lint passed!');
} catch (e) {
  console.error('Api lint failed:\n', e.stdout ? e.stdout.toString() : e.message);
}
