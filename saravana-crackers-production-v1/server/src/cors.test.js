import test from "node:test";
import assert from "node:assert/strict";

test("Vercel entrypoint allows configured and local origins before API routes", async () => {
  const productionOrigin = "https://saravana-crackers-frontend.vercel.app";
  process.env.VERCEL = "1";
  process.env.JWT_SECRET = "cors-test-only-secret";
  process.env.FRONTEND_URL = ` ${productionOrigin}/ `;
  const { default: app } = await import("../api/index.js");
  const { prisma } = await import("./lib/prisma.js");
  const server = await new Promise(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const paths = ["/api/products", "/api/categories", "/api/offers", "/api/auth/login", "/api/admin/products", "/api/analytics/overview"];
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  const originals = [prisma.product.findMany, prisma.category.findMany, prisma.offer.findMany];
  // Exercise real public routes without touching a database.
  prisma.product.findMany = prisma.category.findMany = prisma.offer.findMany = async () => [];
  try {
    for (const origin of [productionOrigin, "http://localhost:5173"]) {
      for (const path of paths) {
        for (const method of methods) {
          const response = await fetch(base + path, {
            method: "OPTIONS",
            headers: { Origin: origin, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": "content-type,authorization" }
          });
          assert.equal(response.status, 204, `${origin} ${method} ${path}`);
          assert.equal(response.headers.get("access-control-allow-origin"), origin);
          assert.equal(response.headers.get("access-control-allow-credentials"), "true");
          assert.ok(response.headers.get("access-control-allow-methods").split(",").includes(method));
          assert.equal(response.headers.get("access-control-allow-headers").toLowerCase(), "content-type,authorization");
        }
      }
      for (const path of paths.slice(0, 3)) {
        const response = await fetch(base + path, { headers: { Origin: origin } });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("access-control-allow-origin"), origin);
        assert.deepEqual(await response.json(), []);
      }
      const login = await fetch(base + "/api/auth/login", {
        method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}"
      });
      assert.equal(login.status, 400);
      assert.equal(login.headers.get("access-control-allow-origin"), origin);
      assert.equal(login.headers.get("access-control-allow-credentials"), "true");
      assert.match((await login.json()).error, /Email and password/);
    }
    assert.equal((await fetch(base + "/health")).status, 200);
    for (const origin of ["https://untrusted.example", productionOrigin + ".evil.example", "null"]) {
      const response = await fetch(base + "/api/products", {
        method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "GET" }
      });
      assert.equal(response.status, 400);
      assert.equal(response.headers.get("access-control-allow-origin"), null);
    }
  } finally {
    [prisma.product.findMany, prisma.category.findMany, prisma.offer.findMany] = originals;
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
});
