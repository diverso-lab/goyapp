import { test, expect } from "./fixtures";

test("create project from template, rename, cleanup", async ({ page, auth }) => {
  void auth;

  const card = page.locator('[data-testid="template-card"][data-template-name="Conference — Portrait"]');
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /^edit$/i }).click();

  await page.waitForURL(/\/editor\/[^/]+$/);
  const projectId = page.url().split("/").pop()!;

  const nameInput = page.locator('input[placeholder="Untitled poster"]');
  await nameInput.fill("E2E Smoke Project");
  await nameInput.blur();

  await expect(page.getByText(/saved|autosaved/i)).toBeVisible({ timeout: 10_000 });

  // page.request shares cookies with the authenticated page session.
  const resp = await page.request.delete(`/api/projects/${projectId}`);
  expect(resp.ok()).toBeTruthy();
});
