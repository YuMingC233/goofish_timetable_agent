import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scrapeChat } from '../../src/content/scraper';

function setupChatDOM(): HTMLElement {
  document.body.innerHTML = `
    <div class="chat-container">
      <div class="contact-name">张三</div>
      <div class="message-list">
        <div class="message-item received">
          <div class="msg-content">这个能做吗？周五前要</div>
          <div class="timestamp">2026-06-04 14:30</div>
        </div>
        <div class="message-item sent">
          <div class="msg-content">可以，加急加50</div>
          <div class="timestamp">2026-06-04 14:32</div>
        </div>
        <div class="message-item received">
          <div class="msg-content">OK 拍了</div>
          <div class="timestamp">2026-06-04 14:33</div>
        </div>
      </div>
    </div>
  `;
  return document.body;
}

// Mock window.location
vi.stubGlobal('location', { href: 'https://seller.goofish.com/chat/abc123' });

describe('scrapeChat', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('extracts buyer name from chat header', () => {
    setupChatDOM();
    const result = scrapeChat();
    expect(result.buyerName).toBe('张三');
  });

  it('extracts all chat messages with sender info', () => {
    setupChatDOM();
    const result = scrapeChat();
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0]).toEqual({
      sender: 'buyer',
      content: '这个能做吗？周五前要',
      timestamp: '2026-06-04 14:30',
    });
    expect(result.messages[1]).toEqual({
      sender: 'seller',
      content: '可以，加急加50',
      timestamp: '2026-06-04 14:32',
    });
  });

  it('extracts chat URL', () => {
    setupChatDOM();
    const result = scrapeChat();
    expect(result.chatUrl).toBe('https://seller.goofish.com/chat/abc123');
  });

  it('returns empty buyer name when chat container not found', () => {
    document.body.innerHTML = '<div>No chat here</div>';
    const result = scrapeChat();
    expect(result.buyerName).toBe('');
    expect(result.messages).toHaveLength(0);
  });

  it('returns empty messages array when no messages exist', () => {
    document.body.innerHTML = `
      <div class="chat-container">
        <div class="contact-name">李四</div>
        <div class="message-list"></div>
      </div>
    `;
    const result = scrapeChat();
    expect(result.buyerName).toBe('李四');
    expect(result.messages).toHaveLength(0);
  });
});
