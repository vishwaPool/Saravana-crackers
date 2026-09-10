# Admin portal QA

## Fixes
- Prisma transactions now have explicit 10-second acquisition and 30-second execution limits. POS batches stock ledger writes and avoids a product lookup for every line.
- Retrying an unchanged bill reuses its request key. The server returns the existing invoice for a duplicate request.
- A completed bill clears the editor, displays the saved invoice, enables Print Bill, and restores the last invoice after refresh.
- Billing and sales history share a receipt with item discounts, GST, bill discount and rounding. Print content is mounted outside the admin layout.
- Admin read failures display errors instead of leaving an indefinite loading state.
- Returns and voids reject repeated stock restoration. Return amounts account for the bill discount. Reports account for returns and discounts. Customer spending includes POS sales.
- Empty/invalid CSV imports are rejected, and updating existing products through CSV no longer records duplicate opening-stock movements.

## Verification completed
- Production build passed.
- 11 existing cart/validation regression tests passed.
- 10 live database checks passed: transaction duration beyond five seconds, multi-item sale, dashboard reflection, idempotent retry, insufficient stock, return, void, discounted/net reports, stock receipt/adjustment and rollback cleanup.
- 19 authenticated read/export API endpoints returned HTTP 200.
- Headless Chrome verified billing failure/retry, request-key reuse, printing enabled only after success, print media and PDF generation, last-invoice restoration, all 14 other admin pages loading, required fields on four forms, category-save feedback and no uncaught browser errors.

Database QA creates temporary fixtures inside one transaction and deliberately rolls it back. No QA sales/products remain. Browser mutation requests are mocked; browser tests do not create live business records. A physical printer was not tested. The PDF is a QA sample, not an issued business invoice.

## Re-run
From the project root:

    npm run build
    node --test server/src/lib/validation.test.js client/src/state/CartContext.test.mjs
    node server/qa/transactions.mjs
    node server/qa/read-api.mjs

Browser checks require the application on localhost:5173, API on localhost:4000, an active administrator, local Chrome and Playwright installed in the temporary saravana-admin-qa directory. The scripts use the server environment locally and never print authentication tokens.

    npm install --prefix "$env:TEMP\saravana-admin-qa" --no-save --package-lock=false playwright
    node server/qa/browser.mjs

Artifacts: artifacts/admin-qa/billing.png and artifacts/admin-qa/receipt.pdf.