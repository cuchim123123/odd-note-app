const fs = require('fs');
const path = require('path');

const migrationsPath = path.join(__dirname, 'apps', 'api', 'prisma', 'migrations');

if (fs.existsSync(migrationsPath)) {
  console.log('Deleting corrupted migrations folder...');
  fs.rmSync(migrationsPath, { recursive: true, force: true });
  console.log('Deleted successfully.');
} else {
  console.log('Migrations folder already deleted.');
}
