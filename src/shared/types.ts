// ── Core domain types ──

// Build-time env constants injected by Vite (see vite.config.ts → define).
// In tests they fall back to '' via vitest.config.ts.
declare const __ENV_OPENAI_API_KEY__: string;
declare const __ENV_OPENAI_BASE_URL__: string;
declare const __ENV_NOTION_TOKEN__: string;
declare const __ENV_NOTION_DATABASE_ID__: string;
declare const __ENV_AI_MODEL__: string;

export type Urgency = 'high' | 'medium' | 'low';
export type TaskStatus = 'scheduled' | 'in_progress' | 'done' | 'cancelled';
export type AIProvider = 'openai' | 'anthropic' | 'ollama';

/** Raw output from the LLM extraction prompt */
export interface ExtractedTask {
  readonly buyerName: string;
  readonly requirement: string;
  readonly urgency: Urgency;
  readonly urgencyReason: string;
  readonly price: number | null;
  readonly estimatedHours: number;
  readonly deadline: string | null; // ISO 8601 date string or null
  readonly specialNotes: string | null;
}

/** A task after scheduling — what gets sent to Notion */
export interface ScheduledTask {
  readonly id: string;
  readonly buyerName: string;
  readonly requirement: string;
  readonly urgency: Urgency;
  readonly urgencyReason: string;
  readonly price: number | null;
  readonly estimatedHours: number;
  readonly deadline: string | null;
  readonly specialNotes: string | null;
  readonly status: TaskStatus;
  readonly scheduledStart: string; // ISO 8601 datetime
  readonly scheduledEnd: string; // ISO 8601 datetime (includes buffer)
  readonly date: string; // ISO 8601 date (for Notion calendar view anchor)
  readonly chatUrl: string;
  readonly notionPageId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ── Settings ──

export interface AppSettings {
  openaiApiKey: string;
  openaiBaseUrl: string;
  notionToken: string;
  notionDatabaseId: string;
  aiProvider: AIProvider;
  aiModel: string;
  defaultBasePrice: number;
  defaultBufferMinutes: number;
}

export type AppSettingsPartial = Partial<AppSettings>;

export const DEFAULT_SETTINGS: AppSettings = {
  openaiApiKey: __ENV_OPENAI_API_KEY__,
  openaiBaseUrl: __ENV_OPENAI_BASE_URL__ || 'https://api.openai.com/v1',
  notionToken: __ENV_NOTION_TOKEN__,
  notionDatabaseId: __ENV_NOTION_DATABASE_ID__,
  aiProvider: 'openai',
  aiModel: __ENV_AI_MODEL__ || 'gpt-4o-mini',
  defaultBasePrice: 0,
  defaultBufferMinutes: 10,
};

// ── Message passing protocol ──

export type BackgroundMessageType =
  | 'EXTRACT_TASK'
  | 'DETECT_CONFLICTS'
  | 'FIND_OPTIMAL_SLOT'
  | 'SYNC_TO_NOTION'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'GET_SCHEDULED_TASKS';

export interface BackgroundMessage {
  readonly type: BackgroundMessageType;
  readonly payload: unknown;
}

export interface BackgroundResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

// ── Conflict engine types ──

export interface TimeSlot {
  readonly start: Date;
  readonly end: Date;
}

export interface ConflictResult {
  readonly hasConflict: boolean;
  readonly conflictingTasks: readonly ScheduledTask[];
  readonly suggestedSlot: TimeSlot | null;
}

// ── Scraper types ──

export interface ChatMessage {
  readonly sender: 'buyer' | 'seller' | 'system';
  readonly senderName: string;
  readonly content: string;
  readonly timestamp: string;
}

export interface ScrapedConversation {
  readonly buyerName: string;
  readonly messages: readonly ChatMessage[];
  readonly chatUrl: string;
}
