import { describe, expect, it } from "vitest";

import { Broker } from "@/modules/brokers/domain";
import { settle, summarize } from "@/modules/deals/domain";
import { nextInquiryStatuses } from "@/modules/inquiries/domain";
import { routeInquiry } from "@/modules/inquiries/routing";
import { applyRate, toCents } from "@/modules/shared/money";
import {
  allowedTransitions,
  assertTransition,
  hasValidCheckDigit,
  normalizeVin,
  saleorVisibility,
} from "@/modules/vehicles/domain";

import { VIN } from "./harness";

describe("money", () => {
  it("applies basis-point rates with half-up rounding", () => {
    expect(applyRate(2_500_000, 250)).toBe(62_500); // 2.5% of 25,000.00
    expect(applyRate(1_999, 250)).toBe(50); // 49.975 -> 50
    expect(applyRate(1_998, 250)).toBe(50); // 49.95 -> 50
    expect(applyRate(1_979, 250)).toBe(49); // 49.475 -> 49
  });

  it("converts Saleor decimals to cents without float drift", () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(12999.95)).toBe(1299995);
  });
});

describe("VIN", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeVin(" 1hgcm82633a004352 ")).toBe(VIN);
  });

  it.each(["SHORT", "1HGCM82633A00435I", "1HGCM82633A0043521"])("rejects %s", (vin) => {
    expect(() => normalizeVin(vin)).toThrow(/17 characters/);
  });

  it("checks the North American check digit", () => {
    expect(hasValidCheckDigit(VIN)).toBe(true);
    expect(hasValidCheckDigit("1HGCM82634A004352")).toBe(false);
  });
});

describe("listing workflow", () => {
  it("allows the documented transitions only", () => {
    expect(allowedTransitions("draft")).toEqual(["listed", "withdrawn"]);
    expect(allowedTransitions("sold")).toEqual([]);
    expect(() => assertTransition("draft", "sold")).toThrow(/draft to sold/);
    expect(() => assertTransition("reserved", "listed")).not.toThrow();
  });

  it("maps statuses to Saleor visibility", () => {
    expect(saleorVisibility("listed")).toEqual({ isPublished: true, isAvailableForPurchase: true });
    expect(saleorVisibility("reserved")).toEqual({
      isPublished: true,
      isAvailableForPurchase: false,
    });
    expect(saleorVisibility("sold")).toEqual({ isPublished: false, isAvailableForPurchase: false });
  });
});

describe("inquiry workflow", () => {
  it("offers next steps that fit the inquiry kind", () => {
    expect(nextInquiryStatuses({ kind: "question", status: "new" })).toEqual([
      "contacted",
      "closed",
    ]);
    expect(nextInquiryStatuses({ kind: "offer", status: "contacted" })).toEqual([
      "accepted",
      "rejected",
      "closed",
    ]);
    expect(nextInquiryStatuses({ kind: "test_drive", status: "new" })).toEqual([
      "contacted",
      "scheduled",
      "closed",
    ]);
  });
});

describe("routing", () => {
  const broker = (id: string, minutes: number, active = true): Broker => ({
    id,
    saleorUserId: null,
    name: id,
    email: `${id}@x.test`,
    defaultCommissionRateBp: 300,
    active,
    createdAt: new Date(2026, 0, 1, 0, minutes),
  });

  it("prefers the vehicle's broker when active", () => {
    expect(
      routeInquiry({ brokerId: "b" }, [broker("a", 0), broker("b", 1)], new Map([["b", 9]]))
    ).toBe("b");
  });

  it("falls back to the least loaded broker, then seniority", () => {
    const brokers = [broker("a", 0), broker("b", 1), broker("c", 2)];
    expect(
      routeInquiry(
        { brokerId: null },
        brokers,
        new Map([
          ["a", 2],
          ["b", 1],
          ["c", 1],
        ])
      )
    ).toBe("b");
    expect(
      routeInquiry({ brokerId: "gone" }, [broker("gone", 0, false), broker("x", 1)], new Map())
    ).toBe("x");
    expect(routeInquiry({ brokerId: null }, [], new Map())).toBeNull();
  });
});

describe("settlement", () => {
  it("pays the seller the remainder on consignment", () => {
    expect(
      settle({ supplyType: "consignment", salePriceCents: 2_000_000, commissionRateBp: 500 })
    ).toEqual({
      commissionCents: 100_000,
      sellerPayoutCents: 1_900_000,
    });
  });

  it("has no seller payout for dealer stock", () => {
    expect(
      settle({ supplyType: "dealer_stock", salePriceCents: 2_000_000, commissionRateBp: 500 })
        .sellerPayoutCents
    ).toBeNull();
  });

  it("summarizes per broker and currency", () => {
    const base = {
      productId: "p",
      vin: VIN,
      inquiryId: null,
      saleorOrderId: null,
      buyerCustomerId: null,
      sellerCustomerId: null,
      supplyType: "dealer_stock" as const,
      salePriceCents: 1_000_000,
      currency: "USD",
      commissionRateBp: 300,
      commissionCents: 30_000,
      sellerPayoutCents: null,
      closedAt: new Date(),
    };
    const rows = summarize(
      [
        { ...base, id: "1", brokerId: "a", commissionPaidAt: new Date() },
        { ...base, id: "2", brokerId: "a", commissionPaidAt: null },
        { ...base, id: "3", brokerId: "a", currency: "EUR", commissionPaidAt: null },
      ],
      new Map([["a", "Alice"]])
    );
    expect(rows).toContainEqual({
      brokerId: "a",
      brokerName: "Alice",
      currency: "USD",
      deals: 2,
      salesCents: 2_000_000,
      commissionCents: 60_000,
      commissionPaidCents: 30_000,
      commissionOutstandingCents: 30_000,
    });
    expect(rows).toHaveLength(2);
  });
});
