import { createProtectedHandler } from "@saleor/app-sdk/handlers/next";
import { Permission } from "@saleor/app-sdk/types";
import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { z, ZodError } from "zod";

import { Services, servicesFor } from "@/container";
import {
  ConflictError,
  DomainError,
  NotFoundError,
  ValidationError,
} from "@/modules/shared/errors";
import { SaleorError } from "@/saleor/graphql-client";
import { saleorApp } from "@/saleor-app";

type Method = "GET" | "POST" | "PATCH";
type Handler = (input: { req: NextApiRequest; services: Services }) => Promise<unknown>;

export function sendError(res: NextApiResponse, err: unknown) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: z.prettifyError(err) });
  }
  if (err instanceof DomainError) {
    const status =
      err instanceof NotFoundError
        ? 404
        : err instanceof ConflictError
        ? 409
        : err instanceof ValidationError
        ? 400
        : 422;
    return res.status(status).json({ error: err.code, message: err.message });
  }
  if (err instanceof SaleorError) {
    console.error("Saleor call failed", err.details ?? err);
    return res.status(502).json({ error: "SALEOR_ERROR", message: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected error" });
}

/**
 * API route reachable only from the Saleor Dashboard (the app iframe sends the
 * dashboard user's token), restricted to staff with the given permissions.
 * Permissions can be set for the whole route or per HTTP method.
 */
export function dashboardRoute(
  handlers: Partial<Record<Method, Handler>>,
  permissions: Permission[] | Partial<Record<Method, Permission[]>>
): NextApiHandler {
  const perMethod = Object.fromEntries(
    (Object.keys(handlers) as Method[]).map((method) => {
      const required = Array.isArray(permissions) ? permissions : permissions[method] ?? [];
      const handler = handlers[method]!;
      return [
        method,
        createProtectedHandler(
          async (req, res, { authData }) => {
            try {
              const services = await servicesFor(authData);
              const result = await handler({ req, services });
              return res.status(req.method === "POST" ? 201 : 200).json(result);
            } catch (err) {
              return sendError(res, err);
            }
          },
          saleorApp.apl,
          required
        ),
      ];
    })
  ) as Partial<Record<Method, NextApiHandler>>;

  return (req, res) => {
    const route = perMethod[req.method as Method];
    if (!route) {
      res.setHeader("Allow", Object.keys(handlers).join(", "));
      return res.status(405).end();
    }
    return route(req, res);
  };
}

/** Reads a single path segment such as [id] from the query string. */
export const param = (req: NextApiRequest, name: string) =>
  z.string().min(1).parse(req.query[name]);
