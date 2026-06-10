import { scrapeChat } from './scraper';
import type { BackgroundMessage, BackgroundResponse, ExtractedTask, ConflictResult, ScheduledTask } from '../shared/types';
import { formatChatForAI } from '../shared/prompts';
import { t } from '../shared/i18n';
import { FloatingBall } from './floating-ball';
import { PopupPanel } from './popup-panel';

// Inject widget root into page
function injectRoot(): HTMLElement {
  let root = document.getElementById('goofish-agent-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'goofish-agent-root';
    document.body.appendChild(root);
  }
  return root;
}

// Check if extension context is still valid
function isExtensionValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

// Send message to background service worker
async function sendMessage<T = unknown>(
  type: BackgroundMessage['type'],
  payload: unknown,
): Promise<BackgroundResponse<T>> {
  if (!isExtensionValid()) {
    return { success: false, error: t('statusContextInvalid') };
  }
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type, payload }, (response: BackgroundResponse<T>) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      resolve({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}

// Main flow: scrape → extract → show in panel
async function handleFloatingBallClick(): Promise<void> {
  const conversation = scrapeChat();
  if (!conversation.messages.length) {
    console.warn('[Goofish Agent] No messages found in current chat');
    return;
  }

  // Show loading state immediately
  document.dispatchEvent(new CustomEvent('goofish:analyzing'));

  // Format with timestamps and sender names for AI
  const chatText = formatChatForAI(conversation);

  const response = await sendMessage<ExtractedTask>('EXTRACT_TASK', {
    chatMessages: chatText,
    chatUrl: conversation.chatUrl,
  });

  if (response.success && response.data) {
    // Store extracted task temporarily for popup panel to render
    window.__goofishPendingTask = { ...response.data, chatUrl: conversation.chatUrl };
    // Dispatch custom event for popup panel to pick up
    document.dispatchEvent(new CustomEvent('goofish:taskExtracted'));
  } else {
    console.error('[Goofish Agent] Extraction failed:', response.error);
    // Show the error and inline settings in the popup panel
    const errorMsg = response.error || 'Unknown error';
    document.dispatchEvent(
      new CustomEvent('goofish:extractionFailed', { detail: { error: errorMsg } }),
    );
  }
}

// Expose for floating ball component
export { injectRoot, handleFloatingBallClick, sendMessage };

// Extend Window interface
declare global {
  interface Window {
    __goofishPendingTask?: ExtractedTask & { chatUrl: string };
  }
}

// Initialize UI on load
const root = injectRoot();

const popup = new PopupPanel();
popup.mount(root);

const ball = new FloatingBall();
ball.mount(root);
ball.setBadge(0);

ball.onBallClick(() => {
  ball.setLoading(true);
  handleFloatingBallClick().finally(() => {
    ball.setLoading(false);
  });
});

ball.onGenerateClick(() => {
  ball.setLoading(true);
  handleFloatingBallClick().finally(() => {
    ball.setLoading(false);
  });
});

ball.onConfigClick(() => {
  // Show the popup panel with settings form
  document.dispatchEvent(
    new CustomEvent('goofish:extractionFailed', { detail: { error: t('statusEnvConfig') } }),
  );
});

document.addEventListener('goofish:reanalyze', () => {
  ball.setLoading(true);
  handleFloatingBallClick().finally(() => {
    ball.setLoading(false);
  });
});

console.log('[Goofish Agent] Content script initialized — floating ball + popup panel ready');
