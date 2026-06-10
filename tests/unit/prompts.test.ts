import { describe, it, expect } from 'vitest';
import { buildPrompt, formatChatForAI } from '../../src/shared/prompts';
import type { ScrapedConversation } from '../../src/shared/types';

describe('buildPrompt', () => {
  it('should embed chat messages in the prompt template', () => {
    const messages = 'Buyer: 这个能做吗？周五前\nSeller: 可以，加急+50';
    const result = buildPrompt(messages);

    expect(result).toContain('Buyer: 这个能做吗？周五前');
    expect(result).toContain('scheduling assistant');
    expect(result).toContain('buyerName');
    expect(result).toContain('urgency');
  });

  it('should handle empty messages', () => {
    const result = buildPrompt('');
    expect(result).toContain('{chat_messages}');
  });
});

describe('formatChatForAI', () => {
  it('formats conversation with timestamps and sender names', () => {
    const conversation: ScrapedConversation = {
      buyerName: 'Se7eN丶丶',
      chatUrl: 'https://www.goofish.com/im?userId=123',
      messages: [
        { sender: 'buyer', senderName: 'Se7eN丶丶', content: '这个能做吗？', timestamp: '06-03 21:50' },
        { sender: 'seller', senderName: '写程序高手Connor', content: '你说下需求呢', timestamp: '06-03 21:55' },
        { sender: 'buyer', senderName: 'Se7eN丶丶', content: '想让codex帮我操作', timestamp: '昨天 10:05' },
      ],
    };

    const result = formatChatForAI(conversation);

    // Buyer name header
    expect(result).toContain('Buyer: Se7eN丶丶');
    // Each message has timestamp, name, and content
    expect(result).toContain('[06-03 21:50] Se7eN丶丶: 这个能做吗？');
    expect(result).toContain('[06-03 21:55] 写程序高手Connor: 你说下需求呢');
    expect(result).toContain('[昨天 10:05] Se7eN丶丶: 想让codex帮我操作');
  });

  it('falls back to Buyer/Seller label when senderName is empty', () => {
    const conversation: ScrapedConversation = {
      buyerName: 'TestBuyer',
      chatUrl: 'https://example.com',
      messages: [
        { sender: 'buyer', senderName: '', content: 'hello', timestamp: 'now' },
        { sender: 'seller', senderName: '', content: 'hi', timestamp: 'now' },
      ],
    };

    const result = formatChatForAI(conversation);

    expect(result).toContain('[now] Buyer: hello');
    expect(result).toContain('[now] Seller: hi');
  });
});
