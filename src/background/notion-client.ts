import type { ScheduledTask, TaskStatus, Urgency } from '../shared/types';
import { t } from '../shared/i18n';
import { getSettings } from './storage-manager';
import { URLS, NOTION_API_VERSION, NOTION_PROPERTY_KEYS } from '../shared/constants';

const URGENCY_LABELS: Record<Urgency, string> = {
  high: t('notionStatusHigh'),
  medium: t('notionStatusMedium'),
  low: t('notionStatusLow'),
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  scheduled: t('notionStatusScheduled'),
  in_progress: t('notionStatusInProgress'),
  done: t('notionStatusDone'),
  cancelled: t('notionStatusCancelled'),
};

/** Lightweight database property schema fetched from Notion. */
interface DbProp {
  type: string;
  id: string;
}

type DbSchema = Record<string, DbProp>;

/**
 * Fetch the Notion database schema so we can map our logical keys
 * to the actual property names and types in the user's database.
 */
async function fetchDbSchema(databaseId: string, token: string): Promise<DbSchema> {
  const response = await fetch(`${URLS.NOTION_API_BASE}/databases/${databaseId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_API_VERSION,
    },
  });
  if (!response.ok) {
    let errorBody = '';
    try { errorBody = await response.text(); } catch { /* ignore */ }
    const bodySnippet = errorBody ? ' — ' + errorBody.slice(0, 300) : '';
    throw new Error(t('errorNotionSchema', [String(response.status), bodySnippet]));
  }
  const data = await response.json();
  const props: DbSchema = {};
  for (const [name, p] of Object.entries(data.properties as Record<string, { type: string; id: string }>)) {
    props[name] = { type: p.type, id: p.id };
  }
  return props;
}

/** Find the title property name from the schema. */
function findTitleProp(schema: DbSchema): string | null {
  for (const [name, prop] of Object.entries(schema)) {
    if (prop.type === 'title') return name;
  }
  return null;
}

/**
 * Look up a property name in the schema, trying the preferred name first,
 * then falling back to any unconsumed property of the expected type.
 * Marks consumed properties so later lookups don't reuse the same column.
 */
function resolveProp(
  schema: DbSchema,
  preferredName: string,
  expectedType: string,
  consumed: Set<string>,
): string | null {
  // Exact name match (if not already consumed)
  if (schema[preferredName] && schema[preferredName]!.type === expectedType && !consumed.has(preferredName)) {
    consumed.add(preferredName);
    return preferredName;
  }
  // Fallback: find any unconsumed property of the expected type
  for (const [name, prop] of Object.entries(schema)) {
    if (prop.type === expectedType && !consumed.has(name)) {
      consumed.add(name);
      return name;
    }
  }
  return null;
}

function buildPropValue(type: string, value: unknown): Record<string, unknown> {
  switch (type) {
    case 'title':
      return { title: [{ text: { content: String(value) } }] };
    case 'rich_text':
      return { rich_text: [{ text: { content: String(value) } }] };
    case 'number':
      return { number: value };
    case 'select':
    case 'status':
      return { [type]: { name: String(value) } };
    case 'date':
      return value as Record<string, unknown>;
    case 'url':
      return { url: String(value) };
    default:
      return { rich_text: [{ text: { content: String(value) } }] };
  }
}

// ── Exported ──

/**
 * Query the Notion database for existing pages (scheduled tasks) and
 * return their time ranges so the scheduler can use them instead of
 * stale local cache.
 *
 * Only returns tasks that overlap with "today or later" to keep the
 * result set small and avoid dragging in ancient history.
 */
export async function fetchExistingNotionTasks(
  databaseId: string,
): Promise<Array<{ notionPageId: string; scheduledStart: string; scheduledEnd: string }>> {
  const settings = await getSettings();
  if (!settings.notionToken) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const response = await fetch(`${URLS.NOTION_API_BASE}/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION,
    },
    body: JSON.stringify({
      filter: {
        property: NOTION_PROPERTY_KEYS.DATE,
        date: { on_or_after: todayStr },
      },
      page_size: 100,
    }),
  });

  if (!response.ok) return []; // Non-critical — fall back to local cache

  const data = await response.json();
  const results = data.results as Array<{ id: string; properties: Record<string, unknown> }>;

  const tasks: Array<{ notionPageId: string; scheduledStart: string; scheduledEnd: string }> = [];

  for (const page of results) {
    const props = page.properties as Record<string, { type: string; date?: { start: string; end: string | null } }>;
    const dateProp = props[NOTION_PROPERTY_KEYS.DATE];
    if (dateProp?.type === 'date' && dateProp.date?.start) {
      tasks.push({
        notionPageId: page.id,
        scheduledStart: dateProp.date.start,
        scheduledEnd: dateProp.date.end || dateProp.date.start,
      });
    }
  }

  return tasks;
}

