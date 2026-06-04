import { describe, it } from 'vitest';

describe('Goofish Timetable Agent — E2E Flow', () => {
  it('full flow: scrape → extract → review → export to Notion', () => {
    // P1: Automated E2E test with Puppeteer/Playwright loading the extension
    // For P0, this flow is tested manually:
    //
    // 1. Load extension unpacked from dist/ in Chrome
    // 2. Navigate to https://seller.goofish.com and open a chat
    // 3. Click the floating ball 🎣
    // 4. Verify popup panel shows AI-extracted task data
    // 5. Click "Export to Notion" → verify entry appears in Notion database
  });
});
