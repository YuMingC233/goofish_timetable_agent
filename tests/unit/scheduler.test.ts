import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findOptimalSlot } from '../../src/background/scheduler';
import type { ScheduledTask, AppSettings } from '../../src/shared/types';
import { DEFAULT_SETTINGS } from '../../src/shared/types';

function makeTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: 'test-1',
    buyerName: 'Test Buyer',
    requirement: 'Test',
    urgency: 'medium',
    urgencyReason: '',
    price: 100,
    estimatedHours: 2,
    deadline: null,
    specialNotes: null,
    status: 'scheduled',
    scheduledStart: '2026-06-04T10:00:00.000Z',
    scheduledEnd: '2026-06-04T12:10:00.000Z',
    date: '2026-06-04',
    chatUrl: 'https://seller.goofish.com/chat/123',
    createdAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:00.000Z',
    ...overrides,
  };
}

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    defaultWorkStart: '09:00',
    defaultWorkEnd: '18:00',
    ...overrides,
  };
}

describe('findOptimalSlot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 2026-06-04 is a Thursday — safe base where +1 day is a working day (Friday).
    vi.setSystemTime(new Date('2026-06-04T08:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns slot starting at preferred time when no existing tasks', () => {
    const slot = findOptimalSlot(2, [], makeSettings());
    // With no tasks, should start at default work start (09:00) since now is 08:00
    expect(slot.start).toEqual(new Date('2026-06-04T09:00:00Z'));
    expect(slot.end).toEqual(new Date('2026-06-04T11:10:00Z')); // 2h + 10min buffer
  });

  it('finds gap before first existing task', () => {
    const existing = makeTask({
      scheduledStart: '2026-06-04T14:00:00.000Z',
      scheduledEnd: '2026-06-04T16:10:00.000Z',
    });
    const slot = findOptimalSlot(2, [existing], makeSettings());
    expect(slot.start).toEqual(new Date('2026-06-04T09:00:00Z'));
  });

  it('finds gap between two existing tasks', () => {
    const tasks = [
      makeTask({
        id: 'task-a',
        scheduledStart: '2026-06-04T09:00:00.000Z',
        scheduledEnd: '2026-06-04T11:10:00.000Z',
      }),
      makeTask({
        id: 'task-b',
        scheduledStart: '2026-06-04T15:00:00.000Z',
        scheduledEnd: '2026-06-04T17:10:00.000Z',
      }),
    ];
    const slot = findOptimalSlot(2, tasks, makeSettings());
    expect(slot.start).toEqual(new Date('2026-06-04T11:10:00.000Z'));
    expect(slot.end).toEqual(new Date('2026-06-04T13:20:00.000Z'));
  });

  it('returns slot after last task when all gaps are too small', () => {
    const tasks = [
      makeTask({
        id: 'task-a',
        scheduledStart: '2026-06-04T09:00:00.000Z',
        scheduledEnd: '2026-06-04T11:10:00.000Z',
      }),
      makeTask({
        id: 'task-b',
        scheduledStart: '2026-06-04T11:30:00.000Z',
        scheduledEnd: '2026-06-04T13:40:00.000Z',
      }),
      makeTask({
        id: 'task-c',
        scheduledStart: '2026-06-04T14:00:00.000Z',
        scheduledEnd: '2026-06-04T16:10:00.000Z',
      }),
    ];
    const slot = findOptimalSlot(4, tasks, makeSettings());
    expect(slot.start).toEqual(new Date('2026-06-04T16:10:00.000Z'));
  });

  it('respects work end time if task exceeds work end', () => {
    const tasks: ScheduledTask[] = [];
    const settings = makeSettings({ defaultWorkEnd: '17:00' });
    const slot = findOptimalSlot(9, tasks, settings);
    // 9h task at 09:00 ends at 18:10 > 17:00, pushes to next working day.
    // June 4 is Thursday → June 5 is Friday (working day, not a weekend).
    expect(slot.start).toEqual(new Date('2026-06-05T09:00:00Z'));
  });

  it('returns later of now and work start when no tasks exist', () => {
    vi.setSystemTime(new Date('2026-06-04T11:00:00Z'));
    const slot = findOptimalSlot(2, [], makeSettings());
    expect(slot.start).toEqual(new Date('2026-06-04T11:00:00Z'));
  });
});
