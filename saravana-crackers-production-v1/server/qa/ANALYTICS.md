# Analytics implementation and verification

Route: `/admin/analytics`, visible to ADMIN and SUPER_ADMIN, matching existing profit-report access.
API: `GET /api/analytics/overview` returns one consistent snapshot for all panels.
Parameters: `from`, `to` (inclusive ISO dates, max 366 days), `category` and `supplier` (IDs), `brand`, `channel` (`All`, `POS`, `Online`), `search`, `rank` (`quantity`, `revenue`, `profit`), `view`, `movement`, `health`, `page`.

## Accounting decisions

- Shop calendar and hourly buckets use Asia/Kolkata. Previous period has the same number of calendar days.
- POS sources: COMPLETED and REFUNDED invoices. REFUNDED invoices represent originally completed sales and must remain in history. VOIDED invoices and HeldSale records are excluded.
- Online source: DELIVERED Order records, dated by order creation. This schema has no online-to-POS invoice conversion or linking relationship; the two native sources are counted once each.
- Net merchandise revenue excludes tax, delivery and round-off and allocates invoice discounts proportionally. Refund revenue reversal allocates the existing return amount back to its merchandise component. Refund KPI shows the full actual refund amount.
- Returns are posted on their processing date. Returns from earlier invoices can produce negative net quantity/revenue and return percentages over 100%. The original invoice is not modified by Analytics.
- POS cost comes from SaleItem.purchasePriceSnapshot; returned costs are reversed using that snapshot. Online costs use current Product.purchasePrice because OrderItem does not save historical cost.
- Inventory uses current Product.stock and purchasePrice. It is not historical closing stock; it reflects existing online reservations. Product filters scope inventory; channel filters scope activity against shared inventory.
- Available = max(0, period net sold) + max(0, current stock). Sell-through = max(0, period net sold) / available. No days-since-sale logic. Return restocking is already handled by the existing returns service.
- Thresholds are configurable in `MOVEMENT` in analyticsService.js. High demand means positive net sales and at least 50% sell-through. Reorder means high demand and stock at/below minStock.
- Products have no supplier ownership or lot relationship. Attribution uses the latest purchase supplier, with deterministic ties. It is an approximation, explicitly labeled in the UI. Purchased quantities are period purchases and are informational.
- All queries are parameterized, database-aggregated, and run in a repeatable-read snapshot. Only 25 product details and 10 ranked products are sent per page; raw invoice/order lines never reach the browser. There are no schema changes or writes in Analytics.

## Checks

From repository root:

```
npm run build --workspace client
node --test server/src/services/analyticsService.test.js server/src/routes/analytics.test.js server/src/lib/validation.test.js client/src/state/CartContext.test.mjs
node --check server/src/index.js
```

Browser check uses a fixture API, Chrome and the local Vite server. Install Playwright into `artifacts/analytics-qa/tools` to run `node server/qa/analytics-browser.mjs`. Screenshots are written to `artifacts/analytics-qa`. It checks filters, chart rendering, pagination, drill-down, responsive widths, error/retry, empty states and Hold Bill save/resume without database mutations.

From `server`, run `node qa/analytics-check.mjs` when MySQL is reachable. It verifies SQL calculations using isolated fixtures inside a transaction deliberately rolled back; no persistent test rows are left. The configured remote database was unreachable during implementation, including outside the sandbox, so live-data/SQL integration verification remains pending.

There is no backend compilation script: the server is native JavaScript. Backend verification uses syntax checks and Node tests. The existing cart test needed a PNG loader after earlier product image changes; that test-only loader was added so the existing regression tests can execute.
