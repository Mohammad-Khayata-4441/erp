# 05 · Core Workflows

The flows that are hard to reconstruct by reading one file: auth, CRUD, invoice posting, stock, payments, setup, POS, outbox, and the AI agent.

> Snapshot: `b306db3` · 2026-10-24. All financial examples assume a tenant with a base currency, an open fiscal period, and configured Financial Settings.

---

## 1 · Authentication and tenant context

```text
POST /auth/login
  → AuthService.validateUser(email, password)
      → AppUser + roles + permissions + tenant
      → bcrypt.compare(password, passwordHash)
  → JwtService.sign({ sub, tenantId, email })
  → Set-Cookie: access_token (API cookie: httpOnly, sameSite=lax, 24h)
  → response: { user, accessToken }

Dashboard login
  → setAuthCookies(accessToken, user) writes auth_token + auth_user
  → client requests use Authorization: Bearer from the auth store
  → server components use getAuthCookies() → bearer header

Every protected request
  → JwtStrategy reads access_token cookie, then Authorization: Bearer
  → req.user = { id, tenantId, email }
  → JwtAuthGuard
  → PermissionsGuard reads @RequirePermission metadata
  → PermissionResolverService resolves the user's effective permission keys
```

Key files:

- `apps/api/src/modules/identity/auth/auth.service.ts`
- `apps/api/src/modules/identity/auth/strategies/jwt.strategy.ts`
- `apps/api/src/modules/identity/auth/guards/`
- `apps/api/src/modules/identity/auth/permissions/permission-resolver.service.ts`
- `packages/api-contracts/src/permissions/permission-catalog.ts`

Important behavior:

- `PermissionsGuard` is **fail-closed**: a route with no permission metadata is rejected.
- `JwtAuthGuard` must run before `PermissionsGuard`; the standard order is `@UseGuards(JwtAuthGuard, PermissionsGuard)`.
- Registration creates a tenant + admin user and then auto-logs in.
- `getMe()` returns the user's roles and effective permissions; the dashboard uses it to filter navigation.
- The authenticated layout redirects to `/onboarding` until `tenant.onboardingCompletedAt` is set.

---

## 2 · CRUD request

```text
Dashboard click
  → Resource.FormDialog / Resource.Table
  → useResourceFormController / useResourceQuery
  → ApiClient (JWT + locale)
  → NestJS controller (createCrudController)
  → service before* hook
  → CrudRepository (tenantId injected)
  → Prisma
  → presenter.toResponse()
  → ApiResponseBuilder.success()
  → React Query invalidation
```

