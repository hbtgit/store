import { createManifestHandler } from "@saleor/app-sdk/handlers/next";
import { AppExtension, AppManifest } from "@saleor/app-sdk/types";

import packageJson from "@/package.json";

import { orderFullyPaidWebhook } from "./webhooks/order-fully-paid";

export default createManifestHandler({
  async manifestFactory({ appBaseUrl }) {
    /**
     * In Docker, Saleor reaches the app on the internal network
     * (APP_API_BASE_URL) while the browser loads iframes from the host
     * (APP_IFRAME_BASE_URL).
     */
    const iframeBaseUrl = process.env.APP_IFRAME_BASE_URL || appBaseUrl;
    const apiBaseUrl = process.env.APP_API_BASE_URL || appBaseUrl;

    const extensions: AppExtension[] = [
      {
        label: "Vehicles",
        mount: "NAVIGATION_CATALOG",
        target: "APP_PAGE",
        url: "/vehicles",
        permissions: ["MANAGE_PRODUCTS"],
      },
      {
        label: "Inquiries",
        mount: "NAVIGATION_CUSTOMERS",
        target: "APP_PAGE",
        url: "/inquiries",
        permissions: ["MANAGE_PRODUCTS"],
      },
      {
        label: "Deals and commissions",
        mount: "NAVIGATION_ORDERS",
        target: "APP_PAGE",
        url: "/deals",
        permissions: ["MANAGE_ORDERS"],
      },
      {
        label: "Vehicle listing",
        mount: "PRODUCT_DETAILS_WIDGETS",
        target: "WIDGET",
        url: iframeBaseUrl + "/widgets/vehicle",
        permissions: ["MANAGE_PRODUCTS"],
        options: { widgetTarget: { method: "GET" } },
      },
    ];

    const manifest: AppManifest = {
      id: "car-brokerage.app",
      name: "Car Brokerage",
      version: packageJson.version,
      about: "Vehicle listings, buyer inquiries, deals and broker commissions on top of Saleor.",
      appUrl: iframeBaseUrl,
      tokenTargetUrl: `${apiBaseUrl}/api/register`,
      permissions: ["MANAGE_PRODUCTS", "MANAGE_ORDERS", "MANAGE_USERS"],
      requiredSaleorVersion: ">=3.23 <4",
      webhooks: [orderFullyPaidWebhook.getWebhookManifest(apiBaseUrl)],
      extensions,
      author: "Car Brokerage",
      brand: { logo: { default: `${apiBaseUrl}/logo.png` } },
    };
    return manifest;
  },
});
