import { newDb } from "pg-mem";

import { createServices } from "@/container";
import { migrate } from "@/db/migrate";
import { Queryable } from "@/db/types";
import { CatalogVehicle, VehicleCatalog } from "@/modules/vehicles/catalog";

/** In-memory stand-in for the Saleor catalog. */
export class FakeCatalog implements VehicleCatalog {
  products = new Map<
    string,
    CatalogVehicle & { status: string; isPublished: boolean; isAvailableForPurchase: boolean }
  >();
  private seq = 0;

  async createVehicle(input: { name: string; vin: string; askingPriceCents: number }) {
    const productId = `UHJvZHVjdDo${++this.seq}`;
    this.products.set(productId, {
      productId,
      name: input.name,
      vin: input.vin,
      isVehicle: true,
      askingPriceCents: input.askingPriceCents,
      currency: "USD",
      status: "draft",
      isPublished: false,
      isAvailableForPurchase: false,
    });
    return { productId };
  }

  async getVehicle(productId: string) {
    return this.products.get(productId) ?? null;
  }

  async applyStatus(
    productId: string,
    status: string,
    v: { isPublished: boolean; isAvailableForPurchase: boolean }
  ) {
    const p = this.products.get(productId)!;
    Object.assign(p, { status, ...v });
  }
}

/** Real SQL migrations on pg-mem, real repositories and services, fake Saleor. */
export async function setup() {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool() as unknown as Queryable;
  await migrate(pool);

  let clock = new Date("2026-01-01T09:00:00Z").getTime();
  const now = () => new Date((clock += 1_000));

  const catalog = new FakeCatalog();
  const services = createServices(pool, catalog, now);
  return { db: pool, catalog, ...services };
}

export const VIN = "1HGCM82633A004352"; // valid North American check digit
export const VIN2 = "WVWZZZ1JZXW000001";

export const specs = { make: "Honda", model: "Accord", year: 2003, mileageKm: 150_000 };
