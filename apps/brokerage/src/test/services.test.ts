import { beforeEach, describe, expect, it } from "vitest";

import { closeDealsForPaidOrder } from "@/modules/deals/order-sync";

import { setup, specs, VIN, VIN2 } from "./harness";

type Ctx = Awaited<ReturnType<typeof setup>>;
let ctx: Ctx;

beforeEach(async () => {
  ctx = await setup();
});

async function listedVehicle(overrides: Record<string, unknown> = {}) {
  const broker = await ctx.brokers.create({
    name: "Alice",
    email: "alice@x.test",
    defaultCommissionRateBp: 300,
  });
  const listing = await ctx.vehicles.register({
    vin: VIN,
    specs,
    askingPriceCents: 2_500_000,
    minimumPriceCents: 2_200_000,
    supplyType: "consignment",
    sellerCustomerId: "VXNlcjo5",
    brokerId: broker.id,
    ...overrides,
  });
  await ctx.vehicles.changeStatus(listing.productId, "listed");
  return { broker, listing };
}

describe("brokers", () => {
  it("rejects duplicate emails and invalid rates", async () => {
    await ctx.brokers.create({
      name: "Alice",
      email: "Alice@X.test",
      defaultCommissionRateBp: 300,
    });
    await expect(
      ctx.brokers.create({ name: "A2", email: "alice@x.test", defaultCommissionRateBp: 300 })
    ).rejects.toThrow(/already exists/);
    await expect(
      ctx.brokers.create({ name: "B", email: "b@x.test", defaultCommissionRateBp: 10_001 })
    ).rejects.toThrow(/basis points/);
  });
});

describe("vehicles", () => {
  it("registers in Saleor as a draft and keeps VINs unique", async () => {
    const listing = await ctx.vehicles.register({
      vin: VIN.toLowerCase(),
      specs,
      askingPriceCents: 1_000_000,
      supplyType: "dealer_stock",
    });
    expect(listing).toMatchObject({ vin: VIN, status: "draft", supplyType: "dealer_stock" });
    expect(ctx.catalog.products.get(listing.productId)?.name).toBe("2003 Honda Accord");

    await expect(
      ctx.vehicles.register({ vin: VIN, specs, askingPriceCents: 1, supplyType: "dealer_stock" })
    ).rejects.toThrow(/already exists/);
  });

  it("requires a seller for consignment", async () => {
    await expect(
      ctx.vehicles.register({ vin: VIN, specs, askingPriceCents: 1, supplyType: "consignment" })
    ).rejects.toThrow(/needs a seller/);
  });

  it("publishes on listing and hides on withdrawal", async () => {
    const { listing } = await listedVehicle();
    expect(ctx.catalog.products.get(listing.productId)).toMatchObject({
      status: "listed",
      isPublished: true,
      isAvailableForPurchase: true,
    });

    await ctx.vehicles.changeStatus(listing.productId, "withdrawn");
    expect(ctx.catalog.products.get(listing.productId)).toMatchObject({ isPublished: false });
    await expect(ctx.vehicles.changeStatus(listing.productId, "sold")).rejects.toThrow(
      /withdrawn to sold/
    );
  });

  it("imports vehicles created in the Saleor dashboard", async () => {
    const { productId } = await ctx.catalog.createVehicle({
      name: "Golf",
      vin: VIN2,
      askingPriceCents: 900_000,
    });
    const listing = await ctx.vehicles.getOrImport(productId);
    expect(listing).toMatchObject({ productId, vin: VIN2, status: "draft" });
    expect((await ctx.vehicles.getOrImport(productId)).createdAt).toEqual(listing.createdAt);
  });

  it("clears the seller when switching to dealer stock", async () => {
    const { listing } = await listedVehicle();
    const updated = await ctx.vehicles.update(listing.productId, { supplyType: "dealer_stock" });
    expect(updated.sellerCustomerId).toBeNull();
  });
});

describe("inquiries", () => {
  it("routes to the vehicle's broker and flags offers below the minimum", async () => {
    const { broker, listing } = await listedVehicle();
    const offer = await ctx.inquiries.submit({
      productId: listing.productId,
      kind: "offer",
      contactName: "Bob",
      contactEmail: "BOB@x.test",
      offerCents: 2_100_000,
    });
    expect(offer).toMatchObject({
      brokerId: broker.id,
      belowMinimum: true,
      contactEmail: "bob@x.test",
      status: "new",
    });
  });

  it("balances unassigned vehicles across brokers", async () => {
    const { listing } = await listedVehicle({ brokerId: null });
    const bob = await ctx.brokers.create({
      name: "Bob",
      email: "bob@x.test",
      defaultCommissionRateBp: 300,
    });
    const ask = () =>
      ctx.inquiries.submit({
        productId: listing.productId,
        kind: "question",
        contactName: "C",
        contactEmail: "c@x.test",
        message: "Service history?",
      });
    const first = await ask();
    const second = await ask();
    expect(new Set([first.brokerId, second.brokerId]).size).toBe(2);
    expect([first.brokerId, second.brokerId]).toContain(bob.id);
  });

  it("validates inquiry content and vehicle availability", async () => {
    const { listing } = await listedVehicle();
    const base = { productId: listing.productId, contactName: "C", contactEmail: "c@x.test" };
    await expect(ctx.inquiries.submit({ ...base, kind: "offer" })).rejects.toThrow(
      /needs an amount/
    );
    await expect(ctx.inquiries.submit({ ...base, kind: "test_drive" })).rejects.toThrow(
      /preferred date/
    );
    await ctx.vehicles.changeStatus(listing.productId, "withdrawn");
    await expect(
      ctx.inquiries.submit({ ...base, kind: "question", message: "hi" })
    ).rejects.toThrow(/not available/);
  });

  it("reserves the vehicle when an offer is accepted", async () => {
    const { listing } = await listedVehicle();
    const offer = await ctx.inquiries.submit({
      productId: listing.productId,
      kind: "offer",
      contactName: "B",
      contactEmail: "b@x.test",
      offerCents: 2_400_000,
    });
    await ctx.inquiries.changeStatus(offer.id, "accepted");
    expect((await ctx.vehicles.get(listing.productId)).status).toBe("reserved");
    expect(ctx.catalog.products.get(listing.productId)?.isAvailableForPurchase).toBe(false);
    await expect(ctx.inquiries.changeStatus(offer.id, "rejected")).rejects.toThrow(
      /accepted to rejected/
    );
  });
});

