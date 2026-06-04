import { describe, it, expect } from 'vitest';
import { calculatePrice } from '../../src/shared/price-calculator';

describe('calculatePrice', () => {
  const basePrice = 300;

  it('high urgency: uses max(scraped, base * 1.3)', () => {
    expect(calculatePrice(200, 'high', basePrice)).toBe(390); // 300 * 1.3 > 200
    expect(calculatePrice(500, 'high', basePrice)).toBe(500); // 500 > 390
  });

  it('medium urgency: uses max(scraped, base * 1.0)', () => {
    expect(calculatePrice(200, 'medium', basePrice)).toBe(300);
    expect(calculatePrice(400, 'medium', basePrice)).toBe(400);
  });

  it('low urgency: uses max(scraped, base * 0.9)', () => {
    expect(calculatePrice(200, 'low', basePrice)).toBe(270);
    expect(calculatePrice(300, 'low', basePrice)).toBe(300);
  });

  it('handles null scraped price', () => {
    expect(calculatePrice(null, 'high', basePrice)).toBe(390);
    expect(calculatePrice(null, 'medium', basePrice)).toBe(300);
    expect(calculatePrice(null, 'low', basePrice)).toBe(270);
  });
});
