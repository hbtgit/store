import { Box, Text } from "@saleor/macaw-ui";
import { NextPage } from "next";
import { useState } from "react";

import { StatusActions } from "@/components/StatusActions";
import { ErrorText, formatMoney, humanize, Page, SelectField, Table } from "@/components/ui";
import { BrokerDto, InquiryDto, ListingDto } from "@/lib/api-types";
import { useApi, useResource } from "@/lib/use-api";
import { INQUIRY_STATUSES, InquiryStatus, nextInquiryStatuses } from "@/modules/inquiries/domain";

const InquiriesPage: NextPage = () => {
  const api = useApi();
  const [status, setStatus] = useState("");
  const inquiries = useResource<InquiryDto[]>(`/api/inquiries${status ? `?status=${status}` : ""}`);
  const brokers = useResource<BrokerDto[]>("/api/brokers");
  const listings = useResource<ListingDto[]>("/api/vehicles");
  const [error, setError] = useState<string | null>(null);

  const vin = (productId: string) =>
    listings.data?.find((l) => l.productId === productId)?.vin ?? productId;

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      inquiries.reload();
      listings.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Page title="Inquiries">
      <Box __maxWidth="240px">
        <SelectField
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "All" },
            ...INQUIRY_STATUSES.map((s) => ({ value: s, label: humanize(s) })),
          ]}
        />
      </Box>
      <ErrorText error={error ?? inquiries.error} />
      <Table
        head={["Received", "Vehicle", "Type", "Contact", "Details", "Broker", "Status", "Move to"]}
        empty="No inquiries."
        rows={(inquiries.data ?? []).map((i) => [
          new Date(i.createdAt).toLocaleString(),
          vin(i.productId),
          humanize(i.kind),
          <Box key="contact" display="flex" flexDirection="column">
            <Text size={3}>{i.contactName}</Text>
            <Text size={2} color="default2">
              {i.contactEmail}
              {i.contactPhone ? ` / ${i.contactPhone}` : ""}
            </Text>
          </Box>,
          <Box key="details" display="flex" flexDirection="column" gap={1}>
            {i.offerCents != null && (
              <Box display="flex" flexDirection="column">
                <Text size={3}>Offer {formatMoney(i.offerCents)}</Text>
                {i.belowMinimum && (
                  <Text size={2} color="critical1" fontWeight="bold">
                    Below the seller&apos;s minimum
                  </Text>
                )}
              </Box>
            )}
            {i.preferredDate && <Text size={3}>Preferred {i.preferredDate}</Text>}
            {i.message && <Text size={2}>{i.message}</Text>}
          </Box>,
          <SelectField
            key="broker"
            label=""
            value={i.brokerId ?? ""}
            onChange={(brokerId) =>
              brokerId &&
              run(() =>
                api(`/api/inquiries/${i.id}/assign`, { method: "POST", body: { brokerId } })
              )
            }
            options={[
              { value: "", label: "Unassigned" },
              ...(brokers.data ?? [])
                .filter((b) => b.active)
                .map((b) => ({ value: b.id, label: b.name })),
            ]}
          />,
          humanize(i.status),
          <StatusActions
            key="actions"
            next={nextInquiryStatuses(i)}
            onChange={(to: InquiryStatus) =>
              run(() =>
                api(`/api/inquiries/${i.id}/status`, { method: "POST", body: { status: to } })
              )
            }
          />,
        ])}
      />
    </Page>
  );
};

export default InquiriesPage;
