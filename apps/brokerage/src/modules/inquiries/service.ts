import { BrokerRepository } from "../brokers/repository";
import { NotFoundError, ValidationError } from "../shared/errors";
import { newId } from "../shared/ids";
import { assertCents, Cents } from "../shared/money";
import { isOpenForInquiries } from "../vehicles/domain";
import { VehicleService } from "../vehicles/service";
import { assertInquiryTransition, Inquiry, InquiryKind, InquiryStatus } from "./domain";
import { InquiryRepository } from "./repository";
import { routeInquiry } from "./routing";

export interface SubmitInquiryInput {
  productId: string;
  kind: InquiryKind;
  customerId?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  message?: string | null;
  offerCents?: Cents | null;
  preferredDate?: string | null;
}

export class InquiryService {
  constructor(
    private readonly inquiries: InquiryRepository,
    private readonly brokers: BrokerRepository,
    private readonly vehicles: VehicleService,
    private readonly now: () => Date = () => new Date()
  ) {}

  /** Called by the storefront. Validates, flags low offers and routes to a broker. */
  async submit(input: SubmitInquiryInput): Promise<Inquiry> {
    const listing = await this.vehicles.get(input.productId);
    if (!isOpenForInquiries(listing.status)) {
      throw new ValidationError("This vehicle is not available");
    }

    const contactName = input.contactName.trim();
    const contactEmail = input.contactEmail.trim().toLowerCase();
    if (!contactName) throw new ValidationError("Name is required");
    if (!/^[^@\s]+@[^@\s]+$/.test(contactEmail)) throw new ValidationError("Email is invalid");

    let offerCents: Cents | null = null;
    if (input.kind === "offer") {
      if (input.offerCents == null || input.offerCents <= 0) {
        throw new ValidationError("An offer needs an amount");
      }
      offerCents = assertCents(input.offerCents, "offerCents");
    }
    if (input.kind === "test_drive" && !input.preferredDate) {
      throw new ValidationError("A test drive request needs a preferred date");
    }
    if (input.kind === "question" && !input.message?.trim()) {
      throw new ValidationError("A question needs a message");
    }

    const brokerId = routeInquiry(
      listing,
      await this.brokers.list({ active: true }),
      await this.inquiries.openCountByBroker()
    );

    const at = this.now();
    const inquiry: Inquiry = {
      id: newId(),
      productId: listing.productId,
      kind: input.kind,
      status: "new",
      customerId: input.customerId ?? null,
      contactName,
      contactEmail,
      contactPhone: input.contactPhone?.trim() || null,
      message: input.message?.trim() || null,
      offerCents,
      preferredDate: input.kind === "test_drive" ? input.preferredDate ?? null : null,
      belowMinimum:
        offerCents != null &&
        listing.minimumPriceCents != null &&
        offerCents < listing.minimumPriceCents,
      brokerId,
      createdAt: at,
      updatedAt: at,
    };
    await this.inquiries.insert(inquiry);
    return inquiry;
  }

  async get(id: string): Promise<Inquiry> {
    const inquiry = await this.inquiries.get(id);
    if (!inquiry) throw new NotFoundError("Inquiry", id);
    return inquiry;
  }

  list(filter?: { productId?: string; brokerId?: string; status?: InquiryStatus }) {
    return this.inquiries.list(filter);
  }

  /**
   * Moves an inquiry through its workflow. Accepting an offer reserves the
   * vehicle so no one else can buy it while the deal is finalised.
   */
  async changeStatus(id: string, to: InquiryStatus): Promise<Inquiry> {
    const inquiry = await this.get(id);
    assertInquiryTransition(inquiry, to);

    if (to === "accepted") {
      const listing = await this.vehicles.get(inquiry.productId);
      if (listing.status === "listed")
        await this.vehicles.changeStatus(listing.productId, "reserved");
      else if (listing.status !== "reserved")
        throw new ValidationError("This vehicle is no longer available");
    }

    const next = { ...inquiry, status: to, updatedAt: this.now() };
    await this.inquiries.update(next);
    return next;
  }

  async reassign(id: string, brokerId: string): Promise<Inquiry> {
    const inquiry = await this.get(id);
    const broker = await this.brokers.get(brokerId);
    if (!broker) throw new NotFoundError("Broker", brokerId);
    if (!broker.active) throw new ValidationError("Broker is not active");
    const next = { ...inquiry, brokerId, updatedAt: this.now() };
    await this.inquiries.update(next);
    return next;
  }
}
