import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotionPage } from '../../src/background/notion-client';
import type { ScheduledTask } from '../../src/shared/types';

// Mock chrome.storage.local
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn((keys: string | string[] | null) => {
        const key = Array.isArray(keys) ? keys[0] : keys;
        if (key === 'goofish_settings') {
          return Promise.resolve({
            goofish_settings: {
              notionToken: 'ntn-test-token',
              notionDatabaseId: 'db-test-123',
            },
          });
        }
        return Promise.resolve({});
      }),
    },
  },
});

const makeTask = (overrides: Partial<ScheduledTask> = {}): ScheduledTask => ({
  id: 'task-1',
  buyerName: '张三',
  requirement: 'Logo design',
  urgency: 'high',
  urgencyReason: 'Friday deadline',
  price: 350,
  estimatedHours: 4,
  deadline: '2026-06-06T00:00:00.000Z',
  specialNotes: 'Minimalist style',
  status: 'scheduled',
  scheduledStart: '2026-06-05T14:00:00.000Z',
  scheduledEnd: '2026-06-05T18:10:00.000Z',
  date: '2026-06-05',
  chatUrl: 'https://seller.goofish.com/chat/123',
  notionPageId: undefined,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
  ...overrides,
});

describe('createNotionPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a Notion page with mapped properties and returns page ID', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'page-abc-123' }),
    } as Response);

    const pageId = await createNotionPage(makeTask(), 'db-test-123');
    expect(pageId).toBe('page-abc-123');

    // Verify the fetch call was made with correct body
    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(fetchCall[1].body);

    // Check parent
    expect(body.parent.database_id).toBe('db-test-123');

    // Check properties mapping
    const props = body.properties;
    expect(props['Task Name'].title[0].text.content).toContain('张三');
    expect(props['Task Name'].title[0].text.content).toContain('Logo design');
    expect(props['Buyer'].rich_text[0].text.content).toBe('张三');
    expect(props['Requirement'].rich_text[0].text.content).toBe('Logo design');
    expect(props['Urgency'].select.name).toBe('🔴 High');
    expect(props['Price (¥)'].number).toBe(350);
    expect(props['Est. Hours'].number).toBe(4);
    expect(props['Date'].date.start).toBe('2026-06-05');
    expect(props['Status'].select.name).toBe('📋 Scheduled');
    expect(props['Chat Link'].url).toBe('https://seller.goofish.com/chat/123');
  });

  it('throws error on Notion API failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    await expect(createNotionPage(makeTask(), 'db-test-123')).rejects.toThrow(
      'Notion API error: 404',
    );
  });
});
