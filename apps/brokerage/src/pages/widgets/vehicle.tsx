import { useAppBridge, useWidgetAutoResize } from "@saleor/app-sdk/app-bridge";
import { Box, Button, Input, Text } from "@saleor/macaw-ui";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

import { StatusActions } from "@/components/StatusActions";
import { ErrorText, formatMoney, humanize, parseMoney, SelectField } from "@/components/ui";
import { BrokerDto, ListingDto } from "@/lib/api-types";
import { useApi, useResource } from "@/lib/use-api";
import { allowedTransitions, ListingStatus, SUPPLY_TYPES } from "@/modules/vehicles/domain";

/** Product page widget: brokerage fields and status for a Vehicle product. */
const VehicleWidget: NextPage = () => {
  // The dashboard sizes widget iframes from the height the widget reports.
  const rootRef = useRef<HTMLDivElement>(null);
  useWidgetAutoResize(rootRef);
  return (
    <div ref={rootRef}>
      <VehicleWidgetContent />
    </div>
  );
};

function VehicleWidgetContent() {
  const { appBridgeState } = useAppBridge();
  const router = useRouter();
  const productId = typeof router.query.productId === "string" ? router.query.productId : null;
  const api = useApi();
  const listing = useResource<ListingDto>(
    productId ? `/api/vehicles/${encodeURIComponent(productId)}` : null
  );
  const brokers = useResource<BrokerDto[]>("/api/brokers");
  const [draft, setDraft] = useState({
    supplyType: "dealer_stock",
    sellerCustomerId: "",
    brokerId: "",
    minimumPrice: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const l = listing.data;
    if (!l) return;
    setDraft({
      supplyType: l.supplyType,
      sellerCustomerId: l.sellerCustomerId ?? "",
      brokerId: l.brokerId ?? "",
      minimumPrice: l.minimumPriceCents == null ? "" : String(l.minimumPriceCents / 100),
    });
  }, [listing.data]);

  if (!appBridgeState?.ready) return <Text>Loading...</Text>;
  if (!productId) return <Text>Open this widget from a product page.</Text>;
  if (listing.error) {
    return <Text color="default2">{listing.error}</Text>;
  }
  const l = listing.data;
  if (!l) return <Text>Loading...</Text>;

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      listing.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const path = `/api/vehicles/${encodeURIComponent(l.productId)}`;

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Text size={3}>
        Status <b>{humanize(l.status)}</b>, VIN {l.vin}
      </Text>
      <StatusActions
        next={allowedTransitions(l.status)}
        onChange={(status: ListingStatus) =>
          run(() => api(`${path}/status`, { method: "POST", body: { status } }))
        }
      />
      <SelectField
        label="Supply"
        value={draft.supplyType}
        onChange={(supplyType) => setDraft((d) => ({ ...d, supplyType }))}
        options={SUPPLY_TYPES.map((s) => ({ value: s, label: humanize(s) }))}
      />
      {draft.supplyType === "consignment" && (
        <Input
          label="Seller customer ID"
          value={draft.sellerCustomerId}
          onChange={(e) => setDraft((d) => ({ ...d, sellerCustomerId: e.target.value }))}
        />
      )}
      <SelectField
        label="Broker"
        value={draft.brokerId}
        onChange={(brokerId) => setDraft((d) => ({ ...d, brokerId }))}
        options={[
          { value: "", label: "Unassigned" },
          ...(brokers.data ?? [])
            .filter((b) => b.active)
            .map((b) => ({ value: b.id, label: b.name })),
        ]}
      />
      <Input
        label={`Minimum price (private, now ${formatMoney(l.minimumPriceCents)})`}
        value={draft.minimumPrice}
        onChange={(e) => setDraft((d) => ({ ...d, minimumPrice: e.target.value }))}
      />
      <ErrorText error={error} />
      <Button
        disabled={l.status === "sold"}
        onClick={() =>
          run(() =>
            api(path, {
              method: "PATCH",
              body: {
                supplyType: draft.supplyType,
                sellerCustomerId: draft.sellerCustomerId || null,
                brokerId: draft.brokerId || null,
                minimumPriceCents: parseMoney(draft.minimumPrice),
              },
            })
          )
        }
      >
        Save listing
      </Button>
    </Box>
  );
}

export default VehicleWidget;
