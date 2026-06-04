import { scrapeChat } from './scraper';
import type { BackgroundMessage, BackgroundResponse, ExtractedTask, ConflictResult, ScheduledTask } from '../shared/types';

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

// Send message to background service worker
async function sendMessage<T = unknown>(
  type: BackgroundMessage['type'],
  payload: unknown,
): Promise<BackgroundResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response: BackgroundResponse<T>) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

// Main flow: scrape → extract → show in panel
async function handleFloatingBallClick(): Promise<void> {
  const conversation = scrapeChat();
  if (!conversation.messages.length) {
    console.warn('[Goofish Agent] No messages found in current chat');
    return;
  }

  const chatText = conversation.messages
    .map((m) => `${m.sender === 'buyer' ? 'Buyer' : 'Seller'}: ${m.content}`)
    .join('\n');

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

// Initialize on load
const root = injectRoot();
console.log('[Goofish Agent] Content script loaded, root mounted');
