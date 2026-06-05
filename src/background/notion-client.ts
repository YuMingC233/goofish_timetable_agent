import type { ScheduledTask, TaskStatus, Urgency } from '../shared/types';
import { getSettings } from './storage-manager';
import { URLS, NOTION_API_VERSION, NOTION_PROPERTY_KEYS } from '../shared/constants';

const PROP = NOTION_PROPERTY_KEYS;

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

  // Build properties object, omitting null/undefined optional fields
  const priceNum = typeof task.price === 'number' && !Number.isNaN(task.price) ? task.price : null;
  const props: Record<string, unknown> = {
    [PROP.TASK_NAME]: {
      title: [{ text: { content: `[${task.buyerName}] - ${task.requirement}` } }],
    },
    [PROP.BUYER]: {
      rich_text: [{ text: { content: task.buyerName } }],
    },
    [PROP.REQUIREMENT]: {
      rich_text: [{ text: { content: task.requirement } }],
    },
    [PROP.URGENCY]: {
      select: { name: URGENCY_LABELS[task.urgency] },
    },
    [PROP.EST_HOURS]: {
      number: task.estimatedHours,
    },
    [PROP.DATE]: {
      date: { start: task.date },
    },
    [PROP.START_TIME]: {
      date: { start: task.scheduledStart, time_zone: 'Asia/Shanghai' },
    },
    [PROP.END_TIME]: {
      date: { start: task.scheduledEnd, time_zone: 'Asia/Shanghai' },
    },
    [PROP.STATUS]: {
      status: { name: STATUS_LABELS[task.status] },
    },
    [PROP.CHAT_LINK]: {
      url: task.chatUrl,
    },
    [PROP.NOTES]: {
      rich_text: task.specialNotes
        ? [{ text: { content: task.specialNotes } }]
        : [],
    },
  };

  // Only include Price if it's a valid number
  if (priceNum !== null) {
    props[PROP.PRICE] = { number: priceNum };
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
      properties: props,
    }),
  });

  if (!response.ok) {
    let errorBody = '';
    try { errorBody = await response.text(); } catch { /* ignore */ }
    throw new Error(
      `Notion API error ${response.status}: ${response.statusText}${errorBody ? ' — ' + errorBody.slice(0, 500) : ''}`,
    );
  }

  const data = await response.json();
  return data.id as string;
}
