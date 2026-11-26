# 03 · Dashboard Atlas

`apps/dashboard` is a Next.js 16 App Router application: Arabic-first (RTL), locale-prefixed routes, 38 feature modules, and a shared compound “resource” system for CRUD screens.

> Snapshot: `b306db3` · 2026-10-24. There are **58 `page.tsx` files**, 52 of them inside `(authenticated)` (the rest are auth, setup, print, landing and breadcrumb slots).

---

## Directory shape

```text
apps/dashboard/
├── app/
│   ├── layout.tsx                  root layout
│   ├── globals.css                 Tailwind v4 theme + CSS variables
│   └── [locale]/
│       ├── layout.tsx              next-intl provider + app providers
│       ├── (auth)/                 login, register
│       ├── (authenticated)/        protected shell
│       │   ├── layout.tsx          auth check + sidebar + breadcrumbs
│       │   ├── @breadcrumbs/       parallel route slot
│       │   ├── page.tsx            dashboard home
│       │   ├── ai/  cashier/  catalog/  finance/  inventory/
│       │   ├── parties/  profile/  purchases/  reports/  sales/
│       │   ├── settings/  setup/
│       ├── (print)/                printable invoice layouts
│       ├── (setup)/                onboarding layout
│       └── landing/                public landing page
├── modules/                        feature UI (lists, forms, columns, hooks)
├── shared/
│   ├── data-view/                  resource + table + filter architecture
│   ├── components/                 UI primitives, form fields, editable grid
│   ├── hooks/                      form/resource/auth/permission hooks
│   ├── custom-fields/              dynamic field renderers
│   ├── stores/                     Zustand auth store
│   ├── lib/                        client utilities
│   ├── api.ts                      server-side getAuthApi()
│   └── useApi.ts                   client-side useApi re-export
├── infrastructure/
│   ├── components/                 dashboard shell, sidebar, header, providers
│   └── types/                      navigation types
├── config/
│   ├── navGroups.tsx               sidebar tree
│   ├── filter-nav-groups.ts        permission filtering
│   ├── resource-permissions.ts     cosmetic create/update/delete gates
│   └── constants.ts                API URL
├── i18n/                           routing/request config
├── middleware.ts                   next-intl locale middleware
├── next.config.mjs
└── package.json
```

---

## Route groups and URL shape

`next-intl` is configured with `localePrefix: "always"` and `defaultLocale: "ar"`. Real URLs therefore look like `/ar/catalog/units`, `/en/sales/invoices`, `/tr/settings`.

| Route group       | URL examples                                      | Layout / behavior                                                          |
| ----------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| `(auth)`          | `/ar/login`, `/ar/register`                       | Public auth screens.                                                       |
| `(setup)`         | `/ar/onboarding`                                  | First-run tenant onboarding; redirect target until onboarding is complete. |
| `(authenticated)` | `/ar/`, `/ar/catalog/units`, `/ar/sales/invoices` | Server-side token check + `/auth/me`; redirects to login or onboarding.    |
| `(print)`         | `/ar/sales/invoices/[id]/print`                   | Standalone print layout.                                                   |
| `landing`         | `/ar/landing`                                     | Public marketing page.                                                     |

### Authenticated page map

