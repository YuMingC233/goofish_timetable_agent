import type { AppSettings, ScheduledTask, TimeSlot } from '../shared/types';
import { BUFFER_MINUTES } from '../shared/constants';

// ── Work-hour rules (per day type) ──

const WEEKDAY_HOURS = { startHour: 19, endHour: 22 };   // Mon–Fri 19:00–22:00 (晚7点–晚10点)
const WEEKEND_HOURS = { startHour: 10, endHour: 22 };   // Sat–Sun 10:00–22:00

/** Delay before scheduling when there are no existing tasks. */
const NO_TASK_DELAY_MINUTES = 10;

const MS_PER_HOUR = 3600000;
const MS_PER_MINUTE = 60000;
const MS_PER_DAY = 86400000;

// ── Helpers ──
// All date arithmetic uses instance methods (getTime, getHours, …) and
// timestamp addition.  The multi-arg `new Date(y,m,d,h,…)` constructor is
// AVOIDED because @sinonjs/fake-timers (used by vitest) breaks it when
// `vi.useFakeTimers()` is active.

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getWorkHoursForDate(date: Date): { startHour: number; endHour: number } {
  return isWeekend(date) ? WEEKEND_HOURS : WEEKDAY_HOURS;
}

/** Milliseconds elapsed since local midnight for the given date. */
function msSinceMidnight(date: Date): number {
  return date.getHours() * MS_PER_HOUR
    + date.getMinutes() * MS_PER_MINUTE
    + date.getSeconds() * 1000
    + date.getMilliseconds();
}

/** Timestamp for work-period start on the day `date` falls on. */
function workPeriodStartMs(date: Date): number {
  const { startHour } = getWorkHoursForDate(date);
  return date.getTime() - msSinceMidnight(date) + startHour * MS_PER_HOUR;
}

/** Timestamp for work-period end on the day `date` falls on. */
function workPeriodEndMs(date: Date): number {
  const { endHour } = getWorkHoursForDate(date);
  return date.getTime() - msSinceMidnight(date) + endHour * MS_PER_HOUR;
}

/**
 * Advance to the start of the next calendar day's work period.
 * Uses +24h on the timestamp then recomputes; for non-DST zones this is safe.
 */
function nextWorkPeriodStartMs(fromMs: number): number {
  // Move to the next day by adding 24h and snapping to midnight, then +1s
  // to ensure we're on the next calendar day even across DST boundaries.
  const next = new Date(fromMs + MS_PER_DAY);
  // Use the midnight-of-next-day approach
  const midnightMs = next.getTime() - msSinceMidnight(next);
  // Check if adding 24h landed on the same day (possible across DST); if so, add another day
  const nextDay = new Date(midnightMs + MS_PER_HOUR); // 01:00 on the next day
  return workPeriodStartMs(nextDay);
}

function parsePreferredDate(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  // Use Date.UTC + local offset to avoid the multi-arg constructor
  const localOffset = new Date().getTimezoneOffset() * MS_PER_MINUTE;
  const ts = Date.UTC(year, month - 1, day, 0, 0, 0, 0) + localOffset;
  const date = new Date(ts);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

// ── Main ──

/**
 * Finds the earliest available time slot for a task of the given duration.
 *
 * Rules:
 *  - No existing tasks  → schedule 10 min from now (clamped to work hours).
 *  - Has existing tasks → find the first gap that fits.
 *  - Work hours:  Mon–Fri 7:00–10:00,  Sat–Sun 10:00–22:00.
 *  - If a task doesn't fit in one day's work window, advance to the next day.
 *  - If `preferredDate` is given and in the future, anchor to that date.
 */
export function findOptimalSlot(
  durationHours: number,
  existingTasks: readonly ScheduledTask[],
  settings: AppSettings,
  preferredDate?: string | null,
): TimeSlot {
  const bufferMs = (settings.defaultBufferMinutes || BUFFER_MINUTES) * MS_PER_MINUTE;
  const durationMs = durationHours * MS_PER_HOUR;
  const totalDurationMs = durationMs + bufferMs;
  const now = new Date();

  // ── Determine earliest start timestamp ──

  let candidateMs: number;
  if (existingTasks.length === 0) {
    // No existing tasks → 10 minutes from now
    candidateMs = now.getTime() + NO_TASK_DELAY_MINUTES * MS_PER_MINUTE;
  } else {
    candidateMs = now.getTime();
  }

  // If preferredDate is given and in the future, anchor to that date's work start
  if (preferredDate) {
    const parsed = parsePreferredDate(preferredDate);
    if (parsed && parsed.getTime() > now.getTime()) {
      const preferredWorkStartMs = workPeriodStartMs(parsed);
      candidateMs = Math.max(candidateMs, preferredWorkStartMs);
    }
  }

  // ── Sort existing tasks ──

  const sorted = [...existingTasks].sort(
    (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
  );

  // ── Scan forward to find a slot ──

  for (let i = 0; i < 365; i++) {
    const candidateDate = new Date(candidateMs);

    // Get work period boundaries for this day (in local time)
    const wsMs = workPeriodStartMs(candidateDate);
    const weMs = workPeriodEndMs(candidateDate);

    // Clamp start to work hours
    if (candidateMs < wsMs) candidateMs = wsMs;

    // Past today's work hours → next day
    if (candidateMs >= weMs) {
      candidateMs = nextWorkPeriodStartMs(candidateMs);
      continue;
    }

    // Task duration: only the actual task (no buffer). Buffer is spacing
    // between tasks for conflict detection, NOT a constraint on work hours.
    // A task that starts within work hours may run past workEnd.
    const endMs = candidateMs + durationMs;

    // ── No existing tasks → simple placement ──

    if (sorted.length === 0) {
      // End includes buffer for storage/conflict purposes
      return { start: new Date(candidateMs), end: new Date(candidateMs + totalDurationMs) };
    }

    // ── Check against existing tasks for gaps ──

    let conflict = false;
    for (const task of sorted) {
      const taskStartMs = new Date(task.scheduledStart).getTime();
      const taskEndMs = new Date(task.scheduledEnd).getTime();

      // Skip tasks that are fully in the past relative to candidate
      if (taskEndMs <= candidateMs) continue;

      // Overlap? (endMs includes buffer for gap detection)
      if (candidateMs < taskEndMs && endMs + bufferMs > taskStartMs) {
        // Move candidate after this task
        candidateMs = taskEndMs;
        conflict = true;
        break;
      }
    }

    if (!conflict) {
      return { start: new Date(candidateMs), end: new Date(candidateMs + totalDurationMs) };
    }
    // candidateMs was moved past a conflicting task — loop again to re-check work hours
  }

  // Fallback (should never reach in practice)
  return { start: new Date(candidateMs), end: new Date(candidateMs + totalDurationMs) };
}
