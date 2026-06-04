import { describe, it, expect } from 'vitest';
import { detectConflicts } from '../../src/background/conflict-engine';
import type { ScheduledTask, TimeSlot } from '../../src/shared/types';

function makeTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: 'test-1',
    buyerName: 'Test Buyer',
    requirement: 'Test requirement',
    urgency: 'medium',
    urgencyReason: 'test',
    price: 100,
    estimatedHours: 2,
    deadline: null,
    specialNotes: null,
    status: 'scheduled',
    scheduledStart: '2026-06-05T10:00:00.000Z',
    scheduledEnd: '2026-06-05T12:10:00.000Z',
    date: '2026-06-05',
    chatUrl: 'https://seller.goofish.com/chat/123',
    createdAt: '2026-06-04T00:00:00.000Z',
    updatedAt: '2026-06-04T00:00:00.000Z',
    ...overrides,
  };
}

describe('detectConflicts', () => {
  it('returns no conflict when existing tasks list is empty', () => {
    const newSlot: TimeSlot = {
      start: new Date('2026-06-05T14:00:00Z'),
      end: new Date('2026-06-05T16:10:00Z'),
    };
    const result = detectConflicts(newSlot, []);
    expect(result.hasConflict).toBe(false);
    expect(result.conflictingTasks).toHaveLength(0);
  });

  it('returns no conflict when new task ends before existing task starts', () => {
    const existing = makeTask({
      scheduledStart: '2026-06-05T16:00:00.000Z',
      scheduledEnd: '2026-06-05T18:10:00.000Z',
    });
    const newSlot: TimeSlot = {
      start: new Date('2026-06-05T14:00:00Z'),
      end: new Date('2026-06-05T15:50:00Z'),
    };
    const result = detectConflicts(newSlot, [existing]);
    expect(result.hasConflict).toBe(false);
  });

  it('returns no conflict when new task starts after existing task ends', () => {
    const existing = makeTask({
      scheduledStart: '2026-06-05T10:00:00.000Z',
      scheduledEnd: '2026-06-05T12:10:00.000Z',
    });
    const newSlot: TimeSlot = {
      start: new Date('2026-06-05T14:00:00Z'),
      end: new Date('2026-06-05T16:10:00Z'),
    };
    const result = detectConflicts(newSlot, [existing]);
    expect(result.hasConflict).toBe(false);
  });

  it('detects conflict on full overlap (new task envelops existing)', () => {
    const existing = makeTask({
      scheduledStart: '2026-06-05T14:00:00.000Z',
      scheduledEnd: '2026-06-05T16:10:00.000Z',
    });
    const newSlot: TimeSlot = {
      start: new Date('2026-06-05T13:00:00Z'),
      end: new Date('2026-06-05T17:00:00Z'),
    };
    const result = detectConflicts(newSlot, [existing]);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingTasks).toHaveLength(1);
    expect(result.conflictingTasks[0]!.id).toBe('test-1');
  });

  it('detects conflict on partial overlap (front)', () => {
    const existing = makeTask({
      scheduledStart: '2026-06-05T14:00:00.000Z',
      scheduledEnd: '2026-06-05T16:10:00.000Z',
    });
    const newSlot: TimeSlot = {
      start: new Date('2026-06-05T13:00:00Z'),
      end: new Date('2026-06-05T15:00:00Z'),
    };
    const result = detectConflicts(newSlot, [existing]);
    expect(result.hasConflict).toBe(true);
  });

  it('detects conflict on partial overlap (back)', () => {
    const existing = makeTask({
      scheduledStart: '2026-06-05T14:00:00.000Z',
      scheduledEnd: '2026-06-05T16:10:00.000Z',
    });
    const newSlot: TimeSlot = {
      start: new Date('2026-06-05T15:00:00Z'),
      end: new Date('2026-06-05T17:00:00Z'),
    };
    const result = detectConflicts(newSlot, [existing]);
    expect(result.hasConflict).toBe(true);
  });

  it('detects conflict among multiple existing tasks', () => {
    const tasks = [
      makeTask({
        id: 'task-a',
        scheduledStart: '2026-06-05T10:00:00.000Z',
        scheduledEnd: '2026-06-05T12:10:00.000Z',
      }),
      makeTask({
        id: 'task-b',
        scheduledStart: '2026-06-05T14:00:00.000Z',
        scheduledEnd: '2026-06-05T16:10:00.000Z',
      }),
      makeTask({
        id: 'task-c',
        scheduledStart: '2026-06-05T16:00:00.000Z',
        scheduledEnd: '2026-06-05T18:10:00.000Z',
      }),
    ];
    const newSlot: TimeSlot = {
      start: new Date('2026-06-05T13:00:00Z'),
      end: new Date('2026-06-05T15:00:00Z'),
    };
    const result = detectConflicts(newSlot, tasks);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingTasks).toHaveLength(1);
    expect(result.conflictingTasks[0]!.id).toBe('task-b');
  });
});
