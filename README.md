# Car sales and brokerage platform

A car sales and brokerage platform built on [Saleor](https://saleor.io) 3.23, the open-source
(BSD-3) headless commerce platform.

- **Saleor** (Python/Django, GraphQL) runs the catalog, customers, checkout, orders and the
  staff dashboard.
- **`apps/brokerage`** is a Saleor App (Next.js, `@saleor/app-sdk`) that adds what a
  brokerage needs: vehicle listings with VINs and a sales workflow, buyer inquiries routed to
  brokers, and deals with commission and seller payouts. It plugs into the Saleor dashboard
  as menu pages and a product page widget.
- **Storefront**: the official Saleor storefront, see [docs/storefront.md](docs/storefront.md).

See [docs/architecture.md](docs/architecture.md) for how vehicles, inquiries and deals map
onto Saleor.

## What it does

| Area | Features |
|---|---|
| Vehicles | Saleor product type with make, model, year, mileage, body, fuel, transmission, colour and condition attributes; VIN as the unique SKU; asking price per channel; private minimum price; dealer stock or consignment with a seller; assigned broker; draft, listed, reserved, withdrawn and sold workflow that publishes and hides the product in Saleor |
| Inquiries | Questions, test drive requests and offers from the storefront; routing to the vehicle's broker or the least busy broker; offers below the minimum flagged; accepting an offer reserves the vehicle |
| Deals | Closed automatically when a Saleor order is fully paid, or manually; commission rate snapshot; seller payout for consignments; commission paid tracking; per-broker totals |
| Brokers | Default commission rates, activation |

## Run it locally

Requirements: Docker, Node.js 22 and pnpm 10.

```bash
# 1. Saleor API, worker, dashboard, Postgres, Valkey, Mailpit
docker compose up -d
docker compose run --rm api python3 manage.py migrate
docker compose run --rm api python3 manage.py createsuperuser

# 2. Brokerage app
cd apps/brokerage
cp .env.example .env            # set SALEOR_STAFF_PASSWORD to the superuser's password
pnpm install
pnpm provision                  # creates the Vehicle product type, attributes, category, warehouse
pnpm dev                        # http://localhost:3000
```

3. Open the dashboard at http://localhost:9000, sign in, open **Apps**, choose to install an
   app from a manifest URL and enter `http://host.docker.internal:3000/api/manifest` (the URL Saleor's container uses
   to reach the app). Grant the requested permissions.

4. Optional: load demo data (two brokers, a consigning customer, eight vehicles with photos
   from Wikimedia Commons, and a few inquiries). Safe to re-run.

   ```bash
   pnpm seed:demo                          # photos from Wikimedia Commons
   pnpm seed:demo --images-dir=./pics      # or your own files named <VIN>.jpg/.png/.webp
   ```

You will then find **Vehicles** under Catalog, **Inquiries** under Customers, **Deals and
commissions** under Orders, and a **Vehicle listing** widget on vehicle product pages.

Emails Saleor sends are visible in Mailpit at http://localhost:8025.

If installation fails, check that `SALEOR_API_URL` in `.env` is exactly the API URL the
dashboard uses (`http://localhost:8000/graphql/` by default): the app only accepts
installation from that Saleor instance.

## Develop the app

```bash
cd apps/brokerage
pnpm test           # domain and service tests (SQL runs on in-memory Postgres)
pnpm check-types
pnpm lint
pnpm format
```

New database changes go in `src/db/migrations/NNN_name.sql`; they apply automatically on the
app's first database use, or with `pnpm migrate`.

## Deploy

- Saleor: follow Saleor's [deployment guide](https://docs.saleor.io/setup/deployment) or use
  Saleor Cloud. Keep `HTTP_IP_FILTER_ENABLED` on in production.
- Brokerage app: `apps/brokerage/Dockerfile` builds a production image. It needs
  `BROKERAGE_DATABASE_URL`, `SALEOR_API_URL`, `APP_API_BASE_URL`, `APP_IFRAME_BASE_URL`,
  `STOREFRONT_ORIGIN` and a persistent path for `APL_FILE_PATH` (the install token).

## History

This repository started as a FastAPI inventory backend. That code is preserved on the
`fastapi-legacy` branch.