| Area      | Pages                                                                                                                                                                                                                                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home      | `/`                                                                                                                                                                                                                                                                                                                         |
| AI        | `/ai`, `/ai/[conversationId]`                                                                                                                                                                                                                                                                                               |
| POS       | `/cashier`                                                                                                                                                                                                                                                                                                                  |
| Catalog   | `/catalog/items`, `/catalog/items/new`, `/catalog/items/[id]/edit`, `/catalog/categories`, `/catalog/units`, `/catalog/units/[id]`, `/catalog/brands`, `/catalog/tags`, `/catalog/catalog-entities`, `/catalog/custom-fields`                                                                                               |
| Inventory | `/inventory/warehouses`, `/inventory/stock-balances`, `/inventory/stock-movements`, `/inventory/stock-counts`, `/inventory/opening-balances`                                                                                                                                                                                |
| Finance   | `/finance/cashboxes`, `/finance/bank-accounts`, `/finance/expenses`, `/finance/payments`, `/finance/chart-of-accounts`, `/finance/opening-balances`                                                                                                                                                                         |
| Parties   | `/parties/customers`, `/parties/suppliers`                                                                                                                                                                                                                                                                                  |
| Purchases | `/purchases/invoices`                                                                                                                                                                                                                                                                                                       |
| Sales     | `/sales/invoices`                                                                                                                                                                                                                                                                                                           |
| Reports   | `/reports/stock`, `/reports/sales`, `/reports/purchases`, `/reports/customers`                                                                                                                                                                                                                                              |
| Settings  | `/settings`, `/settings/company`, `/settings/branches`, `/settings/localization`, `/settings/financial`, `/settings/defaults`, `/settings/gl-accounts`, `/settings/documents`, `/settings/users`, `/settings/roles`, `/settings/currencies`, `/settings/fiscal-periods`, `/settings/document-sequences`, `/settings/danger` |
| Account   | `/profile`, `/setup`                                                                                                                                                                                                                                                                                                        |
| Print     | `/sales/invoices/[id]/print`, `/purchases/invoices/[id]/print`                                                                                                                                                                                                                                                              |

`navGroups.tsx` may show links that are permission-gated or readiness-gated. The **page files above are the routes that actually exist**. Use both when debugging “I can see the link but the page is empty”.

---

## Feature module anatomy

Every dashboard feature lives in `modules/<feature>/` and usually follows this shape:

```text
modules/units/
├── units.resource.ts               generateResource<UnitsClient>({ … })
├── units.config.ts                 Zod schema, defaults, mappers, toCreate/toUpdate
├── components/
│   ├── units-page.tsx              composition: Provider → Page → Table
│   ├── units-form.tsx              RHF form + ResourceFormShell
│   ├── units-columns.tsx           TanStack Table columns
│   └── unit-card.tsx               optional card/grid view
├── hooks/
│   ├── use-units-resource.ts       typed useResourceContext wrapper
│   └── index.ts
└── index.ts                        barrel exports
```

### The units page

```tsx
"use client";

export function UnitsPage() {
  const t = useTranslations("business.resources.units");

  return (
    <UnitsResource>
      <UnitsResource.Page
        title={t("title")}
        actions={
          <UnitsResource.FormDialog
            title={(item) => (item?.id ? item.name : t("addAction"))}
            form={UnitsForm}
          />
        }
      >
        <UnitsResource.Table
          columns={(helpers) => createUnitsColumns(helpers, t)}
        />
      </UnitsResource.Page>
    </UnitsResource>
  );
}
```

### The units resource

```ts
export const UnitsResource = generateResource<UnitsClient>({
  getClient: (api) => api.units,
  paramKey: "units",
  list: {
    searchIn: ["name", "abbreviation"],
    defaultSort: { field: "name", order: "asc" },
  },
});
```

`generateResource` returns a namespace with:

`Provider`, `Page`, `Table`, `FormDialog`, `CreateButton`, `Grid`, `Pagination`, `Search`, `Filter`, `Toolbar`, `SelectionToolbar`, `useContext`.

The default toolbar layout is **Filter (start) · Search (center) · actions (end)**. You only pass a custom `toolbar` when you need a different arrangement.

### The units form

```tsx
const ctrl = useResourceFormController<UnitsClient, UnitFormValues>({
  config: unitsFormConfig,
  getClient: (api) => api.units,
  entityLabel: t("entity"),
  resourceId,
  initialData,
  paramKey,
  onSuccess,
})

return (
  <ResourceFormShell ctrl={ctrl}>
    <RhfLocalizedTextField name="name" … />
    <RhfTextField name="abbreviation" … />
    {ctrl.isEditing && <RhfCheckboxField name="isActive" … />}
  </ResourceFormShell>
)
```

`units.config.ts` owns the form schema and mapping:

- `schema` — Zod v4 schema.
- `defaultValues` — create defaults.
- `mapToFormValues` — API entity → form values; use `unwrapApiData` for envelope shape.
- `toCreate` / `toUpdate` — form values → DTO.
- No JSX in the config file.

The form controller handles edit initialization, query keys, submit mutation, server validation errors, and dialog close/invalidation. The form component should mostly render fields.