The full lifecycle and failure points are in [02 · API atlas](02-api.md#request-lifecycle).

### What is automatic

- Tenant scoping in `CrudRepository`.
- Pagination / sort / filter translation.
- Response envelope.
- `ResourceCreatedEvent` / `ResourceUpdatedEvent` / `ResourceDeletedEvent` emission.
- Permission metadata on generated CRUD routes.
- Bulk delete/update routes.

### What is not automatic

- Business rules (service hooks).
- Cross-entity validation (services or policies).
- GL / stock side effects (posting facades).
- Dashboard columns, forms, translations, nav entries.
- Tenant-level defaults (seed or onboarding).

---

## 3 · Invoice posting

The invoice is the best example of the transaction boundary between documents, stock, and the GL.

### Preconditions

- Invoice exists, belongs to the tenant, and is `DRAFT`.
- Fiscal period is `OPEN`.
- Invoice type direction matches the endpoint (`SALE` or `PURCHASE`).
- A warehouse is assigned.
- At least one line exists.
- For sales, stock availability is checked by the movement policy.
- For purchases, `invoiceType.affectsStock` controls whether stock lines are received.

### Write path

```text
InvoicePostingService.postPurchaseInvoice() / postSalesInvoice()
  → prisma.$transaction(async tx => {
       InventoryMovementFacade.apply(tx, receipt | issue)
       // purchase: update Item.latestPurchasePrice
       AccountingPostingFacade.record(tx, InvoicePostedIntent)
       tx.invoice.update({ status: POSTED, postedAt, postedBy })
     })
```

Inside `AccountingPostingFacade.record()`:

```text
assertFiscalPeriodOpen()
  → PostingPolicyRegistry.resolvePosting(intent)
  → policy.buildLines(tx)
  → DocumentSequencesService.getNextNumber('JOURNAL_ENTRY')
  → JournalPostingService.post(tx, …)
  → AuditWriter.recordInTx(tx, …)
  → OutboxRepository.enqueue(tx, …)   // only if OUTBOX_ENABLED=true
```

A rejected posting does **not** burn a journal-entry number: the period check and policy lines run before number allocation.

### Journal shape

**Sale** (`InvoicePostedPolicy`):

| Line                                            | Debit                | Credit            |
| ----------------------------------------------- | -------------------- | ----------------- |
| Accounts Receivable (party override or default) | invoice total × rate |                   |
| Sales                                           |                      | net × rate        |
| Tax                                             |                      | tax × rate        |
| COGS                                            | stock value delta    |                   |
| Inventory                                       |                      | stock value delta |

**Purchase**:

| Line                                         | Debit                | Credit       |
| -------------------------------------------- | -------------------- | ------------ |
| Inventory                                    | stock net × rate     |              |
| Purchase / expense                           | non-stock net × rate |              |
| Tax                                          | tax × rate           |              |
| Accounts Payable (party override or default) |                      | total × rate |

If a required GL mapping is missing, posting fails with a `BadRequestException` **before** committing. The error message names the missing mapping.

### Cancellation

```text
cancelInvoice()
  → must be POSTED
  → must have no payment allocations
  → fiscal period must be OPEN
  → find original posted journal entry
  → tx:
       InventoryMovementFacade.apply(reversal)
       AccountingPostingFacade.reverse(original)
       invoice.status = CANCELLED
```

Cancellation is a **reversal**, never a delete. The same rule applies to payments, expenses, stock counts, and opening-balance sessions.

### Where to look

| Concern             | File                                                      |
| ------------------- | --------------------------------------------------------- |
| HTTP actions        | `invoicing/invoices/invoices.controller.ts`               |
| Create/update/list  | `invoicing/invoices/invoices.service.ts`                  |
| Totals              | `invoicing/invoices/invoice-totals.ts`                    |
| Posting transaction | `invoicing/invoices/invoice-posting.service.ts`           |
| GL policy           | `accounting/posting/policies/invoice-posted.policy.ts`    |
| Reversal policy     | `accounting/posting/policies/invoice-cancelled.policy.ts` |
| Stock issue/receipt | `inventory/movements/`                                    |
| Presenter           | `invoicing/invoices/presenters/invoice.presenter.ts`      |

---

## 4 · Stock movement

`InventoryMovementFacade` is the single write port for stock.

```text
InventoryMovementFacade.apply(tx, intent)
  → MovementPolicyRegistry.drafts(tx, intent)
      → each policy yields one or more MovementLineDraft
  → StockMovementWriter.write(tx, header, draft)
      → INSERT StockMovement (immutable)
      → UPSERT StockBalance
          inflow:  newQty = oldQty + qty
                   newAvg = (oldQty × oldAvg + qty × unitCost) / newQty
          outflow: newQty = oldQty + qty (qty is negative)
                   averageCost unchanged
  → returns { movementIds, valueDelta }
```

Rules:

- Quantity is signed: positive = inflow, negative = outflow.
- `StockMovement` is the source of truth; `StockBalance` is a fast-read projection.
- The facade runs in the caller's transaction, so stock + GL + document status commit atomically.
- The movement policy reads balances lazily, so line 2 sees line 1's effect.
- Service items do **not** create stock movements.

Movement types: `OPENING`, `PURCHASE`, `SALE`, `ADJUSTMENT`, `STOCK_COUNT`, `TRANSFER_IN`, `TRANSFER_OUT`.

---

## 5 · Payments and allocations

```text
POST /payments
  → create DRAFT payment + document number
  → optional complete=true → post()

POST /payments/:id/post
  → tx:
       AccountingPostingFacade.record(PAYMENT_RECORDED)
       Cashbox.balance += amount (receipt) / -= amount (payment)
       Payment.status = POSTED

POST /payments/:id/allocate
  → payment must be POSTED
  → amount ≤ unallocatedAmount
  → invoice belongs to tenant
  → party and currency must match
  → amount ≤ invoice remaining
  → create PaymentAllocation, update allocated/unallocated
```

Cancellation:

- must be `POSTED`;
- must have no allocations;
- reverses the GL entry and the cashbox balance;
- sets status `CANCELLED`.

`PaymentAllocation` is how an invoice becomes partially/fully paid. `computeInvoicePaidState` in the invoice presenter derives the display state.

---

## 6 · Stock counts

```text
DRAFT stock count
  → lines compare system quantity vs counted quantity
  → POST /stock-counts/:id/post
      → for each line with a difference:
          InventoryMovementFacade.apply(
            movementType: STOCK_COUNT,
            quantity: difference
          )
      → status = POSTED
```

A posted count is corrected by a reversal/cancellation flow, not by editing the posted document.

---

## 7 · Business setup and onboarding

Two related but distinct flows:

| Flow               | Trigger                    | Outcome                                                                                                                                               |
| ------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Onboarding**     | New tenant registration    | Tenant metadata, admin user, default unit/category/branch, `onboardingStep` progress.                                                                 |
| **Business setup** | After onboarding, `/setup` | Operational prerequisites: currencies, COA, financial mappings, sequences, cashboxes, bank accounts, fiscal period, opening balances, reconciliation. |

The setup task graph is static (`SETUP_TASK_DEPENDENCIES`):

```text
CURRENCIES ─┬─► CASHBOXES ───────────────┐
            ├─► BANK_ACCOUNTS ───────────┤
            └────────────────────────────┤
CHART_OF_ACCOUNTS ─► FINANCIAL_MAPPINGS ──┼─► OPENING_CASH / BANK / AR / AP
FISCAL_PERIOD ────────────────────────────┤
DOCUMENT_SEQUENCES                        │
WAREHOUSES ─► PRODUCTS ─► OPENING_INVENTORY
CUSTOMERS / SUPPLIERS ◄─ FINANCIAL_MAPPINGS
                                           ▼
                                     RECONCILIATION
```

- A task is `READY` only when all dependencies are `COMPLETED` or `SKIPPED`.
- Some tasks are discovery-only (`WAREHOUSES`, `PRODUCTS`, `CUSTOMERS`, `SUPPLIERS`, `OPENING_INVENTORY`) and complete through their own resource pages.
- `businessSetupCompletedAt` is written **only** when reconciliation completes.
- `BusinessSetupOrchestratorService` runs each handler inside a `RequestContext` with `source: BUSINESS_SETUP`.

Key files:

```text
identity/business-setup/constants/setup-task-graph.ts
identity/business-setup/services/business-setup-orchestrator.service.ts
identity/business-setup/handlers/
identity/onboarding/
apps/dashboard/modules/business-setup/
apps/dashboard/modules/onboarding/
```

---

## 8 · POS checkout

POS is a facade over the invoicing domain, not a separate invoice engine.

```text
POST /pos/checkout
  → PosSettingsService.get(tenantId)       // requires branch, invoice type, warehouse, cashbox
  → SalesCheckoutFacade.checkout({
       clientRequestId,                     // idempotency key
       invoiceTypeId, partyId, warehouseId, cashboxId, branchId,
       lines, tendered
     })
  → create + post sale invoice
  → create + post receipt
  → allocate payment to invoice
  → one transaction
  → return invoice + payment + change + replayed flag
```

- `clientRequestId` is unique per tenant and prevents double-charging on retry.
- POS settings must exist and have a branch; otherwise checkout fails before creating anything.
- The sales checkout path reuses `postSalesInvoiceInTx`, not a copied posting implementation.

Key files:

```text
apps/api/src/modules/pos/checkout/
apps/api/src/modules/invoicing/checkout/
apps/api/src/modules/pos/settings/
apps/dashboard/modules/pos/
```

---

## 9 · Outbox

The outbox is a **seam**, not the primary write path. It is off by default.

```text
AccountingPostingFacade.record/reverse
  → if OUTBOX_ENABLED=true:
       OutboxRepository.enqueue(tx, { tenantId, topic, payload })
       // same transaction as the journal entry

OutboxWorkerService @Interval(5s)
  → claimPending(20)
  → resolve handler by topic
  → handler(payload, meta)
  → markDelivered / markFailed (retry) / dead-letter
```

Topics:

- `accounting.journal-posted`
- `accounting.journal-reversed`

Properties:

- `OUTBOX_ENABLED=false` means no enqueue and the worker returns immediately.
- `OUTBOX_RETRY_DELAY_MS=5000`; stale `PROCESSING` rows are reclaimable after 60s.
- The outbox handler registry currently has a logging handler; it is the extension point for webhooks, search indexing, or analytics.

Key files:

```text
apps/api/src/outbox/outbox.repository.ts
apps/api/src/outbox/outbox-worker.service.ts
apps/api/src/outbox/outbox-handler.registry.ts
apps/api/src/outbox/logging-outbox.handler.ts
```

---

## 10 · AI agent

The AI assistant is a tool-using LangGraph agent inside the API, streamed to the dashboard as AI SDK UI message chunks.

```text
POST /ai/conversations/:id/chat
  → JwtAuthGuard + PermissionsGuard (ai.use)
  → ChatService.stream()
      → conversation ownership + rate limit + per-conversation turn lock
      → resolve user permissions into AiToolContext
      → buildAgentGraph(model, tool registry, executor, checkpointer)
      → model may call tools (read/write domain tools)
      → write tools interrupt for human approval
      → translate graph stream to UI message chunks
      → persist assistant message + checkpoint
      → SSE response
```

Important behavior:

- Tools are registered by domain from `@AiToolProvider()` singletons; duplicate/invalid names fail at bootstrap.
- Tool visibility is permission-filtered **and** scope-filtered (`ALWAYS_LOADED_DOMAINS` or `tools.load`).
- Delete tools are forbidden for cancel/reverse-only resources.
- A conversation can have only one in-flight turn (`ConversationTurnLock`); approvals must target the current pending message.
- The client can disconnect; a drain branch still finishes the stream and persists the result.

Key files:

```text
apps/api/src/modules/ai-agent/chat/chat.service.ts
apps/api/src/modules/ai-agent/runtime/agent-graph.ts
apps/api/src/modules/ai-agent/tools/ai-tool-registry.ts
apps/api/src/modules/ai-agent/runtime/prisma-checkpoint-saver.ts
apps/dashboard/modules/ai-agent/
```

---

## 11 · Debugging map

| Symptom                                   | First place to look                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 401 on every API call                     | `auth_token` (dashboard) or `access_token` (API), `JWT_ACCESS_SECRET`, `JwtStrategy`.          |
| 403 with a valid token                    | `PermissionsGuard` metadata / role permissions.                                                |
| 404 that “should exist”                   | `tenantId`, `DomainAvailabilityGuard`, route prefix in `manifest.ts`.                          |
| 400 validation                            | DTO + global `ValidationPipe`; dashboard Zod schema / mapper.                                  |
| Duplicate / FK error                      | `CrudRepository.mapPrismaError` maps P2002/P2003 to `ConflictException`.                       |
| Invoice post fails                        | fiscal period, warehouse, stock availability, Financial Settings mappings, party GL overrides. |
| Stock looks wrong                         | `StockMovement` ledger first, then `StockBalance` projection.                                  |
| Journal unbalanced                        | `AccountingPostingFacade` policy + `JournalPostingService` validation.                         |
| Dashboard form submits wrong shape        | `*.config.ts` `toCreate` / `toUpdate` + generated DTO.                                         |
| Dashboard list empty but API returns data | `Resource` query params / `unwrapApiData` / response envelope.                                 |
| Contract type stale                       | `pnpm generate`, rebuild `api-contracts`, then `api-client`.                                   |
| AI tool missing                           | permission set, domain not loaded, `@AiToolProvider` registration, tool name rules.            |

Correlation IDs are attached by `correlationIdMiddleware` and used in structured logs. Use them to connect a request across the API logs.

---

## 12 · Change playbook

### Add a simple field to an existing resource

```text
Prisma model + migration
  → API DTO
  → presenter
  → service mapping (if custom)
  → contract DTO / response type
  → regenerate contract
  → dashboard Zod schema + defaults + mappers
  → form field
  → columns / detail view
  → translations
```

### Add a new CRUD resource

Use [06 · Find it fast](06-find-it-fast.md#new-crud-resource) and the six-layer diagram. Do not skip the contract or client registry.

### Add a financial side effect

Do **not** write journals directly from a controller. Add a posting policy and call `AccountingPostingFacade` inside the existing transaction. Keep the journal balanced, use the configured mappings, write audit in the same transaction, and reverse rather than delete.

### Add a stock side effect

Do **not** mutate `StockBalance` directly. Add a movement policy and call `InventoryMovementFacade.apply()` with a signed quantity and unit cost, inside the caller's transaction.

---

## Invariants worth memorizing

1. **Tenant scope is not optional.** Every tenant-owned query carries `tenantId`.
2. **Posted documents are immutable.** Correct with reversal/cancellation flows.
3. **Money and stock are transactional.** Document + ledger + audit commit together.
4. **The ledger is the source of truth.** `StockBalance` and account balances are projections/read models.
5. **Contracts are generated, not guessed.** No casts to hide stale API types.
6. **The dashboard is a client.** Business rules belong in the API.
