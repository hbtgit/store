import { Broker } from "../modules/brokers/domain";
import { BrokerRepository } from "../modules/brokers/repository";
import { Deal } from "../modules/deals/domain";
import { DealRepository } from "../modules/deals/repository";
import { Inquiry } from "../modules/inquiries/domain";
import { InquiryRepository } from "../modules/inquiries/repository";
import { Listing } from "../modules/vehicles/domain";
import { ListingRepository } from "../modules/vehicles/repository";
import { Queryable } from "./types";

/*
 * Postgres repositories. Columns are snake_case; each mapper converts a row
 * to its domain type. bigint columns come back as strings from pg, so they are
 * converted with Number (amounts stay well within the safe integer range).
 */

const num = (v: unknown) => (v == null ? null : Number(v));
const date = (v: unknown) => (v == null ? null : v instanceof Date ? v : new Date(String(v)));

function where(clauses: [string, unknown][]) {
  const active = clauses.filter(([, v]) => v !== undefined);
  return {
    sql: active.length ? " WHERE " + active.map(([c], i) => `${c} = $${i + 1}`).join(" AND ") : "",
    params: active.map(([, v]) => v),
  };
}

// Brokers

const toBroker = (r: any): Broker => ({
  id: r.id,
  saleorUserId: r.saleor_user_id,
  name: r.name,
  email: r.email,
  defaultCommissionRateBp: Number(r.default_commission_rate_bp),
  active: r.active,
  createdAt: date(r.created_at)!,
});

export class PgBrokerRepository implements BrokerRepository {
  constructor(private readonly db: Queryable) {}

  async get(id: string) {
    const { rows } = await this.db.query("SELECT * FROM brokers WHERE id = $1", [id]);
    return rows[0] ? toBroker(rows[0]) : null;
  }

  async getByEmail(email: string) {
    const { rows } = await this.db.query("SELECT * FROM brokers WHERE email = $1", [email]);
    return rows[0] ? toBroker(rows[0]) : null;
  }

  async list(filter: { active?: boolean } = {}) {
    const w = where([["active", filter.active]]);
    const { rows } = await this.db.query(`SELECT * FROM brokers${w.sql} ORDER BY name`, w.params);
    return rows.map(toBroker);
  }

  async insert(b: Broker) {
    await this.db.query(
      `INSERT INTO brokers (id, saleor_user_id, name, email, default_commission_rate_bp, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [b.id, b.saleorUserId, b.name, b.email, b.defaultCommissionRateBp, b.active, b.createdAt]
    );
  }

  async update(b: Broker) {
    await this.db.query(
      `UPDATE brokers SET saleor_user_id = $2, name = $3, default_commission_rate_bp = $4, active = $5 WHERE id = $1`,
      [b.id, b.saleorUserId, b.name, b.defaultCommissionRateBp, b.active]
    );
  }
}

// Listings

const toListing = (r: any): Listing => ({
  productId: r.product_id,
  vin: r.vin,
  status: r.status,
  supplyType: r.supply_type,
  sellerCustomerId: r.seller_customer_id,
  brokerId: r.broker_id,
  minimumPriceCents: num(r.minimum_price_cents),
  createdAt: date(r.created_at)!,
  updatedAt: date(r.updated_at)!,
});

export class PgListingRepository implements ListingRepository {
  constructor(private readonly db: Queryable) {}

  async get(productId: string) {
    const { rows } = await this.db.query("SELECT * FROM listings WHERE product_id = $1", [
      productId,
    ]);
    return rows[0] ? toListing(rows[0]) : null;
  }

  async getByVin(vin: string) {
    const { rows } = await this.db.query("SELECT * FROM listings WHERE vin = $1", [vin]);
    return rows[0] ? toListing(rows[0]) : null;
  }

  async list(filter: { status?: Listing["status"]; brokerId?: string } = {}) {
    const w = where([
      ["status", filter.status],
      ["broker_id", filter.brokerId],
    ]);
    const { rows } = await this.db.query(
      `SELECT * FROM listings${w.sql} ORDER BY updated_at DESC`,
      w.params
    );
    return rows.map(toListing);
  }

  async insert(l: Listing) {
    await this.db.query(
      `INSERT INTO listings (product_id, vin, status, supply_type, seller_customer_id, broker_id,
         minimum_price_cents, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        l.productId,
        l.vin,
        l.status,
        l.supplyType,
        l.sellerCustomerId,
        l.brokerId,
        l.minimumPriceCents,
        l.createdAt,
        l.updatedAt,
      ]
    );
  }

  async update(l: Listing) {
    await this.db.query(
      `UPDATE listings SET status = $2, supply_type = $3, seller_customer_id = $4, broker_id = $5,
         minimum_price_cents = $6, updated_at = $7 WHERE product_id = $1`,
      [
        l.productId,
        l.status,
        l.supplyType,
        l.sellerCustomerId,
        l.brokerId,
        l.minimumPriceCents,
        l.updatedAt,
      ]
    );
  }
}

// Inquiries

const toInquiry = (r: any): Inquiry => ({
  id: r.id,
  productId: r.product_id,
  kind: r.kind,
  status: r.status,
  customerId: r.customer_id,
  contactName: r.contact_name,
  contactEmail: r.contact_email,
  contactPhone: r.contact_phone,
  message: r.message,
  offerCents: num(r.offer_cents),
  preferredDate: r.preferred_date,
  belowMinimum: r.below_minimum,
  brokerId: r.broker_id,
  createdAt: date(r.created_at)!,
  updatedAt: date(r.updated_at)!,
});

