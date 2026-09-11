# Storefront redesign and local checks

The redesign updates the existing customer layout, homepage, catalogue, and product cards. No backend, API routes, authentication logic, cart state, database, or admin/POS files were changed. Nothing was pushed or deployed.

## Changed files

- `src/components/Store.jsx`: responsive header, search, navigation, existing login/cart links, and settings-driven footer.
- `src/pages/Home.jsx`: compact hero/offers/categories/six-product homepage with independent API error states.
- `src/pages/Products.jsx`: existing catalogue and category routes, URL search, category selector, loading/error/empty states.
- `src/components/ProductCard.jsx`: compact cards, lazy images, safe image fallback, conditional MRP/discount display; existing stock-aware cart action retained.
- `src/assets/productImages.js`: corrected the moved Wala image import; all existing product-image selection preserved.

## Created files

- `src/storefront.css`: customer-scoped responsive theme; shared admin CSS stays unchanged.
- `src/assets/categoryImages.js`: centralized normalized mapping.
- `src/components/HeroCarousel.jsx`: two existing banners, 5.5-second rotation, arrows, dots, pause/play, reduced-motion support.
- `src/components/StoreSections.jsx`: category cards, API offer cards, section headings, benefits.
- `src/components/StoreImage.jsx`: lazy images with a generic SVG fallback on missing/failed images.
- `src/components/StoreIcon.jsx`: inline UI/social icons.
- `qa/storefront.mjs`: read-only API snapshot browser checks.
- `qa/README.md`: this handoff.

The pre-existing asset moves into Banners/categories/offers were already in the working tree. No image files were generated, edited, renamed, or downloaded for this redesign.

## Asset imports and category mapping

Both `src/assets/Banners/Banner image.png` and `Banner image1.png` are imported by the carousel. The existing `Banners/banner.svg` is retained but unused.

All three offer images are imported from `src/assets/offers/`: `offer-combo.webp.png`, `offer-festival.webp.png`, and `offer-flat-discount.webp.png`.

Category names were checked against the production public categories API. The mapping below is case-insensitive and also normalizes hyphens and whitespace. All paths are under `src/assets/categories/`.

| API category | Image filename |
| --- | --- |
| Aerial Shots | category-aerial-shots.webp.png |
| Bijili | category-bijili.webp.png |
| Combo Packs | category-combo-pack.webp.png |
| Electric Crackers | category-electric.webp.png |
| Fancy Crackers | category-fancy.webp.png |
| Flash Light Crackers | category-flash-light.webp.png |
| Flower Pots | category-flower-pots.webp.png |
| Gift Boxes | category-gift-box.webp.png |
| Ground Chakkars | category-ground-chakkar.webp.png |
| Rockets | category-rockets.webp.png |
| Sound Crackers | category-sound.webp.png |
| Wala Crackers | product-5000-wala.png |
| Sparklers | No dedicated file; category API image or a matching product API image, otherwise a festive SVG placeholder |

Product images retain `product-lakshmi-4.png`, `product-lakshmi-3-half.png`, `product-lakshmi-3-half-alt.png`, and the moved `categories/product-5000-wala.png`, plus existing API image URLs. The pre-existing product fallback selection has not been replaced. Some supplied artwork contains visible checkerboard backgrounds; those source images were preserved exactly.

## Behaviour and data

- **View All Products** opens the existing `/products` route. Category cards use `/products/:category`; the catalogue requests the existing backend category filter. Header search goes to `/products?q=...`; listing search matches names, category names, and SKU. Browser history and direct links retain the filters.
- **Offers** come from `/api/offers`. The homepage initially shows up to three; View All Offers expands the entire returned list. Titles, discount values, and minimum amounts are API-driven. An empty API response never produces invented deals.
- Supplied offer artwork contains printed business claims. The 10% image appears only for a 10% offer with no minimum order. The flat discount image appears only for a fixed 100 discount and 1000 minimum. Other offers use a neutral gift icon. The current Festival offer has a 500 minimum, so its contradictory “on all orders” artwork is not displayed. Combo offers use the combo artwork and a subtle gold animation.
- **Footer** reads `/api/settings` once in the customer layout. Phone, email, address, and WhatsApp are shown only when provided. Optional `businessHours`, `facebookUrl`, `instagramUrl`, and `youtubeUrl` rendering is supported, but those fields do not exist in the current settings schema and are hidden. No schema changes or fake contact/social values were added.
- The payment strip lists Cash, UPI, and Card as **in-store payments**, matching existing POS support. It does not claim online payment processing.
- **Login** links to the existing `/admin/login`. There is no separate customer-account login route in this project; no new authentication flow was invented.
- API base URL and credential behaviour are unchanged. Keep `VITE_API_URL` as currently configured for each environment.

## Verification

- Production Vite build passed.
- Existing cart provider tests passed.
- Headless Chrome exercised real public API snapshots at 320, 390, 768, 1024, and 1440px without horizontal overflow.
- Browser checks cover homepage limits, categories, offer rules, expansion, carousel controls, search, cart/quantity/checkout navigation, mobile menu, footer links, partial API failure/retry, and empty responses.
- No uncaught browser errors or unexpected console errors. A deliberate 503 response is expected during the failure test.
- Fixed unresolved imports caused by the previously moved banner and Wala image files. Added catches to customer API loads that previously had no error handling.
- Browser tests intercept all API calls and never submit real orders, login, or mutate production data. Successful login and order submission are outside these visual checks.

## Run locally

From the repository root:

```powershell
npm run dev
```

Open `http://localhost:5173`. The backend runs at `http://localhost:4000`. Keep the existing `server/.env` database/JWT configuration. Frontend `VITE_API_URL` may be unset for the localhost default or set to `http://localhost:4000`; restart Vite after changing it.

```powershell
npm run build --workspace client
node --test client/src/state/CartContext.test.mjs
```

Optional browser QA uses Chrome and Playwright installed outside the repository:

```powershell
npm install --prefix "$env:TEMP/saravana-storefront-qa" playwright --no-audit --no-fund
$env:QA_API_URL='http://localhost:4000'
node client/qa/storefront.mjs
```

`QA_SITE_URL` defaults to `http://localhost:5173`. `PLAYWRIGHT_PATH` can point to another installed Playwright `index.mjs`. Screenshots are saved under `$env:TEMP/saravana-storefront-qa/screenshots`.
