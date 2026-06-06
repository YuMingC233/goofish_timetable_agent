import type { AppSettings, ScheduledTask, TimeSlot } from '../shared/types';
import { BUFFER_MINUTES } from '../shared/constants';

/**
 * Finds the earliest available time slot for a task of the given duration.
 * Scans existing tasks (sorted by start time) for gaps, returns the first fit.
 * If no gap is large enough, returns a slot after all existing tasks.
 *
 * The returned `end` time includes the buffer (default 10 min).
 *
 * @param preferredDate Optional YYYY-MM-DD date to anchor work hours to.
 *   If the date is a weekend, skips to the next working day.
 *   If invalid or in the past, treated as null (auto/now).
 */
export function findOptimalSlot(
  durationHours: number,
  existingTasks: readonly ScheduledTask[],
  settings: AppSettings,
  preferredDate?: string | null,
): TimeSlot {
  const bufferMs = (settings.defaultBufferMinutes || BUFFER_MINUTES) * 60 * 1000;
  const durationMs = durationHours * 60 * 60 * 1000;
  const totalDurationMs = durationMs + bufferMs;

  const now = new Date();

  // Resolve the reference date for work hours
  let referenceDate = now;
  if (preferredDate) {
    const parsed = parsePreferredDate(preferredDate);
    if (parsed && parsed > now) {
      // If preferred date is a weekend, skip to next working day
      referenceDate = isWeekend(parsed) ? nextWorkingDay(parsed) : parsed;
    }
  }

  const workStart = parseTimeToDate(settings.defaultWorkStart, referenceDate);
  const workEnd = parseTimeToDate(settings.defaultWorkEnd, referenceDate);

  // Start candidate: later of "now" and work start
  let earliestStart = new Date(Math.max(now.getTime(), workStart.getTime()));

  // If we're past work end, push to next work day's start immediately
  if (earliestStart.getTime() >= workEnd.getTime()) {
    earliestStart = nextWorkDayStart(workStart);
  }

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
  d.setHours(hours || 9, minutes || 0, 0, 0);
  return d;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function nextWorkingDay(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  while (isWeekend(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function nextWorkDayStart(workStartTemplate: Date): Date {
  const next = new Date(workStartTemplate);
  next.setDate(next.getDate() + 1);
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function parsePreferredDate(dateStr: string): Date | null {
  // Expects YYYY-MM-DD format
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match || match[1] === undefined || match[2] === undefined || match[3] === undefined) {
    return null;
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const date = new Date(year, month - 1, day);
  // Validate the date components round-trip (catches e.g. Feb 30)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}
