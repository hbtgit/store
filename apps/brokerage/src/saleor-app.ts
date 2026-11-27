import { APL } from "@saleor/app-sdk/APL";
import { FileAPL } from "@saleor/app-sdk/APL/file";
import { SaleorApp } from "@saleor/app-sdk/saleor-app";

/**
 * The APL (auth persistence layer) stores the token Saleor issues when the app
 * is installed. FileAPL keeps it in a local JSON file, which is fine for one
 * Saleor instance and one app container with a persistent volume. For several
 * replicas use a shared APL from @saleor/app-sdk (for example Upstash or Redis).
 */
export const apl: APL = new FileAPL({
  fileName: process.env.APL_FILE_PATH ?? ".saleor-app-auth.json",
});

export const saleorApp = new SaleorApp({ apl });
