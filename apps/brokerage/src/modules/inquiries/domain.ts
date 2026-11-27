import { ValidationError } from "../shared/errors";
import { Cents } from "../shared/money";

export const INQUIRY_KINDS = ["question", "test_drive", "offer"] as const;
export type InquiryKind = (typeof INQUIRY_KINDS)[number];

export const INQUIRY_STATUSES = [
  "new",
  "contacted",
  "scheduled",
  "accepted",
  "rejected",
  "closed",
] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export interface Inquiry {
  id: string;
  productId: string;
  kind: InquiryKind;
  status: InquiryStatus;
  /** Saleor customer id when the buyer is signed in on the storefront. */
  customerId: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  message: string | null;
  offerCents: Cents | null;
  preferredDate: string | null;
  /** True when an offer is below the seller's private minimum price. */
  belowMinimum: boolean;
  brokerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const OPEN_STATUSES: readonly InquiryStatus[] = ["new", "contacted", "scheduled"];

const TRANSITIONS: Record<InquiryStatus, readonly InquiryStatus[]> = {
  new: ["contacted", "scheduled", "accepted", "rejected", "closed"],
  contacted: ["scheduled", "accepted", "rejected", "closed"],
  scheduled: ["closed"],
  accepted: ["closed"],
  rejected: ["closed"],
  closed: [],
};

export function assertInquiryTransition(
  inquiry: Pick<Inquiry, "kind" | "status">,
  to: InquiryStatus
) {
  if (!TRANSITIONS[inquiry.status].includes(to)) {
    throw new ValidationError(`Cannot move an inquiry from ${inquiry.status} to ${to}`);
  }
  if (to === "scheduled" && inquiry.kind !== "test_drive") {
    throw new ValidationError("Only test drive requests can be scheduled");
  }
  if ((to === "accepted" || to === "rejected") && inquiry.kind !== "offer") {
    throw new ValidationError("Only offers can be accepted or rejected");
  }
}

/** Statuses an inquiry can move to next, given its kind. */
export function nextInquiryStatuses(inquiry: Pick<Inquiry, "kind" | "status">): InquiryStatus[] {
  return TRANSITIONS[inquiry.status].filter((to) => {
    if (to === "scheduled") return inquiry.kind === "test_drive";
    if (to === "accepted" || to === "rejected") return inquiry.kind === "offer";
    return true;
  });
}
