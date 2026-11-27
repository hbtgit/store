import { dashboardRoute } from "@/lib/api-route";
import { INQUIRY_STATUSES, InquiryStatus } from "@/modules/inquiries/domain";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export default dashboardRoute(
  {
    GET: ({ req, services }) =>
      services.inquiries.list({
        productId: str(req.query.productId),
        brokerId: str(req.query.brokerId),
        status: INQUIRY_STATUSES.find((s) => s === req.query.status) as InquiryStatus | undefined,
      }),
  },
  ["MANAGE_PRODUCTS"]
);
