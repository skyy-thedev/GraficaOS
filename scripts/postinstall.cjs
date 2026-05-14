const { existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const rootDir = __dirname ? join(__dirname, '..') : process.cwd();
const apiDir = join(rootDir, 'apps', 'api');
const schemaPath = join(apiDir, 'prisma', 'schema.prisma');

if (!existsSync(apiDir) || !existsSync(schemaPath)) {
  console.log('[postinstall] Prisma schema not found; skipping Prisma Client generation.');
  process.exit(0);
}

let prismaCliPath;

try {
  prismaCliPath = require.resolve('prisma/build/index.js', { paths: [apiDir] });
} catch (error) {
  console.log('[postinstall] Prisma CLI not available yet; skipping Prisma Client generation.');
  process.exit(0);
}

const result = spawnSync(process.execPath, [prismaCliPath, 'generate', '--schema', schemaPath], {
  cwd: apiDir,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error('[postinstall] Failed to run Prisma generate:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
