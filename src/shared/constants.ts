// ── Xianyu DOM selectors ──

export const SELECTORS = {
  /** The container that holds the active chat thread messages */
  CHAT_CONTAINER: '[class*="chat"], [class*="message-list"], [class*="conversation"]',
  /** Individual message bubbles */
  CHAT_MESSAGE: '[class*="message-item"], [class*="msg-item"], [class*="bubble"]',
  /** Buyer name in the chat header or sidebar */
  BUYER_NAME: '[class*="contact-name"], [class*="user-name"], [class*="title"]',
  /** Message content text */
  MESSAGE_TEXT: '[class*="msg-content"], [class*="message-text"], [class*="text"]',
  /** Message timestamp */
  MESSAGE_TIME: '[class*="time"], [class*="timestamp"], [class*="date"]',
  /** Sent message indicator (for distinguishing seller vs buyer) */
  SENT_MESSAGE: '[class*="sent"], [class*="self"], [class*="right"]',
  /** Received message indicator */
  RECEIVED_MESSAGE: '[class*="received"], [class*="other"], [class*="left"]',
  /** Widget root injected by our content script */
  WIDGET_ROOT: 'goofish-agent-root',
} as const;

// ── URLs ──

export const URLS = {
  OPENAI_CHAT_COMPLETIONS: 'https://api.openai.com/v1/chat/completions',
  NOTION_API_BASE: 'https://api.notion.com/v1',
} as const;

// ── Urgency keyword maps ──

export const HIGH_URGENCY_KEYWORDS = ['急', '尽快', '马上', '今天', '明天', '紧急', '加急', 'ASAP'];
export const MEDIUM_URGENCY_KEYWORDS = ['这周', '本周', '几天内', '这两天', '周末前'];

// ── Timing defaults ──

export const BUFFER_MINUTES = 10;
export const DEFAULT_BASE_PRICE = 300;
export const DEFAULT_WORK_START = '09:00';
export const DEFAULT_WORK_END = '18:00';

// ── AI ──

export const AI_TIMEOUT_MS = 30_000;
export const AI_MAX_RETRIES = 2;

// ── Notion ──

export const NOTION_API_VERSION = '2022-06-28';

// ── Storage keys ──

export const STORAGE_KEYS = {
  SETTINGS: 'goofish_settings',
  SCHEDULED_TASKS: 'goofish_scheduled_tasks',
} as const;
