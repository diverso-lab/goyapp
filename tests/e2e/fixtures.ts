import { test as base, expect, Page } from "@playwright/test";

export const DEMO_EMAIL = "demo@goyapp.local";
export const DEMO_PASSWORD = "demo1234";

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(DEMO_EMAIL);
  await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("**/dashboard");
}

type Fixtures = {
  auth: void;
};

export const test = base.extend<Fixtures>({
  auth: [async ({ page }, use) => {
    await login(page);
    await use();
  }, { auto: false }],
});

export { expect };
