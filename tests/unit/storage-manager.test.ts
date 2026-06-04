import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSettings, saveSettings, getScheduledTasks, addScheduledTask } from '../../src/background/storage-manager';
import type { AppSettings, ScheduledTask } from '../../src/shared/types';
import { DEFAULT_SETTINGS } from '../../src/shared/types';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
});

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn((keys: string | string[] | null) => {
        if (keys === null) return Promise.resolve({ ...mockStorage });
        const keyList = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const k of keyList) {
          if (k in mockStorage) result[k] = mockStorage[k];
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
    },
  },
});

describe('getSettings', () => {
  it('returns defaults when no settings stored', async () => {
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('merges stored values with defaults', async () => {
    mockStorage['goofish_settings'] = { openaiApiKey: 'sk-test', notionToken: 'ntn-test' };
    const settings = await getSettings();
    expect(settings.openaiApiKey).toBe('sk-test');
    expect(settings.notionToken).toBe('ntn-test');
    expect(settings.defaultBasePrice).toBe(DEFAULT_SETTINGS.defaultBasePrice);
  });
});

describe('saveSettings', () => {
  it('persists settings to chrome.storage.local', async () => {
    await saveSettings({ openaiApiKey: 'sk-new' });
    const stored = mockStorage['goofish_settings'] as Partial<AppSettings>;
    expect(stored.openaiApiKey).toBe('sk-new');
  });

  it('merges partial settings with existing', async () => {
    mockStorage['goofish_settings'] = { openaiApiKey: 'sk-old', defaultBasePrice: 500 };
    await saveSettings({ openaiApiKey: 'sk-new' });
    const stored = mockStorage['goofish_settings'] as Partial<AppSettings>;
    expect(stored.openaiApiKey).toBe('sk-new');
    expect(stored.defaultBasePrice).toBe(500);
  });
});

describe('getScheduledTasks', () => {
  it('returns empty array when no tasks stored', async () => {
    const tasks = await getScheduledTasks();
    expect(tasks).toEqual([]);
  });

  it('returns stored tasks', async () => {
    const task: ScheduledTask = {
      id: 't1', buyerName: 'Test', requirement: 'Test', urgency: 'medium',
      urgencyReason: '', price: 100, estimatedHours: 2, deadline: null,
      specialNotes: null, status: 'scheduled',
      scheduledStart: '2026-06-05T10:00:00.000Z', scheduledEnd: '2026-06-05T12:10:00.000Z',
      date: '2026-06-05', chatUrl: 'https://seller.goofish.com/chat/1',
      createdAt: '2026-06-04T00:00:00.000Z', updatedAt: '2026-06-04T00:00:00.000Z',
    };
    mockStorage['goofish_scheduled_tasks'] = [task];
    const tasks = await getScheduledTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.id).toBe('t1');
  });
});

describe('addScheduledTask', () => {
  it('appends task to existing list and persists', async () => {
    const task: ScheduledTask = {
      id: 't1', buyerName: 'Test', requirement: 'Test', urgency: 'medium',
      urgencyReason: '', price: 100, estimatedHours: 2, deadline: null,
      specialNotes: null, status: 'scheduled',
      scheduledStart: '2026-06-05T10:00:00.000Z', scheduledEnd: '2026-06-05T12:10:00.000Z',
      date: '2026-06-05', chatUrl: 'https://seller.goofish.com/chat/1',
      createdAt: '2026-06-04T00:00:00.000Z', updatedAt: '2026-06-04T00:00:00.000Z',
    };
    await addScheduledTask(task);
    const stored = mockStorage['goofish_scheduled_tasks'] as ScheduledTask[];
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe('t1');
  });
});
