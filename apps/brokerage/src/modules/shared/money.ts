import { ValidationError } from "./errors";

/**
 * Money is stored as integer minor units (cents) to avoid floating point drift.
 * Commission rates are stored as integer basis points (1% = 100 bp).
 */
export type Cents = number;
export type BasisPoints = number;

export const MAX_RATE_BP = 10_000;

export function assertCents(value: number, field: string): Cents {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative integer amount in cents`);
  }
  return value;
}

export function assertRate(value: number, field = "commissionRateBp"): BasisPoints {
  if (!Number.isInteger(value) || value < 0 || value > MAX_RATE_BP) {
    throw new ValidationError(
      `${field} must be an integer between 0 and ${MAX_RATE_BP} basis points`
    );
  }
  return value;
}

/** Converts a decimal amount such as 12999.95 (as Saleor returns it) to cents. */
export function toCents(amount: number): Cents {
  return Math.round(amount * 100);
}

export function fromCents(cents: Cents): number {
  return cents / 100;
}

/** Percentage of an amount, rounded half up to the nearest cent. */
export function applyRate(amount: Cents, rateBp: BasisPoints): Cents {
  return Math.floor((amount * rateBp + 5_000) / 10_000);
}
