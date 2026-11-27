import { BrokerRepository } from "../brokers/repository";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors";
import { assertCents, Cents } from "../shared/money";
import { VehicleCatalog, VehicleSpecs } from "./catalog";
import {
  assertTransition,
  Listing,
  ListingStatus,
  normalizeVin,
  saleorVisibility,
  SupplyType,
  validateListing,
} from "./domain";
import { ListingRepository } from "./repository";

export interface RegisterVehicleInput {
  name?: string;
  vin: string;
  specs: VehicleSpecs;
  askingPriceCents: Cents;
  minimumPriceCents?: Cents | null;
  supplyType: SupplyType;
  sellerCustomerId?: string | null;
  brokerId?: string | null;
}

export interface UpdateListingInput {
  supplyType?: SupplyType;
  sellerCustomerId?: string | null;
  brokerId?: string | null;
  minimumPriceCents?: Cents | null;
}

export class VehicleService {
  constructor(
    private readonly listings: ListingRepository,
    private readonly brokers: BrokerRepository,
    private readonly catalog: VehicleCatalog,
    private readonly now: () => Date = () => new Date()
  ) {}

  /** Creates the Saleor product and its draft listing in one step. */
  async register(input: RegisterVehicleInput): Promise<Listing> {
    const vin = normalizeVin(input.vin);
    assertCents(input.askingPriceCents, "askingPriceCents");
    if (input.minimumPriceCents != null) assertCents(input.minimumPriceCents, "minimumPriceCents");
    validateListing({
      supplyType: input.supplyType,
      sellerCustomerId: input.sellerCustomerId ?? null,
    });
    await this.assertBroker(input.brokerId ?? null);
    if (await this.listings.getByVin(vin)) {
      throw new ConflictError(`A vehicle with VIN ${vin} already exists`);
    }

    const name =
      input.name?.trim() || `${input.specs.year} ${input.specs.make} ${input.specs.model}`;
    const { productId } = await this.catalog.createVehicle({
      name,
      vin,
      specs: input.specs,
      askingPriceCents: input.askingPriceCents,
    });

    const at = this.now();
    const listing: Listing = {
      productId,
      vin,
      status: "draft",
      supplyType: input.supplyType,
      sellerCustomerId: input.sellerCustomerId ?? null,
      brokerId: input.brokerId ?? null,
      minimumPriceCents: input.minimumPriceCents ?? null,
      createdAt: at,
      updatedAt: at,
    };
    await this.listings.insert(listing);
    return listing;
  }

  /**
   * Returns the listing for a Saleor product, creating a draft listing for
   * vehicles that were added directly in the Saleor dashboard.
   */
  async getOrImport(productId: string): Promise<Listing> {
    const existing = await this.listings.get(productId);
    if (existing) return existing;

    const vehicle = await this.catalog.getVehicle(productId);
    if (!vehicle || !vehicle.isVehicle) throw new NotFoundError("Vehicle", productId);
    if (!vehicle.vin)
      throw new ValidationError("Set the VIN as the variant SKU before managing this vehicle");
    const vin = normalizeVin(vehicle.vin);
    const clash = await this.listings.getByVin(vin);
    if (clash) throw new ConflictError(`VIN ${vin} already belongs to product ${clash.productId}`);

    const at = this.now();
    const listing: Listing = {
      productId,
      vin,
      status: "draft",
      supplyType: "dealer_stock",
      sellerCustomerId: null,
      brokerId: null,
      minimumPriceCents: null,
      createdAt: at,
      updatedAt: at,
    };
    await this.listings.insert(listing);
    return listing;
  }

  async get(productId: string): Promise<Listing> {
    const listing = await this.listings.get(productId);
    if (!listing) throw new NotFoundError("Vehicle", productId);
    return listing;
  }

  list(filter?: { status?: ListingStatus; brokerId?: string }) {
    return this.listings.list(filter);
  }

  async update(productId: string, patch: UpdateListingInput): Promise<Listing> {
    const listing = await this.getOrImport(productId);
    if (listing.status === "sold") throw new ValidationError("A sold vehicle cannot be changed");
    if (patch.minimumPriceCents != null) assertCents(patch.minimumPriceCents, "minimumPriceCents");
    if (patch.brokerId !== undefined) await this.assertBroker(patch.brokerId);

    const next: Listing = {
      ...listing,
      ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      updatedAt: this.now(),
    };
    if (next.supplyType === "dealer_stock") next.sellerCustomerId = null;
    validateListing(next);
    await this.listings.update(next);
    return next;
  }

  async changeStatus(productId: string, to: ListingStatus): Promise<Listing> {
    const listing = await this.getOrImport(productId);
    assertTransition(listing.status, to);
    if (listing.status === to) return listing;

    if (to === "listed") {
      const vehicle = await this.catalog.getVehicle(productId);
      if (vehicle?.askingPriceCents == null) {
        throw new ValidationError("Set an asking price in the Saleor channel before listing");
      }
    }
    await this.catalog.applyStatus(productId, to, saleorVisibility(to));

    const next = { ...listing, status: to, updatedAt: this.now() };
    await this.listings.update(next);
    return next;
  }

  private async assertBroker(brokerId: string | null) {
    if (!brokerId) return;
    const broker = await this.brokers.get(brokerId);
    if (!broker) throw new NotFoundError("Broker", brokerId);
    if (!broker.active) throw new ValidationError("Broker is not active");
  }
}
