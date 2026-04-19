import { test, expect } from "@playwright/test";

test("health endpoint reports all services up", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.services.db.status).toBe("up");
  expect(body.services.pdfWorker.status).toBe("up");
});
