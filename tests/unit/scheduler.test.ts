import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findOptimalSlot } from '../../src/background/scheduler';
import type { ScheduledTask, AppSettings } from '../../src/shared/types';
import { DEFAULT_SETTINGS } from '../../src/shared/types';

/**
 * Helper: create a Date in LOCAL time using the multi-arg constructor.
 * All test times & expectations use this so they work in any system timezone.
 */
function local(year: number, month: number, day: number, hour = 0, min = 0): Date {
  return new Date(year, month - 1, day, hour, min, 0, 0);
}

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
    // Default: Thursday 19:00–21:10 local (2h + 10min buffer)
    scheduledStart: local(2026, 6, 4, 19, 0).toISOString(),
    scheduledEnd: local(2026, 6, 4, 21, 10).toISOString(),
    date: '2026-06-04',
    chatUrl: 'https://seller.goofish.com/chat/123',
    createdAt: local(2026, 6, 3).toISOString(),
    updatedAt: local(2026, 6, 3).toISOString(),
    ...overrides,
  };
}

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

// ── 2026-06-04 is a Thursday (weekday, work hours 19:00–22:00) ──
// ── 2026-06-06 is a Saturday (weekend, work hours 10:00–22:00) ──
// ── 2026-06-07 is a Sunday ──

describe('findOptimalSlot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default: Thursday 18:00 local (before work hours)
    vi.setSystemTime(local(2026, 6, 4, 18, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── No existing tasks → 10 min from now, clamped to work hours ──

  it('with no existing tasks, schedules 10 min from now when inside work hours', () => {
    vi.setSystemTime(local(2026, 6, 4, 19, 30)); // Thursday 19:30
    const slot = findOptimalSlot(2, [], makeSettings());
    // 10 min from now = 19:40, end = 19:40 + 2h + 10min buffer = 21:50
    expect(slot.start).toEqual(local(2026, 6, 4, 19, 40));
    expect(slot.end).toEqual(local(2026, 6, 4, 21, 50));
  });

  it('with no existing tasks, clamps to work start when now is before work hours', () => {
    vi.setSystemTime(local(2026, 6, 4, 17, 0)); // Thursday 17:00
    const slot = findOptimalSlot(1, [], makeSettings());
    // now+10min = 17:10, but work starts at 19:00 → clamp to 19:00
    expect(slot.start).toEqual(local(2026, 6, 4, 19, 0));
    expect(slot.end).toEqual(local(2026, 6, 4, 20, 10)); // 1h + 10min buffer
  });

  it('with no existing tasks, pushes to next day when now is after work hours', () => {
    vi.setSystemTime(local(2026, 6, 4, 23, 0)); // Thursday 23:00 (past 22:00)
    const slot = findOptimalSlot(1, [], makeSettings());
    // Next day is Friday (weekday) → 19:00
    expect(slot.start).toEqual(local(2026, 6, 5, 19, 0));
  });

  it('allows task to extend past work end — work hours constrain start only', () => {
    // This is the user's real scenario: 21:11, 1h task → should start 21:21, end 22:31
    vi.setSystemTime(local(2026, 6, 4, 21, 11)); // Thursday 21:11
    const slot = findOptimalSlot(1, [], makeSettings());
    // 10 min from now = 21:21, end = 21:21 + 1h + 10min buffer = 22:31
    // Even though 22:31 > workEnd(22:00), task is allowed because start is within work hours
    expect(slot.start).toEqual(local(2026, 6, 4, 21, 21));
    expect(slot.end).toEqual(local(2026, 6, 4, 22, 31));
  });

  // ── Weekend work hours (10:00–22:00) ──

  it('uses weekend work hours on Saturday', () => {
    vi.setSystemTime(local(2026, 6, 6, 9, 0)); // Saturday 09:00
    const slot = findOptimalSlot(2, [], makeSettings());
    // now+10min = 09:10, but weekend work starts at 10:00 → clamp
    expect(slot.start).toEqual(local(2026, 6, 6, 10, 0));
    expect(slot.end).toEqual(local(2026, 6, 6, 12, 10));
  });

  it('uses weekend work hours on Sunday', () => {
    vi.setSystemTime(local(2026, 6, 7, 14, 0)); // Sunday 14:00
    const slot = findOptimalSlot(3, [], makeSettings());
    // now+10min = 14:10, within 10:00–22:00
    expect(slot.start).toEqual(local(2026, 6, 7, 14, 10));
    expect(slot.end).toEqual(local(2026, 6, 7, 17, 20));
  });

  // ── Gap-finding with existing tasks ──

  it('finds gap before first existing task', () => {
    vi.setSystemTime(local(2026, 6, 4, 19, 0)); // Thursday 19:00
    const existing = makeTask({
      scheduledStart: local(2026, 6, 4, 20, 30).toISOString(),
      scheduledEnd: local(2026, 6, 4, 21, 10).toISOString(),
    });
    const slot = findOptimalSlot(1, [existing], makeSettings());
    // 1h task: 19:00–20:10, fits before 20:30 (buffer gives gap)
    expect(slot.start).toEqual(local(2026, 6, 4, 19, 0));
    expect(slot.end).toEqual(local(2026, 6, 4, 20, 10));
  });

  it('finds gap between two existing tasks', () => {
    vi.setSystemTime(local(2026, 6, 4, 18, 0)); // Thursday 18:00
    const tasks = [
      makeTask({
        id: 'task-a',
        scheduledStart: local(2026, 6, 4, 19, 0).toISOString(),
        scheduledEnd: local(2026, 6, 4, 20, 10).toISOString(),
      }),
      makeTask({
        id: 'task-b',
        scheduledStart: local(2026, 6, 4, 21, 0).toISOString(),
        scheduledEnd: local(2026, 6, 4, 21, 50).toISOString(),
      }),
    ];
    const slot = findOptimalSlot(0.5, tasks, makeSettings()); // 30 min task
    // After task-a ends (20:10), need 30min + 10min buffer = 40min gap
    // Gap: 20:10–21:00 = 50 min → fits at 20:10, ends 20:50 (task) + buffer
    expect(slot.start).toEqual(local(2026, 6, 4, 20, 10));
    expect(slot.end).toEqual(local(2026, 6, 4, 20, 50));
  });

  it('places after last task when no gap fits', () => {
    vi.setSystemTime(local(2026, 6, 4, 18, 0)); // Thursday 18:00
    const tasks = [
      makeTask({
        id: 'task-a',
        scheduledStart: local(2026, 6, 4, 19, 0).toISOString(),
        scheduledEnd: local(2026, 6, 4, 20, 10).toISOString(),
      }),
      makeTask({
        id: 'task-b',
        scheduledStart: local(2026, 6, 4, 20, 10).toISOString(),
        scheduledEnd: local(2026, 6, 4, 21, 20).toISOString(),
      }),
    ];
    const slot = findOptimalSlot(0.5, tasks, makeSettings());
    // After task-b: 21:20, 30min task ends 21:50 + 10min buffer = 22:00
    expect(slot.start).toEqual(local(2026, 6, 4, 21, 20));
    expect(slot.end).toEqual(local(2026, 6, 4, 22, 0));
  });

  // ── preferredDate anchoring ──

  it('anchors to preferredDate when given and in the future', () => {
    vi.setSystemTime(local(2026, 6, 4, 18, 0)); // Thursday
    // Prefer Saturday
    const slot = findOptimalSlot(2, [], makeSettings(), '2026-06-06');
    expect(slot.start).toEqual(local(2026, 6, 6, 10, 0)); // weekend 10:00
    expect(slot.end).toEqual(local(2026, 6, 6, 12, 10));
  });

  it('ignores preferredDate when it is in the past', () => {
    vi.setSystemTime(local(2026, 6, 5, 20, 0)); // Friday 20:00
    const slot = findOptimalSlot(1, [], makeSettings(), '2026-06-03'); // Wednesday (past)
    // Should ignore preferred date, schedule from now+10min
    expect(slot.start).toEqual(local(2026, 6, 5, 20, 10));
  });

  // ── Conflict resolution across days ──

  it('moves past conflicting task and re-checks work hours', () => {
    vi.setSystemTime(local(2026, 6, 4, 18, 0)); // Thursday
    // Existing task fills most of the weekday window
    const existing = makeTask({
      scheduledStart: local(2026, 6, 4, 19, 0).toISOString(),
      scheduledEnd: local(2026, 6, 4, 21, 30).toISOString(),
    });
    // 1h task: start must be >= 21:30 but < 22:00 → 21:30
    const slot = findOptimalSlot(1, [existing], makeSettings());
    expect(slot.start).toEqual(local(2026, 6, 4, 21, 30));
    // end = 21:30 + 1h + 10min = 22:40 (past workEnd, but allowed)
    expect(slot.end).toEqual(local(2026, 6, 4, 22, 40));
  });

  it('pushes to next day when start would be past workEnd', () => {
    vi.setSystemTime(local(2026, 6, 4, 18, 0)); // Thursday
    // Existing task ends after workEnd
    const existing = makeTask({
      scheduledStart: local(2026, 6, 4, 19, 0).toISOString(),
      scheduledEnd: local(2026, 6, 4, 22, 30).toISOString(),
    });
    // 1h task: 22:30 is past workEnd(22:00) → push to Friday
    const slot = findOptimalSlot(1, [existing], makeSettings());
    expect(slot.start).toEqual(local(2026, 6, 5, 19, 0));
    expect(slot.end).toEqual(local(2026, 6, 5, 20, 10));
  });
});
