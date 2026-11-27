import type { NextApiRequest, NextApiResponse } from "next";

import { servicesFor } from "@/container";
import { sendError } from "@/lib/api-route";
import { submitInquiryBody } from "@/lib/schemas";
import { saleorApp } from "@/saleor-app";

/**
 * Storefront endpoint: buyers submit questions, test drive requests and
 * offers. Only the storefront origin in STOREFRONT_ORIGIN may call it from a
 * browser. The response omits broker routing and the below-minimum flag.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = process.env.STOREFRONT_ORIGIN;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    const saleorApiUrl = process.env.SALEOR_API_URL;
    if (!saleorApiUrl) throw new Error("SALEOR_API_URL is not set");
    const authData = await saleorApp.apl.get(saleorApiUrl);
    if (!authData)
      return res.status(503).json({ error: "NOT_INSTALLED", message: "App is not installed" });

    const services = await servicesFor(authData);
    const inquiry = await services.inquiries.submit(submitInquiryBody.parse(req.body));
    return res.status(201).json({ id: inquiry.id, kind: inquiry.kind, status: inquiry.status });
  } catch (err) {
    return sendError(res, err);
  }
}
