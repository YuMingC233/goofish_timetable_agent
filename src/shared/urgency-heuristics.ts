import type { Urgency } from './types';
import { HIGH_URGENCY_KEYWORDS, MEDIUM_URGENCY_KEYWORDS } from './constants';

/** Text patterns that demote urgency (e.g. "不急" negates the "急" keyword). */
const DEMOTING_PATTERNS = ['不急'];

export function detectUrgency(
  text: string,
  deadline?: string | null,
): { urgency: Urgency; reason: string } {
  const isDemoted = DEMOTING_PATTERNS.some((p) => text.includes(p));

  // Check high-urgency keywords (skip when demoted, e.g. "不急" contains "急")
  if (!isDemoted) {
    for (const kw of HIGH_URGENCY_KEYWORDS) {
      if (text.includes(kw)) {
        return { urgency: 'high', reason: `Text contains keyword: "${kw}"` };
      }
    }
  }

  // Check deadline proximity (always, even when demoted)
  if (deadline) {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const hoursUntilDeadline =
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (!isNaN(deadlineDate.getTime())) {
      if (hoursUntilDeadline <= 48) {
        return { urgency: 'high', reason: `Deadline within 48 hours (${deadline})` };
      }
      if (hoursUntilDeadline <= 24 * 7) {
        return { urgency: 'medium', reason: `Deadline within 7 days (${deadline})` };
      }
    }
  }

  // Check medium-urgency keywords (skip when demoted)
  if (!isDemoted) {
    for (const kw of MEDIUM_URGENCY_KEYWORDS) {
      if (text.includes(kw)) {
        return { urgency: 'medium', reason: `Text contains keyword: "${kw}"` };
      }
    }
  }

  if (isDemoted) {
    return { urgency: 'low', reason: 'Text contains demoting pattern: "不急"' };
  }

  return { urgency: 'low', reason: 'No time pressure detected' };
}
