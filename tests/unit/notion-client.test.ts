import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotionPage } from '../../src/background/notion-client';
import type { ScheduledTask } from '../../src/shared/types';
import { NOTION_PROPERTY_KEYS } from '../../src/shared/constants';

const PROP = NOTION_PROPERTY_KEYS;

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

/** A Notion database schema that matches the default PROP names. */
function makeDbSchema(overrides?: Record<string, { type: string; id: string }>): object {
  return {
    properties: {
      [PROP.TASK_NAME]: { type: 'title', id: 'title-col' },
      [PROP.BUYER]: { type: 'rich_text', id: 'buyer-col' },
      [PROP.REQUIREMENT]: { type: 'rich_text', id: 'req-col' },
      [PROP.URGENCY]: { type: 'select', id: 'urg-col' },
      [PROP.PRICE]: { type: 'number', id: 'price-col' },
      [PROP.EST_HOURS]: { type: 'number', id: 'hours-col' },
      [PROP.DATE]: { type: 'date', id: 'date-col' },
      [PROP.STATUS]: { type: 'select', id: 'status-col' },
      [PROP.CHAT_LINK]: { type: 'url', id: 'link-col' },
      [PROP.NOTES]: { type: 'rich_text', id: 'notes-col' },
      ...overrides,
    },
  };
}

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

  it('fetches DB schema and creates a page with dynamically mapped properties', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    // First fetch: database schema
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeDbSchema()),
    } as Response);
    // Second fetch: create page
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'page-abc-123' }),
    } as Response);

    const pageId = await createNotionPage(makeTask(), 'db-test-123');
    expect(pageId).toBe('page-abc-123');

    // Verify the page creation body (second fetch call)
    const pageCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1]!;
    const body = JSON.parse(pageCall[1].body);
    expect(body.parent.database_id).toBe('db-test-123');

    const props = body.properties;
    // Title is mapped to the actual title column name from the schema
    expect(props[PROP.TASK_NAME].title[0].text.content).toContain('张三');
    expect(props[PROP.TASK_NAME].title[0].text.content).toContain('Logo design');
    // Other properties use resolved names
    expect(props[PROP.BUYER].rich_text[0].text.content).toBe('张三');
    expect(props[PROP.REQUIREMENT].rich_text[0].text.content).toBe('Logo design');
    expect(props[PROP.URGENCY].select.name).toBe('🔴 High');
    expect(props[PROP.PRICE].number).toBe(350);
    expect(props[PROP.EST_HOURS].number).toBe(4);
    expect(props[PROP.DATE].date.start).toBe('2026-06-05T14:00:00.000Z');
    expect(props[PROP.DATE].date.end).toBe('2026-06-05T18:10:00.000Z');
    expect(props[PROP.DATE].date.time_zone).toBe('Asia/Shanghai');
    expect(props[PROP.STATUS].select.name).toBe('📋 Scheduled');
    expect(props[PROP.CHAT_LINK].url).toBe('https://seller.goofish.com/chat/123');
  });

  it('adapts to a database with different column names and a status-typed status', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        properties: {
          '任务': { type: 'title', id: 't' },
          '客户': { type: 'rich_text', id: 'b' },
          '需求': { type: 'rich_text', id: 'r' },
          '紧急度': { type: 'select', id: 'u' },
          '报价': { type: 'number', id: 'p' },
          '预估': { type: 'number', id: 'h' },
          '日期': { type: 'date', id: 'd' },
          '状态': { type: 'status', id: 'st' },
          '链接': { type: 'url', id: 'l' },
          '备注': { type: 'rich_text', id: 'n' },
        },
      }),
    } as Response);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'page-custom' }),
    } as Response);

    const pageId = await createNotionPage(makeTask(), 'db-custom');
    expect(pageId).toBe('page-custom');

    const pageCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1]!;
    const body = JSON.parse(pageCall[1].body);
    const props = body.properties;

    // Should use the actual column names from the schema
    expect(props['任务'].title[0].text.content).toContain('Logo design');
    // Falls back to any rich_text for buyer/requirement since preferred names don't match
    expect(props['客户'].rich_text[0].text.content).toBe('张三');
    // Status uses status key because schema says type=status
    expect(props['状态'].status.name).toBe('📋 Scheduled');
  });

  it('omits properties that do not exist in the database schema', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        properties: {
          '任务名称': { type: 'title', id: 't' },
          '客户名': { type: 'rich_text', id: 'b' },
        },
      }),
    } as Response);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'page-minimal' }),
    } as Response);

    const pageId = await createNotionPage(makeTask(), 'db-minimal');
    expect(pageId).toBe('page-minimal');

    const pageCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1]!;
    const body = JSON.parse(pageCall[1].body);
    const props = body.properties;

    // Only title and buyer should be present
    expect(props['任务名称']).toBeDefined();
    expect(props['客户名']).toBeDefined();
    // Everything else is omitted
    expect(Object.keys(props)).toHaveLength(2);
  });

  it('throws when database has no title property', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        properties: {
          '备注': { type: 'rich_text', id: 'n' },
        },
      }),
    } as Response);

    await expect(createNotionPage(makeTask(), 'db-no-title')).rejects.toThrow(
      'no title property',
    );
  });

  it('omits price property when price is null', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeDbSchema()),
    } as Response);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'page-no-price' }),
    } as Response);

    await createNotionPage(makeTask({ price: null }), 'db-test-123');

    const pageCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1]!;
    const body = JSON.parse(pageCall[1].body);
    expect(body.properties[PROP.PRICE]).toBeUndefined();
  });

  it('throws error with response body on page creation failure', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    // Schema fetch succeeds
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeDbSchema()),
    } as Response);
    // Page creation fails
    const errorDetail = JSON.stringify({ message: 'Invalid property type', code: 'validation_error' });
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: () => Promise.resolve(errorDetail),
    } as Response);

    await expect(createNotionPage(makeTask(), 'db-test-123')).rejects.toThrow(
      /Notion API error 400.*Invalid property type/,
    );
  });

  it('throws error when schema fetch fails', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('{"message":"Invalid token"}'),
    } as Response);

    await expect(createNotionPage(makeTask(), 'db-test-123')).rejects.toThrow(
      /Failed to fetch database schema: 401.*Invalid token/,
    );
  });
});
