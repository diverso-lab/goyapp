import { test, expect } from "./fixtures";

test.describe("dashboard", () => {
  test.beforeEach(async ({ page, auth }) => {
    void auth;
    await page.waitForSelector("text=Templates", { timeout: 5000 });
  });

  const templateCard = (name: string) =>
    `[data-testid="template-card"][data-template-name="${name}"]`;

  test("shows 4 seeded templates and the Goyapp classic one", async ({ page }) => {
    for (const n of [
      "Goyapp — Evento clásico",
      "Conference — Portrait",
      "Workshop — Landscape 16:9",
      "Meetup — Square",
    ]) {
      await expect(page.locator(templateCard(n))).toBeVisible();
    }
  });

  test("category filter narrows the grid", async ({ page }) => {
    await page.getByRole("button", { name: "workshop", exact: true }).click();
    await expect(page.locator(templateCard("Workshop — Landscape 16:9"))).toBeVisible();
    await expect(page.locator(templateCard("Goyapp — Evento clásico"))).not.toBeVisible();
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.locator(templateCard("Goyapp — Evento clásico"))).toBeVisible();
  });

  test("search filters templates", async ({ page }) => {
    await page.getByPlaceholder("Search templates…").fill("meetup");
    await expect(page.locator(templateCard("Meetup — Square"))).toBeVisible();
    await expect(page.locator(templateCard("Conference — Portrait"))).not.toBeVisible();
  });
});
