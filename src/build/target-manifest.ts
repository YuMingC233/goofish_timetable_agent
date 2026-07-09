export type BuildTarget = 'chrome' | 'firefox';

export type ExtensionManifest = {
  manifest_version: number;
  background?: {
    service_worker?: string;
    scripts?: string[];
    type?: string;
  };
  [key: string]: unknown;
};

export function getTargetOutputDir(target: BuildTarget): string {
  return `dist/${target}`;
}

export function toTargetManifest<T extends ExtensionManifest>(
  manifest: T,
  target: BuildTarget,
): T {
  if (target === 'chrome') {
    return manifest;
  }

  const serviceWorker = manifest.background?.service_worker;
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
