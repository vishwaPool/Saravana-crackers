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
