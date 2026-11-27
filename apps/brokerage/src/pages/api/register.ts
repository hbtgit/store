import { createAppRegisterHandler } from "@saleor/app-sdk/handlers/next";

import { saleorApp } from "@/saleor-app";

/**
 * Called by Saleor during installation to hand over the app token.
 * When SALEOR_API_URL is set, only that Saleor instance may install the app.
 */
export default createAppRegisterHandler({
  apl: saleorApp.apl,
  allowedSaleorUrls: process.env.SALEOR_API_URL ? [process.env.SALEOR_API_URL] : [],
});
