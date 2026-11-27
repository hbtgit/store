# Storefront

Use the official [Saleor storefront](https://github.com/saleor/storefront) (Next.js) and
point it at this Saleor instance:

```bash
git clone https://github.com/saleor/storefront.git
cd storefront
cp .env.example .env
# NEXT_PUBLIC_SALEOR_API_URL=http://localhost:8000/graphql/
# NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3001
# NEXT_PUBLIC_DEFAULT_CHANNEL=default-channel
pnpm install
pnpm dev --port 3001
```

Vehicles appear as products of the **Vehicles** category once they are listed. Their specs
are product attributes and their status is in public metadata under `vehicle.status`.

## Sending inquiries

Add a contact form to the product page that posts to the brokerage app. The browser origin
must match `STOREFRONT_ORIGIN` in the app's `.env`.

```ts
await fetch(`${BROKERAGE_APP_URL}/api/public/inquiries`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    productId, // Saleor product id
    kind: "offer", // "question" | "test_drive" | "offer"
    contactName: "Sam Buyer",
    contactEmail: "sam@example.com",
    contactPhone: "+1 555 0100",
    offerCents: 2_350_000, // offers only, in cents
    preferredDate: undefined, // test drives only, e.g. "2026-12-03 10:00"
    message: undefined, // required for questions
    customerId: undefined, // Saleor user id when the buyer is signed in
  }),
});
// 201 { id, kind, status }
// 400 { error, message } when the input is invalid or the vehicle is not available
```

Building this form into the storefront codebase is the next storefront task.
