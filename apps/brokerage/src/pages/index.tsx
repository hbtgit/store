import { useAppBridge } from "@saleor/app-sdk/app-bridge";
import { Box, Button, Input, Text } from "@saleor/macaw-ui";
import { NextPage } from "next";
import Link from "next/link";

/** Landing page. Inside the dashboard it links to the app's pages; outside it offers installation. */
const IndexPage: NextPage = () => {
  const { appBridgeState } = useAppBridge();

  if (appBridgeState?.ready) {
    return (
      <Box padding={8} display="flex" flexDirection="column" gap={4}>
        <Text size={10} fontWeight="bold">
          Car Brokerage
        </Text>
        <Box display="flex" gap={3}>
          <Link href="/vehicles">
            <Button variant="secondary">Vehicles</Button>
          </Link>
          <Link href="/inquiries">
            <Button variant="secondary">Inquiries</Button>
          </Link>
          <Link href="/deals">
            <Button variant="secondary">Deals and commissions</Button>
          </Link>
        </Box>
      </Box>
    );
  }

  return (
    <Box padding={8} display="flex" flexDirection="column" gap={4}>
      <Text size={10} fontWeight="bold">
        Car Brokerage app for Saleor
      </Text>
      <Text>Install it from your Saleor dashboard:</Text>
      <Box
        as="form"
        display="flex"
        alignItems="center"
        gap={4}
        onSubmit={(event) => {
          event.preventDefault();
          const dashboardUrl = new FormData(event.currentTarget as HTMLFormElement).get(
            "dashboard-url"
          ) as string;
          const manifestUrl = new URL("/api/manifest", window.location.origin);
          window.open(
            new URL(`/dashboard/apps/install?manifestUrl=${manifestUrl}`, dashboardUrl).href,
            "_blank"
          );
        }}
      >
        <Input type="url" required label="Saleor dashboard URL" name="dashboard-url" />
        <Button type="submit">Install</Button>
      </Box>
    </Box>
  );
};

export default IndexPage;
