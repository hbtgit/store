import { dashboardRoute, param } from "@/lib/api-route";
import { assignBody } from "@/lib/schemas";

export default dashboardRoute(
  {
    POST: ({ req, services }) =>
      services.inquiries.reassign(param(req, "id"), assignBody.parse(req.body).brokerId),
  },
  ["MANAGE_PRODUCTS"]
);
