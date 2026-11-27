-- Brokerage app schema. Saleor keeps products, customers and orders;
-- this database keeps what Saleor has no model for.

CREATE TABLE brokers (
  id uuid PRIMARY KEY,
  saleor_user_id text UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  default_commission_rate_bp integer NOT NULL CHECK (default_commission_rate_bp BETWEEN 0 AND 10000),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL
);

CREATE TABLE listings (
  product_id text PRIMARY KEY,
  vin varchar(17) NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('draft', 'listed', 'reserved', 'withdrawn', 'sold')),
  supply_type text NOT NULL CHECK (supply_type IN ('dealer_stock', 'consignment')),
  seller_customer_id text,
  broker_id uuid REFERENCES brokers (id),
  minimum_price_cents bigint CHECK (minimum_price_cents >= 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK (supply_type <> 'consignment' OR seller_customer_id IS NOT NULL)
);
CREATE INDEX listings_status_idx ON listings (status);

CREATE TABLE inquiries (
  id uuid PRIMARY KEY,
  product_id text NOT NULL REFERENCES listings (product_id),
  kind text NOT NULL CHECK (kind IN ('question', 'test_drive', 'offer')),
  status text NOT NULL CHECK (status IN ('new', 'contacted', 'scheduled', 'accepted', 'rejected', 'closed')),
  customer_id text,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  message text,
  offer_cents bigint CHECK (offer_cents > 0),
  preferred_date text,
  below_minimum boolean NOT NULL DEFAULT false,
  broker_id uuid REFERENCES brokers (id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX inquiries_broker_status_idx ON inquiries (broker_id, status);
CREATE INDEX inquiries_product_idx ON inquiries (product_id);

CREATE TABLE deals (
  id uuid PRIMARY KEY,
  product_id text NOT NULL UNIQUE REFERENCES listings (product_id),
  vin varchar(17) NOT NULL,
  inquiry_id uuid REFERENCES inquiries (id),
  saleor_order_id text UNIQUE,
  buyer_customer_id text,
  seller_customer_id text,
  supply_type text NOT NULL,
  broker_id uuid NOT NULL REFERENCES brokers (id),
  sale_price_cents bigint NOT NULL CHECK (sale_price_cents > 0),
  currency char(3) NOT NULL,
  commission_rate_bp integer NOT NULL,
  commission_cents bigint NOT NULL,
  seller_payout_cents bigint,
  closed_at timestamptz NOT NULL,
  commission_paid_at timestamptz
);
CREATE INDEX deals_broker_idx ON deals (broker_id);
