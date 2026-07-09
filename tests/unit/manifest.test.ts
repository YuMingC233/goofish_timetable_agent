import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.json';

describe('extension manifest', () => {
  it('allows content script injection on any page for development debugging', () => {
    expect(manifest.content_scripts).toHaveLength(1);
    expect(manifest.content_scripts[0]?.matches).toEqual(['<all_urls>']);
  });

  it('declares a document background fallback for Firefox MV3 debugging', () => {
    expect(manifest.background).toMatchObject({
      scripts: ['src/background/index.ts'],
      service_worker: 'src/background/index.ts',
      type: 'module',
    });
  });
});
