import { Deal } from "./domain";

export interface DealRepository {
  get(id: string): Promise<Deal | null>;
  getByProduct(productId: string): Promise<Deal | null>;
  getBySaleorOrder(orderId: string): Promise<Deal | null>;
  list(filter?: { brokerId?: string; commissionPaid?: boolean }): Promise<Deal[]>;
  insert(deal: Deal): Promise<void>;
  update(deal: Deal): Promise<void>;
}
