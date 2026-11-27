import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";

import { servicesFor } from "@/container";
import { closeDealsForPaidOrder, PaidOrder } from "@/modules/deals/order-sync";
import { saleorApp } from "@/saleor-app";

const subscription = /* GraphQL */ `
  subscription BrokerageOrderFullyPaid {
    event {
      ... on OrderFullyPaid {
        order {
          id
          status
          user {
            id
          }
          lines {
            productSku
            variant {
              product {
                id
              }
            }
            totalPrice {
              gross {
                amount
                currency
              }
            }
          }
        }
      }
    }
  }
`;

export const orderFullyPaidWebhook = new SaleorAsyncWebhook<{ order: PaidOrder | null }>({
  name: "Brokerage: close deal when a vehicle order is fully paid",
  webhookPath: "api/webhooks/order-fully-paid",
  event: "ORDER_FULLY_PAID",
  apl: saleorApp.apl,
  query: subscription,
});

export default orderFullyPaidWebhook.createHandler(async (_req, res, { payload, authData }) => {
  if (!payload.order) return res.status(200).end();

  const services = await servicesFor(authData);
  const result = await closeDealsForPaidOrder(payload.order, services.deals, async (productId) =>
    services.vehicles
      .get(productId)
      .then(() => true)
      .catch(() => false)
  );
  for (const s of result.skipped) {
    console.warn(`Order ${payload.order.id}: no deal for ${s.productId}: ${s.reason}`);
  }
  return res.status(200).json({ closed: result.closed.map((d) => d.id), skipped: result.skipped });
});

export const config = { api: { bodyParser: false } };
