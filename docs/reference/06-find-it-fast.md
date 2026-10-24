# 06 · Find It Fast

A task-first index. Use this when you know **what you want to change** but not **where it lives**.

> Snapshot: `b306db3` · 2026-10-24.

---

## Start with these ten files

If you only read ten files to regain orientation:

| #   | File                                                             | Why                                                  |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | `apps/api/src/main.ts`                                           | Bootstrap, Swagger, contract generation, middleware. |
| 2   | `apps/api/src/app.module.ts`                                     | Global pipes/guards/filters + domain composition.    |
| 3   | `apps/api/src/domain/manifest.ts`                                | The 13 domains, routes, dependencies, optionality.   |
| 4   | `apps/api/src/modules/catalog/units/`                            | Golden CRUD module (all four layers).                |
| 5   | `packages/api-contracts/src/resources/index.ts`                  | Every resource + the `resources` map.                |
| 6   | `packages/api-client/src/api.ts`                                 | Every client registration.                           |
| 7   | `apps/dashboard/shared/data-view/resource/generate-resource.tsx` | The dashboard CRUD factory.                          |
| 8   | `apps/dashboard/modules/units/`                                  | Golden dashboard module.                             |
| 9   | `apps/dashboard/config/navGroups.tsx`                            | Visible navigation tree.                             |
| 10  | `packages/db-prisma/src/schema/`                                 | The actual data model.                               |

---

## “I want to…”

| Task                         | Go here                                                        | Also check                                |
| ---------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| Find an HTTP endpoint        | `apps/api/src/modules/**/**.controller.ts`                     | `apps/api/openapi.yaml`, Swagger `/docs`  |
| Find a Prisma model          | `packages/db-prisma/src/schema/*.prisma`                       | Migration folder, generated client        |
| Find an API response shape   | `packages/api-contracts/types/index.ts` (generated)            | Presenter + DTO                           |
| Find a dashboard page        | `apps/dashboard/app/[locale]/**/page.tsx`                      | Module component it imports               |
| Find a dashboard CRUD module | `apps/dashboard/modules/<feature>/`                            | `generateResource` config                 |
| Find a form schema/mapper    | `modules/<feature>/<feature>.config.ts`                        | `useResourceFormController`               |
| Find table columns           | `modules/<feature>/components/*-columns.tsx`                   | `DataTable` helpers                       |
| Find a permission key        | `packages/api-contracts/src/permissions/permission-catalog.ts` | `default-role-permissions.ts`, API guards |
| Find a translation           | `packages/i18n/src/{ar,en,tr}/`                                | `useTranslations(...)` namespace          |
| Find a nav item              | `apps/dashboard/config/navGroups.tsx`                          | `settings-navigation.ts`                  |
| Find a business rule         | Service `before*` hooks or a posting/movement policy           | Domain rules in `.ai/rules/domain.md`     |
| Find a journal entry rule    | `apps/api/src/modules/accounting/posting/policies/`            | `FinancialSettingsService`                |
| Find a stock rule            | `apps/api/src/modules/inventory/movements/policies/`           | `StockMovementWriter`                     |
| Find a background job        | `apps/api/src/outbox/` or `@Interval` services                 | `OUTBOX_ENABLED`                          |
| Find an AI tool              | `**/*.ai-tools.ts` + `@AiToolProvider`                         | `AiToolRegistry`                          |
| Find a database migration    | `packages/db-prisma/src/schema/migrations/`                    | `prisma migrate dev`                      |
| Find a seed                  | `packages/db-prisma/src/seed/seeds/`                           | `seed/index.ts`                           |
| Find import/export behavior  | `packages/backend-core/src/base/crud-import*`                  | `units-import-export.controller.ts`       |
| Find file storage behavior   | `apps/api/src/modules/files/storage/`                          | `STORAGE_TYPE`, `uploads/`                |
| Find the dashboard shell     | `apps/dashboard/infrastructure/components/layout/dashboard/`   | `(authenticated)/layout.tsx`              |
| Find a settings page         | `apps/dashboard/modules/settings/settings-navigation.ts`       | `app/[locale]/(authenticated)/settings/`  |

---

## New CRUD resource

This is the full-stack checklist. Copy **units**; do not invent a parallel pattern.

### 1. Database

```text
packages/db-prisma/src/schema/<resource>.prisma
```

- Add `tenantId`, tenant relation, `@@index([tenantId])`, `@@map(...)`.
- Add a migration:
  ```bash
  pnpm --filter @devloggers/db-prisma db:migrate:dev
  ```
- Regenerate the client:
  ```bash
  pnpm --filter @devloggers/db-prisma db:generate
  ```
- If the resource needs seed data, add an idempotent seed under `src/seed/seeds/` and register it in `src/seed/index.ts`.

### 2. Contract

```text
packages/api-contracts/src/resources/<resource>.resource.ts
packages/api-contracts/src/resources/index.ts
```