---

## Shared data-view system

This is the most important subsystem for CRUD screens. It lives in `shared/data-view/`.

```text
shared/data-view/
├── resource/
│   ├── generate-resource.tsx       namespace factory
│   ├── resource-context.tsx        Provider + useResourceContext
│   ├── resource-page.tsx           title + toolbar + content layout
│   ├── resource-table.tsx          DataTable + columns + row actions
│   ├── resource-form-dialog.tsx    create/edit dialog
│   ├── resource-search.tsx
│   ├── resource-filter.tsx
│   ├── resource-pagination.tsx
│   ├── resource-grid.tsx
│   ├── resource-selection-toolbar.tsx
│   ├── use-resource-query.ts       list query + params + pagination
│   └── use-resource-mutations.ts   create/update/delete invalidation
├── table-view/                     DataTable, ColumnHeader, BooleanCell, query state
└── filter/                         filter panel primitives
```

Data flow:

```text
UnitsResource (Provider)
  → useResourceQuery()
    → useDataViewQuery()  (page, limit, sort, search, filters in URL/state)
      → api.units.list(query)
        → ApiResponse envelope
  → items / pagination / filterOptions
  → Resource.Table / Grid / Pagination
  → row action → openEdit → FormDialog → useResourceFormController
  → create/update/delete → invalidate query → refetch
```

`Resource.Table` accepts columns or a column factory receiving helpers:

```ts
{
  (actionsColumn, openEdit, deleteItem);
}
```

`Resource.Context` also exposes `canCreate`, `canUpdate`, `canDelete` from `config/resource-permissions.ts`. These are **cosmetic gates**; the API permission guard is the real enforcement.

---

## Data access and auth

| Context                   | Entry point                                                        | Behavior                                                                                                             |
| ------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Client component          | `useApi()` from `@/shared/useApi` → `@devloggers/api-client/react` | `ApiProvider` supplies base URL, JWT, locale.                                                                        |
| Server component / layout | `getAuthApi()` in `shared/api.ts`                                  | Reads the dashboard's `auth_token` + `auth_user` cookies via `getAuthCookies()`, then sends `Authorization: Bearer`. |
| Auth state                | `shared/stores/` + `shared/hooks/use-auth.ts`                      | Token/cookie synchronization and permission access.                                                                  |
| Providers                 | `infrastructure/components/providers.tsx`                          | `NuqsAdapter → ThemeProvider → QueryProvider → ApiProvider` + Toaster + ConfirmDialog.                               |

Server layout auth check (`(authenticated)/layout.tsx`):

1. Read token.
2. `GET /auth/me`.
3. Redirect to `/login` when missing/invalid.
4. Redirect to `/onboarding` when `tenant.onboardingCompletedAt` is null.
5. Filter `navGroups` by the user's permissions.

---

## i18n and RTL

- Locales: `ar` (default, RTL), `en`, `tr`.
- Middleware: `apps/dashboard/middleware.ts`, matcher excludes Next internals/assets.
- Messages: `packages/i18n/src/{ar,en,tr}/business.json` and `system.json`.
- Hooks: `useTranslations("business.resources.units")`, `useTranslations("system.resourceForm")`.
- Navigation labels use keys like `business.navigation.items.units`, not literals.
- Prefer logical CSS (`start` / `end`, `ms-*` / `me-*`) over left/right.

When adding a field, update all three locales. Missing keys can be tolerated by the request config's `MISSING_MESSAGE` handler, which is why a missing translation can silently render a key.

---

## Module directory map

