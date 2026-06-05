import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotionPage } from '../../src/background/notion-client';
import type { ScheduledTask } from '../../src/shared/types';
import { NOTION_PROPERTY_KEYS } from '../../src/shared/constants';

const P = NOTION_PROPERTY_KEYS;

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

    // Check properties mapping (all column names are Chinese via NOTION_PROPERTY_KEYS)
    const props = body.properties;
    expect(props[P.TASK_NAME].title[0].text.content).toContain('张三');
    expect(props[P.TASK_NAME].title[0].text.content).toContain('Logo design');
    expect(props[P.BUYER].rich_text[0].text.content).toBe('张三');
    expect(props[P.REQUIREMENT].rich_text[0].text.content).toBe('Logo design');
    expect(props[P.URGENCY].select.name).toBe('🔴 High');
    expect(props[P.PRICE].number).toBe(350);
    expect(props[P.EST_HOURS].number).toBe(4);
    expect(props[P.DATE].date.start).toBe('2026-06-05');
    expect(props[P.STATUS].status.name).toBe('📋 Scheduled');
    expect(props[P.CHAT_LINK].url).toBe('https://seller.goofish.com/chat/123');
  });

  it('throws error with response body on Notion API failure', async () => {
    const errorDetail = JSON.stringify({ message: 'Invalid property type', code: 'validation_error' });
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: () => Promise.resolve(errorDetail),
    } as Response);

    await expect(createNotionPage(makeTask(), 'db-test-123')).rejects.toThrow(
      /Notion API error 400.*Invalid property type/,
    );
  });

  it('omits price property when price is null', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'page-no-price' }),
    } as Response);

    await createNotionPage(makeTask({ price: null }), 'db-test-123');

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(fetchCall[1].body);
    const props = body.properties;
    expect(props[P.PRICE]).toBeUndefined();
  });

  it('omits price property when price is NaN', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'page-nan-price' }),
    } as Response);

    await createNotionPage(makeTask({ price: NaN }), 'db-test-123');

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(fetchCall[1].body);
    const props = body.properties;
    expect(props[P.PRICE]).toBeUndefined();
  });

  it('throws generic error when response body cannot be read', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.reject(new Error('body read error')),
    } as Response);

    await expect(createNotionPage(makeTask(), 'db-test-123')).rejects.toThrow(
      /Notion API error 500: Internal Server Error/,
    );
  });
});
