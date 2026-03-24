import { execSync } from 'node:child_process';

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function getDiffBase() {
  try {
    const upstream = run('git rev-parse --abbrev-ref --symbolic-full-name @{u}');
    if (upstream) return upstream;
  } catch {
    // Fallback when no upstream exists.
  }
  return 'origin/main';
}

function getChangedFiles(baseRef) {
  try {
    const output = run(`git diff --name-only ${baseRef}...HEAD`);
    return output ? output.split('\n').map((file) => file.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function isBusinessLogicFile(file) {
  return (
    file.startsWith('src/') ||
    file.startsWith('services/') ||
    file === 'docker-compose.yml'
  );
}

function isTestFile(file) {
  return (
    file.includes('/__tests__/') ||
    file.endsWith('.test.ts') ||
    file.endsWith('.test.tsx') ||
    file.endsWith('.test.js') ||
    file.endsWith('.spec.ts') ||
    file.endsWith('.spec.tsx') ||
    file.endsWith('.spec.js')
  );
}

const baseRef = getDiffBase();
const files = getChangedFiles(baseRef);

if (files.length === 0) {
  console.log('[guard] Sin cambios contra base, no se exige test adicional.');
  process.exit(0);
}

const logicChanges = files.filter(isBusinessLogicFile);
if (logicChanges.length === 0) {
  console.log('[guard] Sin cambios de lógica de negocio detectados.');
  process.exit(0);
}

const testChanges = files.filter(isTestFile);
if (testChanges.length > 0) {
  console.log(`[guard] OK: cambios de lógica (${logicChanges.length}) con tests actualizados (${testChanges.length}).`);
  process.exit(0);
}

console.error('[guard] Se detectaron cambios de lógica de negocio sin tests nuevos/actualizados.');
console.error('[guard] Agregá al menos un archivo *.test.* o *.spec.* en este push.');
console.error('[guard] Si es una emergencia, podés forzar con: git push --no-verify');
process.exit(1);
