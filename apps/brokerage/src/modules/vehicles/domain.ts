import { ValidationError } from "../shared/errors";
import { Cents } from "../shared/money";

/**
 * A vehicle is a Saleor product of the "Vehicle" product type (specs live in
 * Saleor attributes, the asking price in the variant's channel listing, and
 * the VIN is the variant SKU, which Saleor keeps unique).
 *
 * Brokerage data that must never reach the storefront (minimum price, seller,
 * assigned broker) and the listing workflow status live in this app's
 * database, keyed by the Saleor product id.
 */
export const LISTING_STATUSES = ["draft", "listed", "reserved", "withdrawn", "sold"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const SUPPLY_TYPES = ["dealer_stock", "consignment"] as const;
export type SupplyType = (typeof SUPPLY_TYPES)[number];

export interface Listing {
  productId: string;
  vin: string;
  status: ListingStatus;
  supplyType: SupplyType;
  /** Saleor customer (user) id of the consigning seller. Required for consignment. */
  sellerCustomerId: string | null;
  brokerId: string | null;
  /** Lowest price the seller accepts. Private, used to flag offers. */
  minimumPriceCents: Cents | null;
  createdAt: Date;
  updatedAt: Date;
}

const TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ["listed", "withdrawn"],
  listed: ["reserved", "withdrawn", "sold"],
  reserved: ["listed", "withdrawn", "sold"],
  withdrawn: ["draft", "listed"],
  sold: [],
};

export function allowedTransitions(from: ListingStatus): readonly ListingStatus[] {
  return TRANSITIONS[from];
}

export function assertTransition(from: ListingStatus, to: ListingStatus): void {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) {
    throw new ValidationError(`Cannot move a vehicle from ${from} to ${to}`);
  }
}

/** Statuses in which buyers can see the vehicle and send inquiries. */
export const isOpenForInquiries = (status: ListingStatus) =>
  status === "listed" || status === "reserved";

/** How a status is reflected on the Saleor channel listing. */
export function saleorVisibility(status: ListingStatus): {
  isPublished: boolean;
  isAvailableForPurchase: boolean;
} {
  switch (status) {
    case "listed":
      return { isPublished: true, isAvailableForPurchase: true };
    case "reserved":
      return { isPublished: true, isAvailableForPurchase: false };
    default:
      return { isPublished: false, isAvailableForPurchase: false };
  }
}

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Normalizes and validates a 17 character VIN (letters I, O and Q are not allowed). */
export function normalizeVin(raw: string): string {
  const vin = raw.trim().toUpperCase();
  if (!VIN_PATTERN.test(vin)) {
    throw new ValidationError(
      "VIN must be 17 characters, using digits and letters except I, O and Q"
    );
  }
  return vin;
}

const TRANSLITERATION: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * North American VINs carry a check digit at position 9. Other markets do not,
 * so this is exposed as an optional check rather than enforced.
 */
export function hasValidCheckDigit(vin: string): boolean {
  const sum = [...vin].reduce((acc, ch, i) => {
    const value = /\d/.test(ch) ? Number(ch) : TRANSLITERATION[ch];
    return acc + (value ?? 0) * WEIGHTS[i];
  }, 0);
  const remainder = sum % 11;
  return vin[8] === (remainder === 10 ? "X" : String(remainder));
}

export function validateListing(listing: Pick<Listing, "supplyType" | "sellerCustomerId">): void {
  if (listing.supplyType === "consignment" && !listing.sellerCustomerId) {
    throw new ValidationError("A consignment vehicle needs a seller");
  }
}
