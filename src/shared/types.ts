// ── Core domain types ──

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
  notionToken: string;
  notionDatabaseId: string;
  aiProvider: AIProvider;
  aiModel: string;
  defaultBasePrice: number;
  defaultBufferMinutes: number;
  defaultWorkStart: string; // "09:00"
  defaultWorkEnd: string; // "18:00"
}

export type AppSettingsPartial = Partial<AppSettings>;

export const DEFAULT_SETTINGS: AppSettings = {
  openaiApiKey: '',
  notionToken: '',
  notionDatabaseId: '',
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  defaultBasePrice: 300,
  defaultBufferMinutes: 10,
  defaultWorkStart: '09:00',
  defaultWorkEnd: '18:00',
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
  readonly content: string;
  readonly timestamp: string;
}

export interface ScrapedConversation {
  readonly buyerName: string;
  readonly messages: readonly ChatMessage[];
  readonly chatUrl: string;
}
