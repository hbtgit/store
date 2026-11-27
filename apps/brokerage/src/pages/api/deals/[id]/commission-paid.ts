import { dashboardRoute, param } from "@/lib/api-route";
import { commissionPaidBody } from "@/lib/schemas";

export default dashboardRoute(
  {
    POST: ({ req, services }) =>
      services.deals.markCommissionPaid(
        param(req, "id"),
        commissionPaidBody.parse(req.body ?? {}).paid
      ),
  },
  ["MANAGE_ORDERS"]
);
