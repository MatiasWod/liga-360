import fs from 'node:fs/promises';
import path from 'node:path';

async function ensureHookInstalled() {
  const repoRoot = process.cwd();
  const gitDir = path.join(repoRoot, '.git');
  const sourceHook = path.join(repoRoot, '.githooks', 'pre-push');
  const targetHook = path.join(repoRoot, '.git', 'hooks', 'pre-push');

  try {
    await fs.access(gitDir);
  } catch {
    console.log('[hooks] No se detecto .git, se omite instalacion de hooks.');
    return;
  }

  await fs.mkdir(path.dirname(targetHook), { recursive: true });
  const hookContent = await fs.readFile(sourceHook, 'utf8');
  await fs.writeFile(targetHook, hookContent, { mode: 0o755 });
  await fs.chmod(targetHook, 0o755);
  console.log('[hooks] pre-push instalado en .git/hooks/pre-push');
}

ensureHookInstalled().catch((error) => {
  console.error('[hooks] No se pudo instalar pre-push:', error);
  process.exitCode = 1;
});
