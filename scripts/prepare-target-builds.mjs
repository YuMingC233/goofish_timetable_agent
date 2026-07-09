import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(here, '..');
const stageDir = resolve(rootDir, '.dist-base');
const targetsRootDir = resolve(rootDir, 'dist');

function getTargetOutputDir(target) {
  return resolve(targetsRootDir, target);
}

function toTargetManifest(manifest, target) {
  if (target === 'chrome') {
    return manifest;
  }

  const serviceWorker = manifest?.background?.service_worker;
  if (!serviceWorker) {
    return manifest;
  }

  return {
    ...manifest,
    background: {
      scripts: [serviceWorker],
      ...(manifest.background?.type ? { type: manifest.background.type } : {}),
    },
  };
}

async function writeTarget(target) {
  const outDir = getTargetOutputDir(target);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(stageDir, outDir, { recursive: true, force: true });

  const manifestPath = resolve(outDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const targetManifest = toTargetManifest(manifest, target);
  await writeFile(manifestPath, `${JSON.stringify(targetManifest, null, 2)}\n`, 'utf8');
}

async function main() {
  const mode = process.argv[2] ?? 'all';
  const targets = mode === 'all' ? ['chrome', 'firefox'] : [mode];

  await rm(targetsRootDir, { recursive: true, force: true });
  await mkdir(targetsRootDir, { recursive: true });

  for (const target of targets) {
    if (!['chrome', 'firefox'].includes(target)) {
      throw new Error(`Unsupported build target: ${target}`);
    }
    await writeTarget(target);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
