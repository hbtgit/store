/** JSON shapes returned by this app's API (dates arrive as ISO strings). */
import type { Broker } from "@/modules/brokers/domain";
import type { BrokerSummary, Deal } from "@/modules/deals/domain";
import type { Inquiry } from "@/modules/inquiries/domain";
import type { Listing } from "@/modules/vehicles/domain";

type Json<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K];
};

export type BrokerDto = Json<Broker>;
export type ListingDto = Json<Listing>;
export type InquiryDto = Json<Inquiry>;
export type DealDto = Json<Deal>;
export type BrokerSummaryDto = BrokerSummary;
