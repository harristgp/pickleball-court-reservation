import { Prisma } from '@prisma/client';

export const CURRENCY_SYMBOL = '₱'; // PHP peso

/**
 * Prisma Decimal values cannot cross the server/client boundary, and floats
 * cannot represent money. Everything user-facing goes through these helpers so
 * a Decimal is converted exactly once, at the edge, in a single place.
 */
export function decimalToNumber(value: Prisma.Decimal | number | string): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseFloat(value);
  return value.toNumber();
}

export function formatMoney(value: Prisma.Decimal | number | string): string {
  const amount = decimalToNumber(value);
  return `${CURRENCY_SYMBOL}${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
