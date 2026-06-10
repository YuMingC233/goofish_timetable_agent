import type { BackgroundMessage, BackgroundResponse, ScheduledTask } from '../shared/types';
import { t } from '../shared/i18n';
import { extractTask } from './ai-client';
import { detectConflicts } from './conflict-engine';
import { findOptimalSlot } from './scheduler';
import { createNotionPage, fetchExistingNotionTasks } from './notion-client';
import { getSettings, saveSettings, getScheduledTasks, addScheduledTask, replaceScheduledTasks } from './storage-manager';

// ── Helpers ──

/** Format a Date as an ISO 8601 string in LOCAL time (no Z suffix).
 *  toISOString() always outputs UTC which causes timezone drift in Notion. */
function toLocalISOString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// ── Notion → local sync ──

/**
 * Fetch the actual task list from Notion and reconcile it with the local cache.
 * Tasks deleted in Notion are removed from local storage; new Notion pages are
 * added. This ensures the scheduler always works with up-to-date data.
 */
async function syncTasksFromNotion(): Promise<void> {
  const settings = await getSettings();
  if (!settings.notionToken || !settings.notionDatabaseId) return;

  try {
    const notionTasks = await fetchExistingNotionTasks(settings.notionDatabaseId);
    const localTasks = await getScheduledTasks();

    const notionPageIds = new Set(notionTasks.map(nt => nt.notionPageId));

    // 1. Remove local tasks whose Notion page no longer exists
    const kept = localTasks.filter(task => {
      if (!task.notionPageId) return true; // not yet synced to Notion — keep
      return notionPageIds.has(task.notionPageId);
    });

    // 2. Add Notion pages that aren't in local cache yet (as minimal ScheduledTasks)
    const localPageIds = new Set(localTasks.filter(t => t.notionPageId).map(t => t.notionPageId));
    for (const nt of notionTasks) {
      if (!localPageIds.has(nt.notionPageId)) {
        kept.push({
          id: crypto.randomUUID(),
          buyerName: '',
          requirement: '',
          urgency: 'medium',
          urgencyReason: '',
          price: null,
          estimatedHours: 1,
          deadline: null,
          specialNotes: null,
          status: 'scheduled',
          scheduledStart: nt.scheduledStart,
          scheduledEnd: nt.scheduledEnd,
          date: nt.scheduledStart.split('T')[0] ?? nt.scheduledStart.slice(0, 10),
          chatUrl: '',
          notionPageId: nt.notionPageId,
          createdAt: nt.scheduledStart,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await replaceScheduledTasks(kept);
  } catch {
    // Non-critical — scheduler will use whatever is in local cache
  }
}

// ── Message router ──

chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, _sender, sendResponse: (response: BackgroundResponse) => void) => {
    handleMessage(message).then(sendResponse);
    return true; // keep the message channel open for async response
  },
);

async function handleMessage(message: BackgroundMessage): Promise<BackgroundResponse> {
  try {
    switch (message.type) {
      case 'EXTRACT_TASK': {
        const { chatMessages } = message.payload as { chatMessages: string };
        const task = await extractTask(chatMessages);
        return { success: true, data: task };
      }

      case 'DETECT_CONFLICTS': {
        // Sync with Notion first so conflicts are checked against reality
        await syncTasksFromNotion();
        const { newTaskStart, newTaskEnd } = message.payload as {
          newTaskStart: string;
          newTaskEnd: string;
        };
        const existingTasks = await getScheduledTasks();
        const result = detectConflicts(
          { start: new Date(newTaskStart), end: new Date(newTaskEnd) },
          existingTasks,
        );
        return { success: true, data: result };
      }

      case 'FIND_OPTIMAL_SLOT': {
        // Sync with Notion first so scheduling is based on real task list
        await syncTasksFromNotion();
        const { durationHours, preferredDate } = message.payload as {
          durationHours: number;
          preferredDate?: string | null;
        };
        const settings = await getSettings();
        const existingTasks = await getScheduledTasks();
        const slot = findOptimalSlot(durationHours, existingTasks, settings, preferredDate ?? null);
        return {
          success: true,
          data: { start: toLocalISOString(slot.start), end: toLocalISOString(slot.end) },
        };
      }

      case 'SYNC_TO_NOTION': {
        const { task } = message.payload as { task: ScheduledTask };
        const settings = await getSettings();
        const pageId = await createNotionPage(task, settings.notionDatabaseId);
        // Update task with Notion page ID and persist
        const syncedTask = { ...task, notionPageId: pageId };
        await addScheduledTask(syncedTask);
        return { success: true, data: { pageId } };
      }

      case 'GET_SETTINGS': {
        const settings = await getSettings();
        return { success: true, data: settings };
      }

      case 'SAVE_SETTINGS': {
        const partial = message.payload as Partial<import('../shared/types').AppSettings>;
        await saveSettings(partial);
        return { success: true };
      }

      case 'GET_SCHEDULED_TASKS': {
        const tasks = await getScheduledTasks();
        return { success: true, data: tasks };
      }

      default:
        return { success: false, error: t('errorUnknownMessageType') + `: ${(message as BackgroundMessage).type}` };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

// ── Install handler ──

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Goofish Agent] Extension installed');
});
