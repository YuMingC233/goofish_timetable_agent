import { describe, it, expect } from 'vitest';
import { detectUrgency } from '../../src/shared/urgency-heuristics';

describe('detectUrgency', () => {
  it('returns high for keyword "急"', () => {
    const result = detectUrgency('这个很急，能快点吗');
    expect(result.urgency).toBe('high');
  });

  it('returns high for keyword "尽快"', () => {
    const result = detectUrgency('请尽快完成');
    expect(result.urgency).toBe('high');
  });

  it('returns high for keyword "马上"', () => {
    const result = detectUrgency('马上需要');
    expect(result.urgency).toBe('high');
  });

  it('returns high for keyword "今天"', () => {
    const result = detectUrgency('今天能做完吗');
    expect(result.urgency).toBe('high');
  });

  it('returns high for keyword "明天"', () => {
    const result = detectUrgency('明天下午之前');
    expect(result.urgency).toBe('high');
  });

  it('returns high for deadline within 48 hours', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const result = detectUrgency('请做好', tomorrow.toISOString());
    expect(result.urgency).toBe('high');
  });

  it('returns medium for keyword "这周"', () => {
    const result = detectUrgency('这周内完成就行');
    expect(result.urgency).toBe('medium');
  });

  it('returns medium for deadline within 7 days', () => {
    const in5Days = new Date();
    in5Days.setDate(in5Days.getDate() + 5);
    const result = detectUrgency('不急不慢', in5Days.toISOString());
    expect(result.urgency).toBe('medium');
  });

  it('returns low for keyword "不急"', () => {
    const result = detectUrgency('不急，有空再做');
    expect(result.urgency).toBe('low');
  });

  it('returns low when no time pressure is mentioned', () => {
    const result = detectUrgency('你看着办吧');
    expect(result.urgency).toBe('low');
  });

  it('returns low for null deadline with no keywords', () => {
    const result = detectUrgency('随便什么时候');
    expect(result.urgency).toBe('low');
  });

  it('includes reason in output', () => {
    const result = detectUrgency('这个很急');
    expect(result.reason).toContain('急');
  });
});
