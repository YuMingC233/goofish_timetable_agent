import type { ConflictResult, ScheduledTask, TimeSlot } from '../shared/types';

/**
 * Detects whether a new task overlaps with any existing scheduled tasks.
 * The `end` of each time slot already includes the 10-minute buffer.
 *
 * Algorithm (from README):
 *   For each existing_task:
 *     if new_task.start < existing_task.end AND new_task.end > existing_task.start:
 *       → CONFLICT
 */
export function detectConflicts(
  newSlot: TimeSlot,
  existingTasks: readonly ScheduledTask[],
): ConflictResult {
  const conflictingTasks: ScheduledTask[] = [];

  for (const task of existingTasks) {
    const taskStart = new Date(task.scheduledStart);
    const taskEnd = new Date(task.scheduledEnd);

    if (newSlot.start < taskEnd && newSlot.end > taskStart) {
      conflictingTasks.push(task);
    }
  }

  return {
    hasConflict: conflictingTasks.length > 0,
    conflictingTasks,
    suggestedSlot: null, // filled by the scheduler, not here
  };
}