export class PgInquiryRepository implements InquiryRepository {
  constructor(private readonly db: Queryable) {}

  async get(id: string) {
    const { rows } = await this.db.query("SELECT * FROM inquiries WHERE id = $1", [id]);
    return rows[0] ? toInquiry(rows[0]) : null;
  }

  async list(filter: { productId?: string; brokerId?: string; status?: Inquiry["status"] } = {}) {
    const w = where([
      ["product_id", filter.productId],
      ["broker_id", filter.brokerId],
      ["status", filter.status],
    ]);
    const { rows } = await this.db.query(
      `SELECT * FROM inquiries${w.sql} ORDER BY created_at DESC`,
      w.params
    );
    return rows.map(toInquiry);
  }

  async openCountByBroker() {
    const { rows } = await this.db.query<{ broker_id: string; open: string }>(
      `SELECT broker_id, count(*) AS open FROM inquiries
       WHERE broker_id IS NOT NULL AND status IN ('new', 'contacted', 'scheduled')
       GROUP BY broker_id`
    );
    return new Map(rows.map((r) => [r.broker_id, Number(r.open)]));
  }

  async insert(i: Inquiry) {
    await this.db.query(
      `INSERT INTO inquiries (id, product_id, kind, status, customer_id, contact_name, contact_email,
         contact_phone, message, offer_cents, preferred_date, below_minimum, broker_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        i.id,
        i.productId,
        i.kind,
        i.status,
        i.customerId,
        i.contactName,
        i.contactEmail,
        i.contactPhone,
        i.message,
        i.offerCents,
        i.preferredDate,
        i.belowMinimum,
        i.brokerId,
        i.createdAt,
        i.updatedAt,
      ]
    );
  }

  async update(i: Inquiry) {
    await this.db.query(
      "UPDATE inquiries SET status = $2, broker_id = $3, updated_at = $4 WHERE id = $1",
      [i.id, i.status, i.brokerId, i.updatedAt]
    );
  }
}

// Deals

const toDeal = (r: any): Deal => ({
  id: r.id,
  productId: r.product_id,
  vin: r.vin,
  inquiryId: r.inquiry_id,
  saleorOrderId: r.saleor_order_id,
  buyerCustomerId: r.buyer_customer_id,
  sellerCustomerId: r.seller_customer_id,
  supplyType: r.supply_type,
  brokerId: r.broker_id,
  salePriceCents: Number(r.sale_price_cents),
  currency: String(r.currency).trim(),
  commissionRateBp: Number(r.commission_rate_bp),
  commissionCents: Number(r.commission_cents),
  sellerPayoutCents: num(r.seller_payout_cents),
  closedAt: date(r.closed_at)!,
  commissionPaidAt: date(r.commission_paid_at),
});

export class PgDealRepository implements DealRepository {
  constructor(private readonly db: Queryable) {}

  async get(id: string) {
    const { rows } = await this.db.query("SELECT * FROM deals WHERE id = $1", [id]);
    return rows[0] ? toDeal(rows[0]) : null;
  }

  async getByProduct(productId: string) {
    const { rows } = await this.db.query("SELECT * FROM deals WHERE product_id = $1", [productId]);
    return rows[0] ? toDeal(rows[0]) : null;
  }

  async getBySaleorOrder(orderId: string) {
    const { rows } = await this.db.query("SELECT * FROM deals WHERE saleor_order_id = $1", [
      orderId,
    ]);
    return rows[0] ? toDeal(rows[0]) : null;
  }

  async list(filter: { brokerId?: string; commissionPaid?: boolean } = {}) {
    const w = where([["broker_id", filter.brokerId]]);
    let sql = `SELECT * FROM deals${w.sql}`;
    if (filter.commissionPaid !== undefined) {
      sql += `${w.sql ? " AND" : " WHERE"} commission_paid_at IS ${
        filter.commissionPaid ? "NOT " : ""
      }NULL`;
    }
    const { rows } = await this.db.query(`${sql} ORDER BY closed_at DESC`, w.params);
    return rows.map(toDeal);
  }

  async insert(d: Deal) {
    await this.db.query(
      `INSERT INTO deals (id, product_id, vin, inquiry_id, saleor_order_id, buyer_customer_id,
         seller_customer_id, supply_type, broker_id, sale_price_cents, currency, commission_rate_bp,
         commission_cents, seller_payout_cents, closed_at, commission_paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        d.id,
        d.productId,
        d.vin,
        d.inquiryId,
        d.saleorOrderId,
        d.buyerCustomerId,
        d.sellerCustomerId,
        d.supplyType,
        d.brokerId,
        d.salePriceCents,
        d.currency,
        d.commissionRateBp,
        d.commissionCents,
        d.sellerPayoutCents,
        d.closedAt,
        d.commissionPaidAt,
      ]
    );
  }

  async update(d: Deal) {
    await this.db.query("UPDATE deals SET commission_paid_at = $2 WHERE id = $1", [
      d.id,
      d.commissionPaidAt,
    ]);
  }
}