export async function createNotionPage(
  task: ScheduledTask,
  databaseId: string,
): Promise<string> {
  const settings = await getSettings();
  if (!settings.notionToken) {
    throw new Error(t('errorNotionToken'));
  }

  // Fetch database schema to map property names/types dynamically
  const schema = await fetchDbSchema(databaseId, settings.notionToken);
  const titleName = findTitleProp(schema);
  if (!titleName) {
    throw new Error(t('errorNotionNoTitle'));
  }

  const consumed = new Set<string>();
  const lookup = (key: keyof typeof NOTION_PROPERTY_KEYS, expectedType: string) =>
    resolveProp(schema, NOTION_PROPERTY_KEYS[key], expectedType, consumed);

  const props: Record<string, Record<string, unknown>> = {};

  // Required: title
  props[titleName] = buildPropValue('title', `[${task.buyerName}] - ${task.requirement}`);

  // Optional: map known properties if they exist in the database
  const buyerName = lookup('BUYER', 'rich_text');
  if (buyerName) props[buyerName] = buildPropValue('rich_text', task.buyerName);

  const requirementName = lookup('REQUIREMENT', 'rich_text');
  if (requirementName) props[requirementName] = buildPropValue('rich_text', task.requirement);

  // Urgency — try select first, then status, then skip
  const urgencyName = resolveProp(schema, NOTION_PROPERTY_KEYS.URGENCY, 'select', consumed)
    || resolveProp(schema, NOTION_PROPERTY_KEYS.URGENCY, 'status', consumed);
  if (urgencyName) {
    props[urgencyName] = buildPropValue(schema[urgencyName]!.type, URGENCY_LABELS[task.urgency]);
  }

  // Price — only if a valid number
  const priceNum = typeof task.price === 'number' && !Number.isNaN(task.price) ? task.price : null;
  if (priceNum !== null) {
    const priceName = lookup('PRICE', 'number');
    if (priceName) props[priceName] = buildPropValue('number', priceNum);
  }

  const hoursName = lookup('EST_HOURS', 'number');
  if (hoursName) props[hoursName] = buildPropValue('number', task.estimatedHours);

  const dateName = lookup('DATE', 'date');
  if (dateName) {
    props[dateName] = buildPropValue('date', {
      date: {
        start: task.scheduledStart,
        end: task.scheduledEnd,
        time_zone: 'Asia/Shanghai',
      },
    });
  }

  // Status — try select, then status
  const statusName = resolveProp(schema, NOTION_PROPERTY_KEYS.STATUS, 'select', consumed)
    || resolveProp(schema, NOTION_PROPERTY_KEYS.STATUS, 'status', consumed);
  if (statusName) {
    props[statusName] = buildPropValue(schema[statusName]!.type, STATUS_LABELS[task.status]);
  }

  const chatLinkName = lookup('CHAT_LINK', 'url');
  if (chatLinkName) props[chatLinkName] = buildPropValue('url', task.chatUrl);

  const notesName = lookup('NOTES', 'rich_text');
  if (notesName) props[notesName] = buildPropValue('rich_text', task.specialNotes || '');

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
    const bodySnippet = errorBody ? ' — ' + errorBody.slice(0, 500) : '';
    throw new Error(t('errorNotionApi', [String(response.status), response.statusText, bodySnippet]));
  }

  const data = await response.json();
  return data.id as string;
}
