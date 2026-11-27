# Brokerage app

A [Saleor App](https://docs.saleor.io/developer/extending/apps/overview) that adds vehicle
listings, buyer inquiries, deals and broker commissions to Saleor. Started from
[saleor-app-template](https://github.com/saleor/saleor-app-template) (BSD-3, see LICENSE).

Setup, architecture and API are documented at the repository root:
[README](../../README.md) and [docs/architecture.md](../../docs/architecture.md).

| Command | Does |
|---|---|
| `pnpm dev` | Run the app on http://localhost:3000 |
| `pnpm provision` | Create the vehicle catalog objects in Saleor (idempotent) |
| `pnpm migrate` | Apply app database migrations (also automatic on first use) |
| `pnpm test` | Domain and service tests |
| `pnpm check-types`, `pnpm lint`, `pnpm format` | Static checks |

Configuration is read from `.env`; see `.env.example`.
