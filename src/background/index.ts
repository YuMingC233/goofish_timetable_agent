import type { BackgroundMessage, BackgroundResponse } from '../shared/types';
import { t } from '../shared/i18n';
import { extractTask } from './ai-client';
import { detectConflicts } from './conflict-engine';
import { findOptimalSlot } from './scheduler';
import { createNotionPage } from './notion-client';
import { getSettings, saveSettings, getScheduledTasks, addScheduledTask } from './storage-manager';

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
        const { durationHours, preferredDate } = message.payload as {
          durationHours: number;
          preferredDate?: string | null;
        };
        const settings = await getSettings();
        const existingTasks = await getScheduledTasks();
        const slot = findOptimalSlot(durationHours, existingTasks, settings, preferredDate ?? null);
        return {
          success: true,
          data: { start: slot.start.toISOString(), end: slot.end.toISOString() },
        };
      }

      case 'SYNC_TO_NOTION': {
        const { task } = message.payload as { task: import('../shared/types').ScheduledTask };
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
