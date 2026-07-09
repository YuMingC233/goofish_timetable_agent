import { describe, expect, it } from 'vitest';
import {
  getTargetOutputDir,
  toTargetManifest,
  type BuildTarget,
} from '../../src/build/target-manifest';

const baseManifest = {
  manifest_version: 3,
  background: {
    scripts: ['service-worker-loader.js'],
    service_worker: 'service-worker-loader.js',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['assets/index.js'],
    },
  ],
};

describe('target manifest helpers', () => {
  it.each<[BuildTarget, string]>([
    ['chrome', 'dist/chrome'],
    ['firefox', 'dist/firefox'],
  ])('uses a stable output directory for %s builds', (target, expected) => {
    expect(getTargetOutputDir(target)).toBe(expected);
  });

  it('keeps the service worker manifest for Chrome builds', () => {
    expect(toTargetManifest(baseManifest, 'chrome')).toEqual(baseManifest);
  });

  it('replaces the service worker background with background scripts for Firefox builds', () => {
    expect(toTargetManifest(baseManifest, 'firefox')).toEqual({
      manifest_version: 3,
      background: {
        scripts: ['service-worker-loader.js'],
        type: 'module',
      },
      content_scripts: [
        {
          matches: ['<all_urls>'],
          js: ['assets/index.js'],
        },
      ],
    });
  });
});
