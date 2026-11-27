import { Cents } from "../shared/money";

/** Spec fields stored as Saleor product attributes (see scripts/provision-saleor.ts). */
export interface VehicleSpecs {
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  exteriorColor?: string;
  condition?: string;
}

export interface CatalogVehicle {
  productId: string;
  name: string;
  vin: string | null;
  isVehicle: boolean;
  askingPriceCents: Cents | null;
  currency: string | null;
}

/**
 * Port to the Saleor catalog. The Saleor GraphQL implementation lives in
 * saleor-catalog.ts; tests use an in-memory fake.
 */
export interface VehicleCatalog {
  createVehicle(input: {
    name: string;
    vin: string;
    specs: VehicleSpecs;
    askingPriceCents: Cents;
  }): Promise<{ productId: string }>;
  getVehicle(productId: string): Promise<CatalogVehicle | null>;
  applyStatus(
    productId: string,
    status: string,
    visibility: { isPublished: boolean; isAvailableForPurchase: boolean }
  ): Promise<void>;
}
