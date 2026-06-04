import type { AppSettings, ScheduledTask, TimeSlot } from '../shared/types';
import { BUFFER_MINUTES } from '../shared/prompts';

/**
 * Finds the earliest available time slot for a task of the given duration.
 * Scans existing tasks (sorted by start time) for gaps, returns the first fit.
 * If no gap is large enough, returns a slot after all existing tasks.
 *
 * The returned `end` time includes the buffer (default 10 min).
 */
export function findOptimalSlot(
  durationHours: number,
  existingTasks: readonly ScheduledTask[],
  settings: AppSettings,
): TimeSlot {
  const bufferMs = (settings.defaultBufferMinutes || BUFFER_MINUTES) * 60 * 1000;
  const durationMs = durationHours * 60 * 60 * 1000;
  const totalDurationMs = durationMs + bufferMs;

  const now = new Date();
  const workStart = parseTimeToDate(settings.defaultWorkStart, now);
  const workEnd = parseTimeToDate(settings.defaultWorkEnd, now);

  // Start candidate: later of "now" and work start
  let earliestStart = new Date(Math.max(now.getTime(), workStart.getTime()));

  // Sort existing tasks by start time
  const sorted = [...existingTasks].sort(
    (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
  );

  let processedAnyTask = false;

  for (const task of sorted) {
    const taskStart = new Date(task.scheduledStart);
    const taskEnd = new Date(task.scheduledEnd);

    // If the task is in the past, skip it
    if (taskEnd <= earliestStart) {
      continue;
    }

    processedAnyTask = true;

    // Check if there's enough gap before this task
    const candidateEnd = new Date(earliestStart.getTime() + totalDurationMs);
    if (candidateEnd <= taskStart) {
      // Also check that candidate end doesn't exceed work end
      if (candidateEnd <= workEnd) {
        return {
          start: earliestStart,
          end: candidateEnd,
        };
      }
      // Task would exceed work end; push to next day
      earliestStart = nextWorkDayStart(workStart);
      continue;
    }

    // Move candidate after this task
    earliestStart = new Date(Math.max(earliestStart.getTime(), taskEnd.getTime()));
  }

  // When there are no existing tasks at all, check if the slot fits before work end
  if (!processedAnyTask) {
    const candidateEnd = new Date(earliestStart.getTime() + totalDurationMs);
    if (candidateEnd <= workEnd) {
      return { start: earliestStart, end: candidateEnd };
    }
    // Push to next day
    const nextDay = nextWorkDayStart(workStart);
    return {
      start: nextDay,
      end: new Date(nextDay.getTime() + totalDurationMs),
    };
  }

  // Existing tasks were processed and no gap was found — place after the last task
  return {
    start: earliestStart,
    end: new Date(earliestStart.getTime() + totalDurationMs),
  };
}

function parseTimeToDate(timeStr: string, referenceDate: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date(referenceDate);
  d.setUTCHours(hours || 9, minutes || 0, 0, 0);
  return d;
}

function nextWorkDayStart(workStartTemplate: Date): Date {
  const next = new Date(workStartTemplate);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