| Module                     | Main route(s)                                         | Purpose                                         |
| -------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| `accounts`                 | `/finance/chart-of-accounts`, `/settings/gl-accounts` | Chart of accounts + GL account selection.       |
| `ai-agent`                 | `/ai`                                                 | Chat UI, conversations, AI SDK transport.       |
| `auth`                     | `/login`, `/register`                                 | Login/register forms + cookie server actions.   |
| `bank-accounts`            | `/finance/bank-accounts`                              | Bank account CRUD.                              |
| `branches`                 | `/settings/branches`                                  | Branch CRUD + default branch.                   |
| `brands`                   | `/catalog/brands`                                     | Brand CRUD.                                     |
| `business-setup`           | `/setup`                                              | Setup checklist, readiness banner, task UI.     |
| `cashboxes`                | `/finance/cashboxes`                                  | Cashbox CRUD.                                   |
| `catalog-entities`         | `/catalog/catalog-entities`                           | Dynamic catalog taxonomy.                       |
| `categories`               | `/catalog/categories`                                 | Item category tree.                             |
| `currencies`               | `/settings/currencies`                                | Currency CRUD + base currency.                  |
| `customers`                | `/parties/customers`                                  | Customer-filtered party view.                   |
| `custom-fields`            | `/catalog/custom-fields`                              | Field definitions + dynamic value rendering.    |
| `document-sequences`       | `/settings/document-sequences`                        | Numbering sequences.                            |
| `expenses`                 | `/finance/expenses`                                   | Expense vouchers.                               |
| `fiscal-periods`           | `/settings/fiscal-periods`                            | Fiscal period lifecycle.                        |
| `home`                     | `/`                                                   | KPI cards, charts, dashboard summary.           |
| `invoices`                 | `/sales/invoices`, `/purchases/invoices`              | Invoice list, multi-line form, posting actions. |
| `items`                    | `/catalog/items` (+ new/edit)                         | Item catalog.                                   |
| `landing`                  | `/landing`                                            | Public landing page.                            |
| `onboarding`               | `/onboarding`                                         | First-run onboarding flow.                      |
| `opening-balance-sessions` | `/finance/opening-balances`                           | GL opening balance sessions.                    |
| `opening-stock`            | `/inventory/opening-balances`                         | Opening stock entry.                            |
| `parties`                  | shared by customers/suppliers                         | Party form/columns.                             |
| `payments`                 | `/finance/payments`                                   | Receipts, disbursements, allocations.           |
| `pos`                      | `/cashier`                                            | POS checkout.                                   |
| `profile`                  | `/profile`                                            | Self-service profile/password.                  |
| `reports`                  | `/reports/*`                                          | Stock/sales/purchase/customer reports.          |
| `roles`                    | `/settings/roles`                                     | Role + permission assignment.                   |
| `settings`                 | `/settings/*`                                         | Settings shell + all settings pages.            |
| `stock-balances`           | `/inventory/stock-balances`                           | Current stock view.                             |
| `stock-counts`             | `/inventory/stock-counts`                             | Physical counts.                                |
| `stock-movements`          | `/inventory/stock-movements`                          | Immutable ledger view.                          |
| `suppliers`                | `/parties/suppliers`                                  | Supplier-filtered party view.                   |
| `tags`                     | `/catalog/tags`                                       | Tag CRUD.                                       |
| `units`                    | `/catalog/units`                                      | Golden CRUD reference.                          |
| `users`                    | `/settings/users`                                     | User management.                                |
| `warehouses`               | `/inventory/warehouses`                               | Warehouse CRUD.                                 |

---

## Where to add dashboard code

| Need                        | Add here                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------- |
| New page                    | `app/[locale]/<group>/<route>/page.tsx`; import a module component                      |
| New CRUD list               | `modules/<feature>/` (copy units) + route page + nav entry + permissions                |
| New form field              | `shared/components/form/fields/` if reusable; otherwise inside the feature form         |
| New shared table behavior   | `shared/data-view/table-view/`                                                          |
| New resource toolbar layout | Compose `Resource.Toolbar` with `Start` / `Center` / `End`                              |
| New nav item                | `config/navGroups.tsx` + translation key + permission                                   |
| New settings page           | `modules/settings/settings-navigation.ts` + `app/[locale]/(authenticated)/settings/...` |
| New print layout            | `app/[locale]/(print)/...`                                                              |
| New auth side effect        | `modules/auth/auth.actions.ts`                                                          |
| New permission              | `packages/api-contracts/src/permissions/` + API guard + `resource-permissions.ts`       |

### Verification

```bash
pnpm --filter @devloggers/dashboard lint
pnpm --filter @devloggers/dashboard typecheck
pnpm --filter @devloggers/dashboard test:unit
```

The dashboard currently has 16 test files (Vitest). Most coverage is in shared utilities/hooks, not every feature module.
