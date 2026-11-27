import { actions, useAppBridge } from "@saleor/app-sdk/app-bridge";
import { Box, Button, Input, Text } from "@saleor/macaw-ui";
import { NextPage } from "next";
import { FormEvent, useState } from "react";

import { StatusActions } from "@/components/StatusActions";
import {
  ErrorText,
  formatMoney,
  humanize,
  Page,
  parseMoney,
  Section,
  SelectField,
  Table,
} from "@/components/ui";
import { BrokerDto, ListingDto } from "@/lib/api-types";
import { useApi, useResource } from "@/lib/use-api";
import {
  allowedTransitions,
  ListingStatus,
  SUPPLY_TYPES,
  SupplyType,
} from "@/modules/vehicles/domain";

const emptyForm = {
  vin: "",
  make: "",
  model: "",
  year: String(new Date().getFullYear()),
  mileageKm: "0",
  askingPrice: "",
  minimumPrice: "",
  supplyType: "dealer_stock" as SupplyType,
  sellerCustomerId: "",
  brokerId: "",
};

const VehiclesPage: NextPage = () => {
  const api = useApi();
  const { appBridge } = useAppBridge();
  const listings = useResource<ListingDto[]>("/api/vehicles");
  const brokers = useResource<BrokerDto[]>("/api/brokers");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof emptyForm) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const brokerName = (id: string | null) => brokers.data?.find((b) => b.id === id)?.name ?? "-";

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      listings.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const register = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api("/api/vehicles", {
        method: "POST",
        body: {
          vin: form.vin,
          specs: {
            make: form.make,
            model: form.model,
            year: Number(form.year),
            mileageKm: Number(form.mileageKm),
          },
          askingPriceCents: parseMoney(form.askingPrice) ?? 0,
          minimumPriceCents: parseMoney(form.minimumPrice),
          supplyType: form.supplyType,
          sellerCustomerId: form.sellerCustomerId || null,
          brokerId: form.brokerId || null,
        },
      });
      setForm(emptyForm);
    });
  };

  const openProduct = (productId: string) =>
    appBridge?.dispatch(actions.Redirect({ to: `/products/${encodeURIComponent(productId)}` }));

  return (
    <Page title="Vehicles">
      <ErrorText error={error ?? listings.error} />
      <Section title="Listings">
        <Table
          head={["VIN", "Status", "Supply", "Broker", "Minimum price", "Move to", ""]}
          empty="No vehicles yet. Register one below, or open a Vehicle product in the catalog."
          rows={(listings.data ?? []).map((l) => [
            <Text key="vin" size={3} fontWeight="bold">
              {l.vin}
            </Text>,
            humanize(l.status),
            humanize(l.supplyType),
            brokerName(l.brokerId),
            formatMoney(l.minimumPriceCents),
            <StatusActions
              key="status"
              disabled={busy}
              next={allowedTransitions(l.status)}
              onChange={(status: ListingStatus) =>
                run(() =>
                  api(`/api/vehicles/${encodeURIComponent(l.productId)}/status`, {
                    method: "POST",
                    body: { status },
                  })
                )
              }
            />,
            <Button
              key="open"
              size="small"
              variant="tertiary"
              onClick={() => openProduct(l.productId)}
            >
              Open product
            </Button>,
          ])}
        />
      </Section>

      <Section title="Register a vehicle">
        <Text color="default2">
          Creates the Saleor product (Vehicle type, VIN as SKU, one unit in stock) and a draft
          listing.
        </Text>
        <Box
          as="form"
          onSubmit={register}
          display="grid"
          gridTemplateColumns={3}
          gap={4}
          __maxWidth="900px"
        >
          <Input
            label="VIN"
            value={form.vin}
            onChange={(e) => set("vin")(e.target.value)}
            required
          />
          <Input
            label="Make"
            value={form.make}
            onChange={(e) => set("make")(e.target.value)}
            required
          />
          <Input
            label="Model"
            value={form.model}
            onChange={(e) => set("model")(e.target.value)}
            required
          />
          <Input
            label="Year"
            type="number"
            value={form.year}
            onChange={(e) => set("year")(e.target.value)}
            required
          />
          <Input
            label="Mileage (km)"
            type="number"
            value={form.mileageKm}
            onChange={(e) => set("mileageKm")(e.target.value)}
          />
          <Input
            label="Asking price"
            value={form.askingPrice}
            onChange={(e) => set("askingPrice")(e.target.value)}
            required
          />
          <Input
            label="Minimum price (private)"
            value={form.minimumPrice}
            onChange={(e) => set("minimumPrice")(e.target.value)}
          />
          <SelectField
            label="Supply"
            value={form.supplyType}
            onChange={set("supplyType")}
            options={SUPPLY_TYPES.map((s) => ({ value: s, label: humanize(s) }))}
          />
          {form.supplyType === "consignment" && (
            <Input
              label="Seller customer ID"
              value={form.sellerCustomerId}
              onChange={(e) => set("sellerCustomerId")(e.target.value)}
              required
            />
          )}
          <SelectField
            label="Broker"
            value={form.brokerId}
            onChange={set("brokerId")}
            options={[
              { value: "", label: "Unassigned" },
              ...(brokers.data ?? [])
                .filter((b) => b.active)
                .map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
          <Box display="flex" alignItems="flex-end">
            <Button type="submit" disabled={busy}>
              Register vehicle
            </Button>
          </Box>
        </Box>
      </Section>
    </Page>
  );
};

export default VehiclesPage;
