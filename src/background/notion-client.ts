import type { ScheduledTask, TaskStatus, Urgency } from '../shared/types';
import { getSettings } from './storage-manager';
import { URLS, NOTION_API_VERSION } from '../shared/constants';

const URGENCY_LABELS: Record<Urgency, string> = {
  high: '🔴 High',
  medium: '🟡 Medium',
  low: '🟢 Low',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  scheduled: '📋 Scheduled',
  in_progress: '🔄 In Progress',
  done: '✅ Done',
  cancelled: '❌ Cancelled',
};

export async function createNotionPage(
  task: ScheduledTask,
  databaseId: string,
): Promise<string> {
  const settings = await getSettings();
  if (!settings.notionToken) {
    throw new Error('Notion token not configured. Please set it in the extension popup.');
  }

  const response = await fetch(`${URLS.NOTION_API_BASE}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION,
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: {
        'Task Name': {
          title: [{ text: { content: `[${task.buyerName}] - ${task.requirement}` } }],
        },
        Buyer: {
          rich_text: [{ text: { content: task.buyerName } }],
        },
        Requirement: {
          rich_text: [{ text: { content: task.requirement } }],
        },
        Urgency: {
          select: { name: URGENCY_LABELS[task.urgency] },
        },
        'Price (¥)': {
          number: task.price ?? undefined,
        },
        'Est. Hours': {
          number: task.estimatedHours,
        },
        Date: {
          date: { start: task.date },
        },
        'Start Time': {
          date: { start: task.scheduledStart, time_zone: 'Asia/Shanghai' },
        },
        'End Time': {
          date: { start: task.scheduledEnd, time_zone: 'Asia/Shanghai' },
        },
        Status: {
          select: { name: STATUS_LABELS[task.status] },
        },
        'Chat Link': {
          url: task.chatUrl,
        },
        Notes: {
          rich_text: task.specialNotes
            ? [{ text: { content: task.specialNotes } }]
            : [],
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Notion API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.id as string;
}
