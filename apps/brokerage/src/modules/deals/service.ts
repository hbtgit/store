import { BrokerRepository } from "../brokers/repository";
import { InquiryRepository } from "../inquiries/repository";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors";
import { newId } from "../shared/ids";
import { assertCents, assertRate, Cents } from "../shared/money";
import { VehicleService } from "../vehicles/service";
import { Deal, settle, summarize } from "./domain";
import { DealRepository } from "./repository";

export interface CloseDealInput {
  productId: string;
  salePriceCents: Cents;
  currency: string;
  buyerCustomerId?: string | null;
  inquiryId?: string | null;
  saleorOrderId?: string | null;
  /** Defaults to the vehicle's broker, then the inquiry's broker. */
  brokerId?: string | null;
  /** Defaults to the broker's default rate. */
  commissionRateBp?: number | null;
}

export class DealService {
  constructor(
    private readonly deals: DealRepository,
    private readonly brokers: BrokerRepository,
    private readonly inquiries: InquiryRepository,
    private readonly vehicles: VehicleService,
    private readonly now: () => Date = () => new Date()
  ) {}

  async close(input: CloseDealInput): Promise<Deal> {
    if (input.saleorOrderId) {
      const existing = await this.deals.getBySaleorOrder(input.saleorOrderId);
      if (existing) return existing; // webhook redelivery
    }
    assertCents(input.salePriceCents, "salePriceCents");
    if (input.salePriceCents === 0)
      throw new ValidationError("Sale price must be greater than zero");
    if (!/^[A-Z]{3}$/.test(input.currency))
      throw new ValidationError("Currency must be an ISO 4217 code");

    const listing = await this.vehicles.get(input.productId);
    if (listing.status !== "listed" && listing.status !== "reserved") {
      throw new ValidationError(`Cannot close a deal on a ${listing.status} vehicle`);
    }
    if (await this.deals.getByProduct(listing.productId)) {
      throw new ConflictError("This vehicle already has a deal");
    }

    const inquiry = input.inquiryId ? await this.inquiries.get(input.inquiryId) : null;
    if (input.inquiryId && !inquiry) throw new NotFoundError("Inquiry", input.inquiryId);
    if (inquiry && inquiry.productId !== listing.productId) {
      throw new ValidationError("The inquiry is for a different vehicle");
    }

    const brokerId = input.brokerId ?? listing.brokerId ?? inquiry?.brokerId ?? null;
    if (!brokerId) throw new ValidationError("Assign a broker before closing the deal");
    const broker = await this.brokers.get(brokerId);
    if (!broker) throw new NotFoundError("Broker", brokerId);

    const commissionRateBp = assertRate(input.commissionRateBp ?? broker.defaultCommissionRateBp);
    const { commissionCents, sellerPayoutCents } = settle({
      supplyType: listing.supplyType,
      salePriceCents: input.salePriceCents,
      commissionRateBp,
    });

    const deal: Deal = {
      id: newId(),
      productId: listing.productId,
      vin: listing.vin,
      inquiryId: inquiry?.id ?? null,
      saleorOrderId: input.saleorOrderId ?? null,
      buyerCustomerId: input.buyerCustomerId ?? inquiry?.customerId ?? null,
      sellerCustomerId: listing.sellerCustomerId,
      supplyType: listing.supplyType,
      brokerId,
      salePriceCents: input.salePriceCents,
      currency: input.currency,
      commissionRateBp,
      commissionCents,
      sellerPayoutCents,
      closedAt: this.now(),
      commissionPaidAt: null,
    };
    await this.deals.insert(deal);
    await this.vehicles.changeStatus(listing.productId, "sold");
    // The vehicle is gone, so every inquiry about it is settled.
    for (const open of await this.inquiries.list({ productId: listing.productId })) {
      if (open.status !== "closed") {
        await this.inquiries.update({ ...open, status: "closed", updatedAt: this.now() });
      }
    }
    return deal;
  }

  async markCommissionPaid(id: string, paid = true): Promise<Deal> {
    const deal = await this.get(id);
    const next = { ...deal, commissionPaidAt: paid ? deal.commissionPaidAt ?? this.now() : null };
    await this.deals.update(next);
    return next;
  }

  async get(id: string): Promise<Deal> {
    const deal = await this.deals.get(id);
    if (!deal) throw new NotFoundError("Deal", id);
    return deal;
  }

  list(filter?: { brokerId?: string; commissionPaid?: boolean }) {
    return this.deals.list(filter);
  }

  async brokerSummary() {
    const [deals, brokers] = await Promise.all([this.deals.list(), this.brokers.list()]);
    return summarize(deals, new Map(brokers.map((b) => [b.id, b.name])));
  }
}
