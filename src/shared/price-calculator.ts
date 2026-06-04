import type { Urgency } from './types';

const URGENCY_MULTIPLIERS: Record<Urgency, number> = {
  high: 1.3,
  medium: 1.0,
  low: 0.9,
};

/**
 * Calculate suggested price based on urgency and base price.
 * Rule: price = max(scraped_price, base_price * urgency_multiplier)
 */
export function calculatePrice(
  scrapedPrice: number | null,
  urgency: Urgency,
  basePrice: number,
): number {
  const multiplier = URGENCY_MULTIPLIERS[urgency];
  const computedPrice = Math.round(basePrice * multiplier);
  if (scrapedPrice === null) {
    return computedPrice;
  }
  return Math.max(scrapedPrice, computedPrice);
}
