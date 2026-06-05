import type { ChatMessage, ScrapedConversation } from '../shared/types';
import { SELECTORS } from '../shared/constants';

export function scrapeChat(): ScrapedConversation {
  const buyerName = extractBuyerName();
  const messages = extractMessages();
  const chatUrl = window.location.href;

  return { buyerName, messages, chatUrl };
}

function extractBuyerName(): string {
  const el = document.querySelector(SELECTORS.BUYER_NAME);
  return el?.textContent?.trim() || '';
}

function extractMessages(): ChatMessage[] {
  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  if (!container) return [];

  const messages: ChatMessage[] = [];
  let lastTimestamp = '';

  // Walk all descendant elements in document order
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as Element | null;

  while (node) {
    // Update timestamp when we encounter a date separator div
    if (isDateSeparator(node)) {
      const text = node.textContent?.trim();
      if (text) lastTimestamp = text;
      node = walker.nextNode() as Element | null;
      continue;
    }

    // Process message <li> elements
    if (node.tagName === 'LI' && node.classList.contains('ant-list-item')) {
      // Skip system messages (withdraw notices etc.)
      if (node.querySelector(SELECTORS.SYSTEM_MESSAGE)) {
        node = walker.nextNode() as Element | null;
        continue;
      }

      const textWrapper = node.querySelector(SELECTORS.MESSAGE_TEXT);
      if (textWrapper) {
        const contentSpan = textWrapper.querySelector('span');
        const content = contentSpan?.textContent?.trim() || textWrapper.textContent?.trim() || '';
        if (content) {
          const sender = detectSender(node);
          messages.push({ sender, content, timestamp: lastTimestamp });
        }
      }
    }

    node = walker.nextNode() as Element | null;
  }

  return messages;
}

function isDateSeparator(el: Element): boolean {
  if (el.tagName === 'LI') return false;
  return el.matches(SELECTORS.DATE_SEPARATOR) || el.matches('[style*="text-align: center"]');
}

function detectSender(element: Element): ChatMessage['sender'] {
  // Seller messages use message-text-right--<hash> (right-aligned, self)
  if (element.querySelector(SELECTORS.SENT_MESSAGE)) {
    return 'seller';
  }
  // Also check the li's inline style for direction: rtl (used for seller)
  if (element instanceof HTMLElement && element.style.direction === 'rtl') {
    return 'seller';
  }
  // Buyer messages use message-text-left--<hash> (left-aligned, other)
  if (element.querySelector(SELECTORS.RECEIVED_MESSAGE)) {
    return 'buyer';
  }
  // Default to buyer for safety
  return 'buyer';
}
