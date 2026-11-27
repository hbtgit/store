import { dashboardRoute } from "@/lib/api-route";
import { createBrokerBody } from "@/lib/schemas";

export default dashboardRoute(
  {
    GET: ({ services }) => services.brokers.list(),
    POST: ({ req, services }) => services.brokers.create(createBrokerBody.parse(req.body)),
  },
  { GET: ["MANAGE_PRODUCTS"], POST: ["MANAGE_STAFF"] }
);
