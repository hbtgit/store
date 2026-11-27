import { BasisPoints } from "../shared/money";

export interface Broker {
  id: string;
  /** Saleor staff user id, when the broker signs in to the dashboard. */
  saleorUserId: string | null;
  name: string;
  email: string;
  defaultCommissionRateBp: BasisPoints;
  active: boolean;
  createdAt: Date;
}
