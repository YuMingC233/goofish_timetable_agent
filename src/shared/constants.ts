// ── Xianyu DOM selectors ──

export const SELECTORS = {
  /** The container that holds the active chat thread messages (Ant Design list) */
  CHAT_CONTAINER: '#msg-list-container',
  /** Individual message bubbles — Ant Design list items */
  CHAT_MESSAGE: 'li.ant-list-item',
  /** Buyer name in the chat top bar — prefix match, hash-independent */
  BUYER_NAME: '[class*="text1--"]',
  /** Message content text wrapper — prefix match, hash-independent */
  MESSAGE_TEXT: '[class*="message-text--"]',
  /** Fallback sender name element (per-message name label) */
  SENDER_NAME: '[style*="white-space: nowrap"]',
  /** Sent message indicator (seller = self, right-aligned bubble) — prefix match */
  SENT_MESSAGE: '[class*="message-text-right--"]',
  /** Received message indicator (buyer, left-aligned bubble) — prefix match */
  RECEIVED_MESSAGE: '[class*="message-text-left--"]',
  /** System messages to skip (withdraw notices) — prefix match, hash-independent */
  SYSTEM_MESSAGE: '[class*="msg-withdraw--"], [class*="withdraw--"]',
  /** Date separator lines serving as approximate timestamps */
  DATE_SEPARATOR: '[style*="text-align: center"]',
  /** Widget root injected by our content script */
  WIDGET_ROOT: 'goofish-agent-root',
} as const;

// ── URLs ──

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

export const URLS = {
  OPENAI_CHAT_COMPLETIONS: `${DEFAULT_OPENAI_BASE_URL}/chat/completions`,
  NOTION_API_BASE: 'https://api.notion.com/v1',
} as const;

// ── Urgency keyword maps ──

export const HIGH_URGENCY_KEYWORDS = ['急', '尽快', '马上', '今天', '明天', '紧急', '加急', 'ASAP'];
export const MEDIUM_URGENCY_KEYWORDS = ['这周', '本周', '几天内', '这两天', '周末前'];

// ── Timing defaults ──

export const BUFFER_MINUTES = 10;
export const DEFAULT_BASE_PRICE = 300;

// ── AI ──

export const AI_TIMEOUT_MS = 30_000;
export const AI_MAX_RETRIES = 2;

// ── Notion ──

export const NOTION_API_VERSION = '2022-06-28';

/** Maps code identifiers → Chinese Notion database column names.
 *  Keeps business logic in English while the Notion UI stays readable. */
export const NOTION_PROPERTY_KEYS = {
  TASK_NAME: '名称',
  BUYER: '买家',
  REQUIREMENT: '需求描述',
  URGENCY: '紧急程度',
  PRICE: '报价',
  EST_HOURS: '预估工时',
  DATE: '日期',
  STATUS: '状态',
  CHAT_LINK: '聊天链接',
  NOTES: '备注',
} as const;

// ── Storage keys ──

export const STORAGE_KEYS = {
  SETTINGS: 'goofish_settings',
  SCHEDULED_TASKS: 'goofish_scheduled_tasks',
} as const;
