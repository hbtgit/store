import { dashboardRoute, param } from "@/lib/api-route";
import { updateListingBody } from "@/lib/schemas";

export default dashboardRoute(
  {
    /** Creates a draft listing on first access for vehicles added in the Saleor dashboard. */
    GET: ({ req, services }) => services.vehicles.getOrImport(param(req, "productId")),
    PATCH: ({ req, services }) =>
      services.vehicles.update(param(req, "productId"), updateListingBody.parse(req.body)),
  },
  ["MANAGE_PRODUCTS"]
);
