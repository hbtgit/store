import { z } from "zod";

import { INQUIRY_KINDS, INQUIRY_STATUSES } from "@/modules/inquiries/domain";
import { LISTING_STATUSES, SUPPLY_TYPES } from "@/modules/vehicles/domain";

/** Request body schemas shared by API routes. Amounts are integer cents. */
const cents = z.number().int().nonnegative();
const id = z.string().min(1);

export const createBrokerBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  defaultCommissionRateBp: z.number().int().min(0).max(10_000),
  saleorUserId: id.nullish(),
});

export const updateBrokerBody = z.object({
  name: z.string().min(1).optional(),
  defaultCommissionRateBp: z.number().int().min(0).max(10_000).optional(),
  active: z.boolean().optional(),
  saleorUserId: id.nullish(),
});

export const registerVehicleBody = z.object({
  name: z.string().optional(),
  vin: z.string(),
  specs: z.object({
    make: z.string().min(1),
    model: z.string().min(1),
    year: z
      .number()
      .int()
      .min(1886)
      .max(new Date().getFullYear() + 1),
    mileageKm: z.number().int().nonnegative(),
    bodyType: z.string().optional(),
    fuelType: z.string().optional(),
    transmission: z.string().optional(),
    exteriorColor: z.string().optional(),
    condition: z.string().optional(),
  }),
  askingPriceCents: cents,
  minimumPriceCents: cents.nullish(),
  supplyType: z.enum(SUPPLY_TYPES),
  sellerCustomerId: id.nullish(),
  brokerId: id.nullish(),
});

export const updateListingBody = z.object({
  supplyType: z.enum(SUPPLY_TYPES).optional(),
  sellerCustomerId: id.nullish(),
  brokerId: id.nullish(),
  minimumPriceCents: cents.nullish(),
});

export const listingStatusBody = z.object({ status: z.enum(LISTING_STATUSES) });

export const submitInquiryBody = z.object({
  productId: id,
  kind: z.enum(INQUIRY_KINDS),
  customerId: id.nullish(),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(50).nullish(),
  message: z.string().max(5_000).nullish(),
  offerCents: cents.nullish(),
  preferredDate: z.string().max(50).nullish(),
});

export const inquiryStatusBody = z.object({ status: z.enum(INQUIRY_STATUSES) });
export const assignBody = z.object({ brokerId: id });

export const closeDealBody = z.object({
  productId: id,
  salePriceCents: cents,
  currency: z.string().length(3).toUpperCase(),
  buyerCustomerId: id.nullish(),
  inquiryId: id.nullish(),
  brokerId: id.nullish(),
  commissionRateBp: z.number().int().min(0).max(10_000).nullish(),
});

export const commissionPaidBody = z.object({ paid: z.boolean().default(true) });
