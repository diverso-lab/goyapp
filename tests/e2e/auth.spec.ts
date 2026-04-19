import { test, expect } from "@playwright/test";

const DEMO_EMAIL = "demo@goyapp.local";
const DEMO_PASSWORD = "demo1234";

test("landing shows login CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
});

test("login with demo admin credentials lands on dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(DEMO_EMAIL);
  await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(DEMO_EMAIL);
  await page.locator('input[type="password"]').fill("not-the-real-one");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByText(/wrong email or password/i)).toBeVisible();
});