- Use `defineCrudResource({ key, routes })`.
- Add the import + export + `resources` map entry.
- Keep route paths exactly aligned with `@Controller(...)`; the generated `ApiPath` type will catch drift after regeneration.
- Add DTOs only if the resource needs a shared DTO; otherwise keep request/response DTOs in `apps/api`.

### 3. API module

```text
apps/api/src/modules/<domain>/<resource>/
├── controllers/<resource>.controller.ts
├── services/<resource>.service.ts
├── repositories/<resource>.repository.ts
├── presenters/<resource>.presenter.ts
├── dto/
├── events/                    optional
├── <resource>.ai-tools.ts     optional
└── <resource>.module.ts
```

- Register the module in the domain module (e.g. `catalog.module.ts`).
- If this is a new domain, add it to `src/domain/manifest.ts`, `src/domain/domain-modules.ts`, and the domain-isolation test.
- Add `permissions` to `createCrudController` and the `@RequirePermission` keys.
- Keep HTTP concerns in the controller, business rules in the service, queries in the repository.

### 4. Permissions

```text
packages/api-contracts/src/permissions/permission-catalog.ts
packages/api-contracts/src/permissions/default-role-permissions.ts
apps/dashboard/config/resource-permissions.ts
apps/dashboard/config/navGroups.tsx
```

- Add `view` / `create` / `update` / `delete` keys.
- Seed default roles with the new keys where appropriate.
- Register dashboard cosmetic gates.
- Gate the nav item.

### 5. API client

```text
packages/api-client/src/clients/<resource>.client.ts
packages/api-client/src/clients/index.ts
packages/api-client/src/api.ts
```

```ts
export class ThingsClient extends CrudClient<typeof thingResource> {
  constructor(apiClient: ApiClient) {
    super(apiClient, thingResource);
  }
}
```

Register it under `[thingResource.key]` in `createApi()`.

### 6. Dashboard module

```text
apps/dashboard/modules/<feature>/
├── <feature>.resource.ts
├── <feature>.config.ts
├── components/
│   ├── <feature>-page.tsx
│   ├── <feature>-form.tsx
│   └── <feature>-columns.tsx
├── hooks/
└── index.ts
```

- `generateResource<ThingsClient>({ getClient, paramKey, list })`.
- Zod schema + defaults + `mapToFormValues` + `toCreate` / `toUpdate`.
- Form uses `useResourceFormController` + `ResourceFormShell`.
- Columns use `ColumnHeader`, `BooleanCell`, and `helpers.actionsColumn()`.

### 7. Route and navigation

```text
apps/dashboard/app/[locale]/(authenticated)/<group>/<route>/page.tsx
apps/dashboard/config/navGroups.tsx
packages/i18n/src/{ar,en,tr}/business.json
```

- Keep the route page thin: import and render the module page.
- Add the nav item with `permission` and, if applicable, `readinessModule`.
- Add translations to all three locales.

### 8. Regenerate + verify

```bash
pnpm generate
pnpm --filter @devloggers/api-contracts build
pnpm --filter @devloggers/api-client build
pnpm --filter @devloggers/api lint
pnpm --filter @devloggers/api test
pnpm --filter @devloggers/dashboard lint
pnpm --filter @devloggers/dashboard typecheck
pnpm --filter @devloggers/dashboard test:unit
```

Open the page in all three locales. Check create, edit, delete, empty state, pagination, and a validation error.

---

## Add a field to an existing resource

| Layer                | File                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| DB                   | `packages/db-prisma/src/schema/<resource>.prisma` + migration        |
| API DTO              | `apps/api/src/modules/<domain>/<resource>/dto/`                      |
| Presenter            | `presenters/<resource>.presenter.ts`                                 |
| Service mapping      | `services/<resource>.service.ts` if the field is computed/normalized |
| Contract             | only if the field is shared beyond the resource; regenerate types    |
| Dashboard schema     | `modules/<feature>/<feature>.config.ts`                              |
| Dashboard field      | `components/<feature>-form.tsx`                                      |
| Dashboard table/card | `components/<feature>-columns.tsx` / card                            |
| Translation          | all three locale files                                               |

If the field changes an API response, run `pnpm generate` before fixing dashboard types.

---

## Add a page without CRUD

1. Add `page.tsx` under the correct route group.
2. Put real UI in `modules/<feature>/components/`.
3. Add a nav entry only if users should reach it from the sidebar.
4. Add translations.
5. If the page is server-rendered and needs auth, use `getAuthApi()` from `shared/api.ts`; do not call the API from a client component without `useApi()`.

Route groups:

- public → `app/[locale]/landing/` or `(auth)/`
- protected → `(authenticated)/`
- onboarding → `(setup)/`
- print → `(print)/`

---

## Change an invoice / payment / stock rule

