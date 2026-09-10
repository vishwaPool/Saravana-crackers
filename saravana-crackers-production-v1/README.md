# Saravana Crackers Production V1

## What is included
- Customer storefront
- Category/product browsing
- Search
- Cart
- Checkout
- Server-side price and stock validation
- WhatsApp confirmation
- Order tracking
- Secure admin login
- Products
- Categories
- Orders/status tracking
- Offers
- Customers
- Suppliers
- Purchases
- Stock movements
- Shop settings
- Audit logs
- Prisma + MySQL

## Run

1. Install Node.js 20+.
2. Extract this project.
3. Open the root folder in VS Code.
4. Run:

```bash
npm install
```

5. Copy `server/.env.example` to `server/.env`.
6. Copy `client/.env.example` to `client/.env`.
7. Put your Oracle MySQL connection in `DATABASE_URL`.
8. Run:

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Customer site:
http://localhost:5173

Admin:
http://localhost:5173/admin/login

API:
http://localhost:4000

## Admin credentials
Controlled by:

```env
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

Change them before public deployment.

## Oracle MySQL
The app is not hardcoded to Oracle-specific SQL. It uses standard MySQL through Prisma, so migration to another MySQL provider later is easy.

## Production notes
Before public launch:
- enable HTTPS
- set COOKIE_SECURE=true
- use a strong JWT secret
- configure your real WhatsApp number
- configure backup/recovery
- configure your business address and policies
- validate applicable fireworks sales/transport requirements

## Vercel deployment

Create two Vercel projects from this repository:

- Frontend root directory: `client`; build command: `npm run build`; set `VITE_API_URL` to the deployed backend origin.
- Backend root directory: `server`; build command: `npm run build`; set `DATABASE_URL`, `FRONTEND_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NODE_ENV=production`, and `COOKIE_SECURE=true`.

The backend uses the `server/api/index.js` function entrypoint and Prisma generates during its build. Run migrations from a controlled environment with the production `DATABASE_URL`; do not use `prisma db push` for production schema changes.

For the production deployments, set these variables in Vercel's **Production** environment:

- Frontend: `VITE_API_URL=https://saravana-crackers-api-backend.vercel.app`
- Backend: `FRONTEND_URL=https://saravana-crackers-frontend.vercel.app`, `NODE_ENV=production`, `COOKIE_SECURE=true`; retain the existing database, JWT, and admin variables above.

Redeploy the affected project after changing environment variables. `FRONTEND_URL` must identify the frontend origin (scheme and hostname, without an API path). Comma-separated origins remain supported; whitespace and trailing slashes are trimmed. Local development at `http://localhost:5173` remains allowed. `CLIENT_URL` is only a legacy fallback when `FRONTEND_URL` is unset.

The global CORS middleware handles preflight requests before authentication and API routes. An allowed preflight returns 204, the requesting origin in `Access-Control-Allow-Origin`, and `Access-Control-Allow-Credentials: true`. If production returns `CORS blocked origin`, check the backend project's environment scope/value and redeploy; changing only the frontend environment cannot update the backend allowlist.
