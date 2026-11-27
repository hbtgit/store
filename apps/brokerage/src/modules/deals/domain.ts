import { applyRate, BasisPoints, Cents } from "../shared/money";
import { SupplyType } from "../vehicles/domain";

export interface Deal {
  id: string;
  productId: string;
  vin: string;
  inquiryId: string | null;
  saleorOrderId: string | null;
  buyerCustomerId: string | null;
  sellerCustomerId: string | null;
  supplyType: SupplyType;
  brokerId: string;
  salePriceCents: Cents;
  currency: string;
  /** Snapshot of the rate at closing, so later rate changes don't rewrite history. */
  commissionRateBp: BasisPoints;
  commissionCents: Cents;
  /** What the consigning seller receives. Null for dealer stock. */
  sellerPayoutCents: Cents | null;
  closedAt: Date;
  commissionPaidAt: Date | null;
}

export function settle(input: {
  supplyType: SupplyType;
  salePriceCents: Cents;
  commissionRateBp: BasisPoints;
}): { commissionCents: Cents; sellerPayoutCents: Cents | null } {
  const commissionCents = applyRate(input.salePriceCents, input.commissionRateBp);
  return {
    commissionCents,
    sellerPayoutCents:
      input.supplyType === "consignment" ? input.salePriceCents - commissionCents : null,
  };
}

export interface BrokerSummary {
  brokerId: string;
  brokerName: string;
  currency: string;
  deals: number;
  salesCents: Cents;
  commissionCents: Cents;
  commissionPaidCents: Cents;
  commissionOutstandingCents: Cents;
}

/** Totals per broker and currency. */
export function summarize(deals: Deal[], brokerNames: Map<string, string>): BrokerSummary[] {
  const rows = new Map<string, BrokerSummary>();
  for (const deal of deals) {
    const key = `${deal.brokerId}:${deal.currency}`;
    const row =
      rows.get(key) ??
      ({
        brokerId: deal.brokerId,
        brokerName: brokerNames.get(deal.brokerId) ?? deal.brokerId,
        currency: deal.currency,
        deals: 0,
        salesCents: 0,
        commissionCents: 0,
        commissionPaidCents: 0,
        commissionOutstandingCents: 0,
      } satisfies BrokerSummary);
    row.deals += 1;
    row.salesCents += deal.salePriceCents;
    row.commissionCents += deal.commissionCents;
    if (deal.commissionPaidAt) row.commissionPaidCents += deal.commissionCents;
    else row.commissionOutstandingCents += deal.commissionCents;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.commissionCents - a.commissionCents);
}
