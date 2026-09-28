/**
 * test_backend_team_auth.cjs
 * 
 * Invokes the real-route backend test suite in test_backend_team_auth.ts,
 * which imports and mounts the real Express teamRouter from server/routes/team.routes.ts.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const tsPath = path.resolve(__dirname, 'test_backend_team_auth.ts');
const result = spawnSync('npx', ['tsx', tsPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085'
  }
});

process.exit(result.status !== null ? result.status : 1);
