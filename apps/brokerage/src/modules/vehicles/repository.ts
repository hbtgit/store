import { Listing } from "./domain";

export interface ListingRepository {
  get(productId: string): Promise<Listing | null>;
  getByVin(vin: string): Promise<Listing | null>;
  list(filter?: { status?: Listing["status"]; brokerId?: string }): Promise<Listing[]>;
  insert(listing: Listing): Promise<void>;
  update(listing: Listing): Promise<void>;
}
