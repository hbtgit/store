import { dashboardRoute } from "@/lib/api-route";
import { registerVehicleBody } from "@/lib/schemas";
import { LISTING_STATUSES, ListingStatus } from "@/modules/vehicles/domain";

export default dashboardRoute(
  {
    GET: ({ req, services }) => {
      const status = LISTING_STATUSES.find((s) => s === req.query.status) as
        | ListingStatus
        | undefined;
      return services.vehicles.list({ status });
    },
    POST: ({ req, services }) => services.vehicles.register(registerVehicleBody.parse(req.body)),
  },
  ["MANAGE_PRODUCTS"]
);
