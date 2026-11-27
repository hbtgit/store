import { dashboardRoute } from "@/lib/api-route";

export default dashboardRoute({ GET: ({ services }) => services.deals.brokerSummary() }, [
  "MANAGE_ORDERS",
]);