describe("deals", () => {
  it("snapshots commission, pays the consignor, and marks the vehicle sold", async () => {
    const { broker, listing } = await listedVehicle();
    const offer = await ctx.inquiries.submit({
      productId: listing.productId,
      kind: "offer",
      contactName: "B",
      contactEmail: "b@x.test",
      customerId: "VXNlcjox",
      offerCents: 2_400_000,
    });
    await ctx.inquiries.changeStatus(offer.id, "accepted");

    const deal = await ctx.deals.close({
      productId: listing.productId,
      salePriceCents: 2_400_000,
      currency: "USD",
      inquiryId: offer.id,
    });
    expect(deal).toMatchObject({
      brokerId: broker.id,
      buyerCustomerId: "VXNlcjox",
      sellerCustomerId: "VXNlcjo5",
      commissionRateBp: 300,
      commissionCents: 72_000,
      sellerPayoutCents: 2_328_000,
    });
    expect((await ctx.vehicles.get(listing.productId)).status).toBe("sold");
    expect((await ctx.inquiries.get(offer.id)).status).toBe("closed");

    // Later rate changes do not rewrite closed deals.
    await ctx.brokers.update(broker.id, { defaultCommissionRateBp: 500 });
    expect((await ctx.deals.get(deal.id)).commissionCents).toBe(72_000);

    await expect(
      ctx.deals.close({ productId: listing.productId, salePriceCents: 1, currency: "USD" })
    ).rejects.toThrow(/sold vehicle/);
  });

  it("tracks commission payment in the broker summary", async () => {
    const { listing } = await listedVehicle();
    const deal = await ctx.deals.close({
      productId: listing.productId,
      salePriceCents: 2_000_000,
      currency: "USD",
      commissionRateBp: 250,
    });
    let [row] = await ctx.deals.brokerSummary();
    expect(row).toMatchObject({
      deals: 1,
      commissionCents: 50_000,
      commissionOutstandingCents: 50_000,
      commissionPaidCents: 0,
    });

    await ctx.deals.markCommissionPaid(deal.id);
    [row] = await ctx.deals.brokerSummary();
    expect(row).toMatchObject({ commissionPaidCents: 50_000, commissionOutstandingCents: 0 });
    expect(await ctx.deals.list({ commissionPaid: false })).toHaveLength(0);
  });

  it("requires a broker", async () => {
    const { listing } = await listedVehicle({ brokerId: null });
    await expect(
      ctx.deals.close({ productId: listing.productId, salePriceCents: 100, currency: "USD" })
    ).rejects.toThrow(/Assign a broker/);
  });

  it("closes deals from a paid Saleor order once, ignoring non-vehicle lines", async () => {
    const { listing } = await listedVehicle();
    await ctx.inquiries.submit({
      productId: listing.productId,
      kind: "question",
      contactName: "Q",
      contactEmail: "q@x.test",
      message: "Still available?",
    });
    const order = {
      id: "T3JkZXI6MQ==",
      status: "UNFULFILLED",
      user: { id: "VXNlcjox" },
      lines: [
        {
          productSku: VIN,
          variant: { product: { id: listing.productId } },
          totalPrice: { gross: { amount: 24000.5, currency: "USD" } },
        },
        {
          productSku: "MATS",
          variant: { product: { id: "accessory" } },
          totalPrice: { gross: { amount: 99, currency: "USD" } },
        },
      ],
    };
    const isVehicle = (id: string) =>
      ctx.vehicles.get(id).then(
        () => true,
        () => false
      );

    const first = await closeDealsForPaidOrder(order, ctx.deals, isVehicle);
    expect(first.closed).toHaveLength(1);
    expect(first.closed[0]).toMatchObject({
      salePriceCents: 2_400_050,
      saleorOrderId: "T3JkZXI6MQ==:" + listing.productId,
      buyerCustomerId: "VXNlcjox",
    });
    expect(first.skipped).toEqual([]);

    // Saleor may redeliver the webhook.
    expect(
      (await ctx.inquiries.list({ productId: listing.productId })).every(
        (i) => i.status === "closed"
      )
    ).toBe(true);

    const again = await closeDealsForPaidOrder(order, ctx.deals, isVehicle);
    expect(again.closed[0].id).toBe(first.closed[0].id);
  });

  it("ignores draft orders", async () => {
    const { listing } = await listedVehicle();
    const result = await closeDealsForPaidOrder(
      {
        id: "draft",
        status: "DRAFT",
        user: null,
        lines: [
          {
            productSku: VIN,
            variant: { product: { id: listing.productId } },
            totalPrice: { gross: { amount: 1, currency: "USD" } },
          },
        ],
      },
      ctx.deals,
      async () => true
    );
    expect(result.closed).toEqual([]);
    expect((await ctx.vehicles.get(listing.productId)).status).toBe("listed");
  });
});
