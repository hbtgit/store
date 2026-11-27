import { dashboardRoute } from "@/lib/api-route";
import { closeDealBody } from "@/lib/schemas";

export default dashboardRoute(
  {
    GET: ({ req, services }) =>
      services.deals.list({
        brokerId: typeof req.query.brokerId === "string" ? req.query.brokerId : undefined,
        commissionPaid:
          req.query.commissionPaid === undefined ? undefined : req.query.commissionPaid === "true",
      }),
    POST: ({ req, services }) => services.deals.close(closeDealBody.parse(req.body)),
  },
  ["MANAGE_ORDERS"]
);
