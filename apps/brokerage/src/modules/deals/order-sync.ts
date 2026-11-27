import { toCents } from "../shared/money";
import { Deal } from "./domain";
import { DealService } from "./service";

/** The part of a Saleor ORDER_FULLY_PAID payload this app reads. */
export interface PaidOrder {
  id: string;
  /** Saleor OrderStatusEnum, e.g. UNFULFILLED. Draft orders never close deals. */
  status: string;
  user: { id: string } | null;
  lines: {
    productSku: string | null;
    variant: { product: { id: string } } | null;
    totalPrice: { gross: { amount: number; currency: string } };
  }[];
}

/**
 * Closes a deal for every vehicle in a fully paid Saleor order. Lines whose
 * product has no brokerage listing (accessories, fees) are ignored. Returns
 * the created deals and the lines that could not be closed, with the reason.
 */
export async function closeDealsForPaidOrder(
  order: PaidOrder,
  deals: DealService,
  isVehicle: (productId: string) => Promise<boolean>
): Promise<{ closed: Deal[]; skipped: { productId: string; reason: string }[] }> {
  const closed: Deal[] = [];
  const skipped: { productId: string; reason: string }[] = [];
  if (order.status === "DRAFT") return { closed, skipped };
  const vehicleLines = order.lines.filter((l) => l.variant?.product.id);

  for (const line of vehicleLines) {
    const productId = line.variant!.product.id;
    if (!(await isVehicle(productId))) continue;
    try {
      closed.push(
        await deals.close({
          productId,
          salePriceCents: toCents(line.totalPrice.gross.amount),
          currency: line.totalPrice.gross.currency,
          buyerCustomerId: order.user?.id ?? null,
          // One order may hold several vehicles, so the idempotency key is per line.
          saleorOrderId: vehicleLines.length > 1 ? `${order.id}:${productId}` : order.id,
        })
      );
    } catch (err) {
      skipped.push({ productId, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return { closed, skipped };
}
