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

  const messageElements = container.querySelectorAll(SELECTORS.CHAT_MESSAGE);
  const messages: ChatMessage[] = [];

  for (const el of messageElements) {
    const contentEl = el.querySelector(SELECTORS.MESSAGE_TEXT);
    const timeEl = el.querySelector(SELECTORS.MESSAGE_TIME);
    const content = contentEl?.textContent?.trim() || '';
    const timestamp = timeEl?.textContent?.trim() || '';

    if (!content) continue;

    const sender = detectSender(el);
    messages.push({ sender, content, timestamp });
  }

  return messages;
}

function detectSender(element: Element): ChatMessage['sender'] {
  if (element.matches(SELECTORS.SENT_MESSAGE) || element.querySelector(SELECTORS.SENT_MESSAGE)) {
    return 'seller';
  }
  if (element.matches(SELECTORS.RECEIVED_MESSAGE) || element.querySelector(SELECTORS.RECEIVED_MESSAGE)) {
    return 'buyer';
  }
  return 'buyer';
}