| Change                    | Do                                                                                                        | Do not                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Invoice posting lines     | Add/modify a policy under `accounting/posting/policies/` and register it in `posting-policy.registry.ts`. | Write `journalEntry.create` in a controller. |
| Invoice status transition | Update `InvoicePostingService` inside the transaction.                                                    | Flip status in the controller.               |
| Stock movement            | Add a movement policy and call `InventoryMovementFacade.apply()`.                                         | Update `StockBalance` directly.              |
| Payment allocation        | Use `PaymentsService.allocate()` + its guards.                                                            | Create a `PaymentAllocation` row by hand.    |
| Cancellation              | Reversal + status update.                                                                                 | Delete a posted document.                    |
| Financial mappings        | `FinancialSettingsService` / `financial-settings` module.                                                 | Hard-code account IDs.                       |
| Document numbering        | `DocumentSequencesService.getNextNumber()`.                                                               | Generate numbers in the frontend.            |

Domain invariants live in [`docs/agents/domain.md`](../agents/domain.md) and `.ai/rules/domain.md`.

---

## Debugging commands

```bash
# Find a symbol / string across tracked files
git grep -n "clientRequestId"
git grep -n "partial payment"
git grep -n "units.create"

# Find route declarations
git grep -n "@Controller(" apps/api/src/modules

# Find permission usage
git grep -n "RequirePermission" apps/api/src/modules

# Find translation keys
git grep -n "business.resources.units" packages/i18n apps/dashboard

# Find generated contract types
git grep -n "Units.list" packages/api-contracts/types/index.ts

# Find a Prisma model
git grep -n "model Invoice" packages/db-prisma/src/schema
```

PowerShell equivalent when `git grep` is unavailable:

```powershell
Get-ChildItem apps/api/src -Recurse -File -Include *.ts |
  Select-String -Pattern "@Controller\("
```

---

## Naming conventions

| Thing             | Convention             | Example                      |
| ----------------- | ---------------------- | ---------------------------- |
| Directory         | kebab-case             | `item-categories/`           |
| TS file           | kebab-case             | `invoice-posting.service.ts` |
| Class             | PascalCase             | `InvoicePostingService`      |
| Function / method | camelCase              | `postSalesInvoice`           |
| DB table          | snake_case via `@@map` | `invoice_lines`              |
| DB column         | snake_case via `@map`  | `tenant_id`                  |
| TS property       | camelCase              | `tenantId`                   |
| Permission        | `<resource>.<verb>`    | `invoices.post`              |
| Event             | `<resource>.created`   | `unit.created`               |
| Contract resource | `<key>Resource`        | `unitResource`               |
| Dashboard module  | plural kebab-case      | `modules/units/`             |

---

## Generated, legacy, and do-not-touch

### Generated — regenerate, never edit

```text
packages/api-contracts/types/index.ts
apps/api/openapi.yaml
packages/db-prisma/generated/client/**
```

### Historical docs — verify before trusting

```text
docs/file-structure.md
docs/architecture.md
docs/modules.md
docs/DATABASE_SCHEMA.md
docs/api.md
```

This folder is the current tree/flow reference. Domain rules and ADRs are still authoritative in their own areas.

### Orphaned / stale code or scripts

| Item                                 | Reality                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `packages/contracts/`                | `dist/` only, no `package.json` or source.                                                  |
| `packages/import-export/`            | `dist/` + `node_modules`, no manifest/source.                                               |
| `packages/ui/`                       | Three starter components; not the dashboard design system.                                  |
| `apps/api` `db:*` scripts            | Point at `packages/db`; actual package is `packages/db-prisma`.                             |
| `apps/dashboard` `predev`/`prebuild` | Call API script `generate`, which does not exist; root `pnpm generate` is the working path. |
| `apps/api/.env.development`          | Not gitignored; keep secrets out of commits.                                                |

If you are unsure whether a path is live, check:

1. Is it imported anywhere? `git grep "the/path"`.
2. Does it have a `package.json` and appear in `pnpm list -r --depth -1`?
3. Is it referenced by `turbo.json` or a root script?
4. Is it generated output (`.next`, `dist`, `generated`)?

---

## Verification matrix

| You changed                    | Minimum checks                                                 |
| ------------------------------ | -------------------------------------------------------------- |
| Prisma schema                  | `db:migrate:dev`, `db:generate`, API typecheck, affected tests |
| API DTO / controller / Swagger | `pnpm generate`, contracts build, API lint/test                |
| API business logic             | API lint/test, targeted flow test                              |
| `api-contracts` resource       | contracts build + typecheck, clients build                     |
| `api-client`                   | clients build + test, dashboard typecheck                      |
| Dashboard module               | dashboard lint, typecheck, `test:unit`; manual smoke           |
| i18n                           | check all three locales for the key                            |
| Permission                     | API guard test + dashboard nav visibility                      |
| Generated files                | regenerate; never hand-edit                                    |

---

## If you are completely lost

Use this order:

1. Read [README](README.md) and [01 · Monorepo map](01-monorepo.md).
2. Open the units slice end-to-end.
3. Pick one user action (e.g. “create unit”) and trace it through the six layers.
4. Read [05 · Core workflows](05-workflows.md) for the transaction-heavy paths.
5. Use `git log --oneline -- <path>` to see why a file exists.
6. Check the matching skill in `.ai/skills/` before writing code.
