import { Broker } from "../brokers/domain";
import { Listing } from "../vehicles/domain";

/**
 * Picks the broker for a new inquiry:
 * 1. the broker assigned to the vehicle, if active;
 * 2. otherwise the active broker with the fewest open inquiries
 *    (ties go to the longest-serving broker, so routing is deterministic).
 * Returns null when there are no active brokers.
 */
export function routeInquiry(
  listing: Pick<Listing, "brokerId">,
  brokers: Broker[],
  openCounts: Map<string, number>
): string | null {
  const active = brokers.filter((b) => b.active);
  if (listing.brokerId && active.some((b) => b.id === listing.brokerId)) return listing.brokerId;
  if (active.length === 0) return null;

  const sorted = [...active].sort(
    (a, b) =>
      (openCounts.get(a.id) ?? 0) - (openCounts.get(b.id) ?? 0) ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id)
  );
  return sorted[0].id;
}
