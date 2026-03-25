import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const clean = process.argv.includes('--clean');

function defaultPlaywrightCacheDir() {
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Caches', 'ms-playwright');
  }
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    if (local) return join(local, 'ms-playwright');
  }
  return join(homedir(), '.cache', 'ms-playwright');
}

if (clean) {
  const dir = defaultPlaywrightCacheDir();
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    console.log('[setup-e2e] Eliminada caché de navegadores:', dir);
  }
}

const env = { ...process.env };
delete env.PLAYWRIGHT_BROWSERS_PATH;

const args = ['playwright', 'install', 'chromium'];
if (clean) args.push('--force');

const r = spawnSync('npx', args, { stdio: 'inherit', env, shell: true });
process.exit(r.status === null ? 1 : r.status);
