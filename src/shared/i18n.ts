/**
 * Lightweight wrapper around chrome.i18n.getMessage.
 * Falls back to a static English map when chrome.i18n is unavailable (e.g. tests).
 */

const EN_FALLBACK: Record<string, string> = {
  appName: 'Goofish Timetable Agent',
  appDescription: 'AI-powered auto-scheduling and Notion calendar sync for Xianyu sellers',
  appActionTitle: 'Goofish Timetable Agent',
  ballTitle: 'Goofish Timetable Agent',
  ctxMenuGenerate: '🎣 Start Generating',
  ctxMenuConfig: '⚙️ Environment Config',
  panelHeader: '🤖 Goofish Agent',
  fieldBuyer: 'Buyer',
  fieldRequirement: 'Requirement',
  fieldUrgency: 'Urgency',
  fieldPrice: 'Price',
  fieldEstHours: 'Est. Hours',
  fieldDeadline: 'Deadline',
  fieldNotes: 'Notes',
  fieldScheduleDay: 'Schedule Day',
  fieldScheduledTime: 'Scheduled Time',
  optionAuto: '🤖 Auto (auto-schedule)',
  optionToday: '📅 Today',
  optionTomorrow: '📅 Tomorrow',
  optionCustom: '📅 Pick a date...',
  btnExport: 'Export to Notion →',
  btnReanalyze: 'Re-analyze',
  btnSaveSettings: '💾 Save Settings',
  btnResolve: 'Resolve (auto-reschedule)',
  btnIgnore: 'Ignore & Export Anyway',
  labelOpenAiKey: 'OpenAI API Key',
  labelOpenAiBaseUrl: 'OpenAI Base URL',
  labelAiModel: 'AI Model',
  labelNotionToken: 'Notion Integration Token',
  labelNotionDbId: 'Notion Database ID',
  placeholderOpenAiKey: 'sk-...',
  placeholderOpenAiBaseUrl: 'https://api.openai.com/v1',
  placeholderAiModel: 'gpt-4o-mini',
  placeholderNotionToken: 'ntn-...',
  placeholderNotionDbId: 'Your database ID',
  statusLoading: 'Analyzing conversation with AI...',
  statusEmpty: 'Click 🎣 on a Xianyu conversation to analyze it',
  statusSettingsGuide: 'Configure your API keys below, then click <strong>Re-analyze</strong>.',
  statusSaveSuccess: '✓ Settings saved! Click Re-analyze below.',
  statusSaveFailed: 'Save failed',
  statusExportSuccess: 'Task synced to Notion!',
  statusExportFailed: 'Sync failed',
  statusSlotFailed: 'Failed to find available time slot',
  statusConflict: '⚠️ Conflict: overlaps with $TASKS$',
  statusConflictUnknown: '⚠️ Conflict: overlaps with existing tasks',
  statusContextInvalid: 'Extension context invalidated. Please reload the page.',
  statusEnvConfig: 'Environment Configuration',
  errorNoApiKey: 'OpenAI API key not configured. Please set it in the extension popup.',
  errorAiApi: 'AI API error $STATUS$: $TEXT$$BODY$',
  errorExtractionFailed: 'AI extraction failed after retries',
  errorParseJson: 'Failed to parse AI response as JSON',
  errorNotionToken: 'Notion token not configured. Please set it in the extension popup.',
  errorNotionSchema: 'Failed to fetch database schema ($STATUS$)$BODY$',
  errorNotionNoTitle: 'Database has no title property — please add one in Notion.',
  errorNotionApi: 'Notion API error $STATUS$: $TEXT$$BODY$',
  errorUnknownMessageType: 'Unknown message type',
  aiSystemPrompt: 'You are a helpful assistant. Always reply with valid JSON.',
  aiBuyerLabel: 'Buyer',
  aiSellerLabel: 'Seller',
  popupPageTitle: 'Goofish Agent — Settings',
  popupHeading: '🎣 Goofish Agent',
  popupSubtitle: 'Configure your API keys to get started',
  popupBtnSave: 'Save Settings',
  popupStatusSaved: '✓ Settings saved!',
  popupStatusSaveError: 'Failed to save',
  notionStatusHigh: '🔴 High',
  notionStatusMedium: '🟡 Medium',
  notionStatusLow: '🟢 Low',
  notionStatusScheduled: '📋 Scheduled',
  notionStatusInProgress: '🔄 In Progress',
  notionStatusDone: '✅ Done',
  notionStatusCancelled: '❌ Cancelled',
  urgencyHigh: 'HIGH',
  urgencyMedium: 'MEDIUM',
  urgencyLow: 'LOW',
  unknown: 'Unknown',
  na: 'N/A',
};

export function t(messageName: string, substitutions?: string | string[]): string {
  let msg = messageName;

  try {
    if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
      msg = chrome.i18n.getMessage(messageName, substitutions as any) || messageName;
    }
  } catch {
    // Fall back to static map
  }

  // Use English fallback when chrome.i18n returned the key name (or is unavailable)
  if (msg === messageName && EN_FALLBACK[messageName]) {
    msg = EN_FALLBACK[messageName]!;
  }

  // Apply substitutions for Chrome i18n format ($PLACEHOLDER$) and test strings
  if (substitutions && msg !== messageName) {
    const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
    // Named placeholders like $TASKS$, $STATUS$, etc.
    if (msg.includes('$')) {
      // For Chrome i18n named placeholders, the standard is getMessage(key, [sub1, sub2])
      // and they replace $1, $2 etc. But we use named $PLACEHOLDER$ style.
      // Try named substitutions first
      const namedSubs = msg.match(/\$([A-Z_]+)\$/g);
      if (namedSubs) {
        let i = 0;
        for (const placeholder of namedSubs) {
          const sub = subs[i] !== undefined ? String(subs[i]) : '';
          msg = msg.replace(placeholder, sub);
          i++;
        }
      }
    }
    // Chrome i18n $1, $2, ... positional placeholders
    msg = msg.replace(/\$(\d+)/g, (_, num) => {
      const idx = parseInt(num, 10) - 1;
      return idx < subs.length ? String(subs[idx]) : `$${num}`;
    });
  }

  return msg;
}
