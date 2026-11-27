import { Inquiry, InquiryStatus } from "./domain";

export interface InquiryRepository {
  get(id: string): Promise<Inquiry | null>;
  list(filter?: {
    productId?: string;
    brokerId?: string;
    status?: InquiryStatus;
  }): Promise<Inquiry[]>;
  /** Open inquiries per broker, used for routing. */
  openCountByBroker(): Promise<Map<string, number>>;
  insert(inquiry: Inquiry): Promise<void>;
  update(inquiry: Inquiry): Promise<void>;
}
