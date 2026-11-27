import { dashboardRoute, param } from "@/lib/api-route";
import { updateBrokerBody } from "@/lib/schemas";

export default dashboardRoute(
  {
    GET: ({ req, services }) => services.brokers.get(param(req, "id")),
    PATCH: ({ req, services }) =>
      services.brokers.update(param(req, "id"), updateBrokerBody.parse(req.body)),
  },
  { GET: ["MANAGE_PRODUCTS"], PATCH: ["MANAGE_STAFF"] }
);
