import { dashboardRoute, param } from "@/lib/api-route";
import { listingStatusBody } from "@/lib/schemas";

export default dashboardRoute(
  {
    POST: ({ req, services }) =>
      services.vehicles.changeStatus(
        param(req, "productId"),
        listingStatusBody.parse(req.body).status
      ),
  },
  ["MANAGE_PRODUCTS"]
);
