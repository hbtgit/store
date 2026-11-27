import { dashboardRoute, param } from "@/lib/api-route";
import { inquiryStatusBody } from "@/lib/schemas";

export default dashboardRoute(
  {
    POST: ({ req, services }) =>
      services.inquiries.changeStatus(param(req, "id"), inquiryStatusBody.parse(req.body).status),
  },
  ["MANAGE_PRODUCTS"]
);
