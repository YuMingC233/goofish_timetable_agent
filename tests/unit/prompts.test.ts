import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../../src/shared/prompts';

describe('buildPrompt', () => {
  it('should embed chat messages in the prompt template', () => {
    const messages = 'Buyer: 这个能做吗？周五前\nSeller: 可以，加急+50';
    const result = buildPrompt(messages);

    expect(result).toContain('Buyer: 这个能做吗？周五前');
    expect(result).toContain('排期助手');
    expect(result).toContain('buyerName');
    expect(result).toContain('urgency');
  });

  it('should handle empty messages', () => {
    const result = buildPrompt('');
    expect(result).toContain('{chat_messages}');
  });
});
