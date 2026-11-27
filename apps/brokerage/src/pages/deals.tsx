import { Box, Button, Input, Text } from "@saleor/macaw-ui";
import { NextPage } from "next";
import { FormEvent, useState } from "react";

import {
  ErrorText,
  formatMoney,
  formatRate,
  humanize,
  Page,
  parseMoney,
  Section,
  SelectField,
  Table,
} from "@/components/ui";
import { BrokerDto, BrokerSummaryDto, DealDto, ListingDto } from "@/lib/api-types";
import { useApi, useResource } from "@/lib/use-api";

const DealsPage: NextPage = () => {
  const api = useApi();
  const deals = useResource<DealDto[]>("/api/deals");
  const summary = useResource<BrokerSummaryDto[]>("/api/deals/summary");
  const brokers = useResource<BrokerDto[]>("/api/brokers");
  const listings = useResource<ListingDto[]>("/api/vehicles");
  const [error, setError] = useState<string | null>(null);

  const [deal, setDeal] = useState({
    productId: "",
    salePrice: "",
    currency: "USD",
    brokerId: "",
    rate: "",
  });
  const [broker, setBroker] = useState({ name: "", email: "", rate: "" });

  const brokerName = (id: string) => brokers.data?.find((b) => b.id === id)?.name ?? id;
  const openListings = (listings.data ?? []).filter(
    (l) => l.status === "listed" || l.status === "reserved"
  );

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      deals.reload();
      summary.reload();
      brokers.reload();
      listings.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const closeDeal = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api("/api/deals", {
        method: "POST",
        body: {
          productId: deal.productId,
          salePriceCents: parseMoney(deal.salePrice) ?? 0,
          currency: deal.currency,
          brokerId: deal.brokerId || null,
          commissionRateBp: deal.rate ? Math.round(Number(deal.rate) * 100) : null,
        },
      });
      setDeal({ productId: "", salePrice: "", currency: deal.currency, brokerId: "", rate: "" });
    });
  };

  const addBroker = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api("/api/brokers", {
        method: "POST",
        body: {
          name: broker.name,
          email: broker.email,
          defaultCommissionRateBp: Math.round(Number(broker.rate) * 100),
        },
      });
      setBroker({ name: "", email: "", rate: "" });
    });
  };

  return (
    <Page title="Deals and commissions">
      <ErrorText error={error ?? deals.error ?? brokers.error} />

      <Section title="Commission by broker">
        <Table
          head={["Broker", "Deals", "Sales", "Commission", "Paid", "Outstanding"]}
          empty="No closed deals yet."
          rows={(summary.data ?? []).map((s) => [
            s.brokerName,
            s.deals,
            formatMoney(s.salesCents, s.currency),
            formatMoney(s.commissionCents, s.currency),
            formatMoney(s.commissionPaidCents, s.currency),
            formatMoney(s.commissionOutstandingCents, s.currency),
          ])}
        />
      </Section>

      <Section title="Deals">
        <Table
          head={[
            "Closed",
            "VIN",
            "Supply",
            "Broker",
            "Sale price",
            "Rate",
            "Commission",
            "Seller payout",
            "Commission paid",
          ]}
          empty="No deals yet."
          rows={(deals.data ?? []).map((d) => [
            new Date(d.closedAt).toLocaleDateString(),
            d.vin,
            humanize(d.supplyType),
            brokerName(d.brokerId),
            formatMoney(d.salePriceCents, d.currency),
            formatRate(d.commissionRateBp),
            formatMoney(d.commissionCents, d.currency),
            formatMoney(d.sellerPayoutCents, d.currency),
            <Button
              key="paid"
              size="small"
              variant={d.commissionPaidAt ? "tertiary" : "secondary"}
              onClick={() =>
                run(() =>
                  api(`/api/deals/${d.id}/commission-paid`, {
                    method: "POST",
                    body: { paid: !d.commissionPaidAt },
                  })
                )
              }
            >
              {d.commissionPaidAt
                ? `Paid ${new Date(d.commissionPaidAt).toLocaleDateString()}`
                : "Mark paid"}
            </Button>,
          ])}
        />
      </Section>

      <Section title="Close a deal manually">
        <Text color="default2">
          Deals for vehicles bought through Saleor checkout close automatically when the order is
          fully paid.
        </Text>
        <Box
          as="form"
          onSubmit={closeDeal}
          display="grid"
          gridTemplateColumns={3}
          gap={4}
          __maxWidth="900px"
        >
          <SelectField
            label="Vehicle"
            value={deal.productId}
            onChange={(productId) => setDeal((d) => ({ ...d, productId }))}
            options={[
              { value: "", label: "Choose a vehicle" },
              ...openListings.map((l) => ({
                value: l.productId,
                label: `${l.vin} (${humanize(l.status)})`,
              })),
            ]}
          />
          <Input
            label="Sale price"
            value={deal.salePrice}
            onChange={(e) => setDeal((d) => ({ ...d, salePrice: e.target.value }))}
            required
          />
          <Input
            label="Currency"
            value={deal.currency}
            onChange={(e) => setDeal((d) => ({ ...d, currency: e.target.value.toUpperCase() }))}
            required
          />
          <SelectField
            label="Broker"
            value={deal.brokerId}
            onChange={(brokerId) => setDeal((d) => ({ ...d, brokerId }))}
            options={[
              { value: "", label: "Vehicle's broker" },
              ...(brokers.data ?? []).map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
          <Input
            label="Commission rate % (optional)"
            value={deal.rate}
            onChange={(e) => setDeal((d) => ({ ...d, rate: e.target.value }))}
          />
          <Box display="flex" alignItems="flex-end">
            <Button type="submit" disabled={!deal.productId}>
              Close deal
            </Button>
          </Box>
        </Box>
      </Section>

      <Section title="Brokers">
        <Table
          head={["Name", "Email", "Default rate", "Active"]}
          empty="No brokers yet."
          rows={(brokers.data ?? []).map((b) => [
            b.name,
            b.email,
            formatRate(b.defaultCommissionRateBp),
            <Button
              key="active"
              size="small"
              variant="tertiary"
              onClick={() =>
                run(() =>
                  api(`/api/brokers/${b.id}`, { method: "PATCH", body: { active: !b.active } })
                )
              }
            >
              {b.active ? "Active (deactivate)" : "Inactive (activate)"}
            </Button>,
          ])}
        />
        <Box
          as="form"
          onSubmit={addBroker}
          display="grid"
          gridTemplateColumns={4}
          gap={4}
          __maxWidth="900px"
        >
          <Input
            label="Name"
            value={broker.name}
            onChange={(e) => setBroker((b) => ({ ...b, name: e.target.value }))}
            required
          />
          <Input
            label="Email"
            type="email"
            value={broker.email}
            onChange={(e) => setBroker((b) => ({ ...b, email: e.target.value }))}
            required
          />
          <Input
            label="Default commission %"
            value={broker.rate}
            onChange={(e) => setBroker((b) => ({ ...b, rate: e.target.value }))}
            required
          />
          <Box display="flex" alignItems="flex-end">
            <Button type="submit">Add broker</Button>
          </Box>
        </Box>
      </Section>
    </Page>
  );
};

export default DealsPage;
