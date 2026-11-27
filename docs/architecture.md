# Architecture

The platform is [Saleor](https://github.com/saleor/saleor) 3.23 plus one Saleor App,
`apps/brokerage`, that adds what a car brokerage needs and Saleor does not model.

```
 Storefront (Next.js) ──GraphQL──▶ Saleor API ◀──GraphQL── Brokerage app (Next.js)
        │                              │   ▲                   │      ▲
        │                              │   └── dashboard pages ┘      │
        │                         webhooks (ORDER_FULLY_PAID) ─────────┘
        └──── POST /api/public/inquiries ─────────────────────▶ app DB (Postgres)
```

## Who owns what

| Concern | Lives in | Why |
|---|---|---|
| Vehicle specs (make, model, year, mileage, fuel, body, transmission, colour, condition) | Saleor product attributes on the **Vehicle** product type | Storefront search, filtering and SEO come for free |
| VIN | Saleor variant SKU | Saleor enforces SKU uniqueness; the app also checks format and uniqueness |
| Asking price | Saleor variant channel price | Checkout, taxes and orders use it directly |
| Photos, description | Saleor product media and description | Edited in the dashboard |
| Customers (buyers and sellers, individuals or dealers) | Saleor customers | Accounts, addresses and sign-in already exist |
| Listing status, supply type (dealer stock or consignment), consigning seller, assigned broker, **private minimum price** | App database (`listings`) | Must never reach the storefront |
| Brokers and default commission rates | App database (`brokers`) | Saleor has no commission model |
| Inquiries (questions, test drives, offers) | App database (`inquiries`) | Lead workflow with broker routing |
| Deals, commission snapshot, seller payout, commission paid | App database (`deals`) | Settlement and reporting |

## Vehicle workflow

| From | Can move to |
|---|---|
| draft | listed, withdrawn |
| listed | reserved, withdrawn, sold |
| reserved | listed, withdrawn, sold |
| withdrawn | draft, listed |
| sold | nothing (final) |

Each move updates Saleor:

| Status | Published | Available for purchase | `vehicle.status` metadata |
|---|---|---|---|
| draft, withdrawn, sold | no | no | the status |
| listed | yes | yes | `listed` |
| reserved | yes | no | `reserved` |

The storefront can read `vehicle.status` from public product metadata to show a
"Reserved" badge. A vehicle has exactly one unit of stock in the **Brokerage yard**
warehouse and a purchase limit of one per customer, so checkout cannot oversell it.

## Inquiries

Buyers submit questions, test drive requests (with a preferred date) and offers (with an
amount) from the storefront. Each inquiry is routed to the vehicle's broker, or if the
vehicle has none, to the active broker with the fewest open inquiries. Offers below the
seller's minimum price are flagged for the broker, not rejected. Accepting an offer
reserves the vehicle.

Inquiry statuses: new, contacted, scheduled (test drives), accepted or rejected (offers),
closed.

## Deals and commissions

A deal closes the sale of one vehicle:

- automatically, when Saleor sends `ORDER_FULLY_PAID` for an order containing the vehicle
  (draft orders are ignored, and a redelivered webhook does not create a second deal), or
- manually from **Orders > Deals and commissions** for sales finalised outside checkout,
  such as an accepted offer on a reserved vehicle (Saleor will not complete an order for a
  product that is unavailable for purchase).

At closing the app snapshots the commission rate (deal override, else the broker's default),
computes the commission with half-up rounding to the cent and, for consignment, the
seller payout (sale price minus commission). The vehicle becomes sold and its inquiries
close. Commission payment is tracked per deal, and the broker summary totals sales,
commission, paid and outstanding per broker and currency.

Money is stored in integer cents and rates in basis points (1% = 100).

## The brokerage app

```
apps/brokerage/src
├── modules/            domain logic, no framework code
│   ├── shared/         errors, money, ids
│   ├── vehicles/       listing workflow, VIN rules, VehicleCatalog port
│   ├── brokers/
│   ├── inquiries/      workflow and routing
│   └── deals/          settlement, summaries, paid-order sync
├── db/                 Postgres repositories and SQL migrations
├── saleor/             GraphQL client, Saleor catalog adapter, vehicle schema
├── container.ts        wires repositories, Saleor and services
├── lib/                API route helper, request schemas, browser hooks
└── pages/              dashboard pages, product widget, API routes, webhook
```

Services depend on repository interfaces and a `VehicleCatalog` port, so tests run the
real services and SQL migrations against an in-memory Postgres (pg-mem) with a fake catalog.

### Dashboard extensions

| Where in the dashboard | Extension |
|---|---|
| Catalog menu | **Vehicles**: listings, status changes, register a vehicle |
| Customers menu | **Inquiries**: filter, reassign, move through the workflow |
| Orders menu | **Deals and commissions**: broker summary, deals, mark commission paid, close a deal, manage brokers |
| Product page | **Vehicle listing** widget: status, supply type, seller, broker, minimum price |

### API

Dashboard routes verify the signed-in staff user's token through the app SDK and check
their permissions.

| Method | Path | Permission |
|---|---|---|
| GET, POST | `/api/brokers` | GET: MANAGE_PRODUCTS, POST: MANAGE_STAFF |
| GET, PATCH | `/api/brokers/{id}` | GET: MANAGE_PRODUCTS, PATCH: MANAGE_STAFF |
| GET, POST | `/api/vehicles` | MANAGE_PRODUCTS |
| GET, PATCH | `/api/vehicles/{productId}` | MANAGE_PRODUCTS |
| POST | `/api/vehicles/{productId}/status` | MANAGE_PRODUCTS |
| GET | `/api/inquiries` | MANAGE_PRODUCTS |
| POST | `/api/inquiries/{id}/status`, `/api/inquiries/{id}/assign` | MANAGE_PRODUCTS |
| GET, POST | `/api/deals` | MANAGE_ORDERS |
| GET | `/api/deals/summary` | MANAGE_ORDERS |
| POST | `/api/deals/{id}/commission-paid` | MANAGE_ORDERS |
| POST | `/api/public/inquiries` | none (storefront, CORS limited to `STOREFRONT_ORIGIN`) |
| POST | `/api/webhooks/order-fully-paid` | Saleor webhook signature |

## Known limits

- One Saleor instance per app deployment. The app database is not partitioned by Saleor URL.
- The install token is kept in a JSON file (FileAPL). Use a shared APL from `@saleor/app-sdk`
  before running more than one app replica.
- Closing a deal writes the deal, then marks the vehicle sold in Saleor and the database.
  If Saleor is unreachable at that moment the deal exists but the vehicle needs its status
  set again; the unique deal-per-vehicle rule prevents a second deal.
- The public inquiry endpoint has no rate limiting or captcha yet.
- Customers are referenced by Saleor customer id. Marking a customer as an individual or a
  dealer is not modelled yet (Saleor customer metadata is the natural place).
