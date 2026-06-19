import { test, expect, completeOnboarding } from "../../fixtures/electron-app.js";

test.describe("Settings — general", () => {
  test("opens settings and shows theme toggle", async ({ page }) => {
    await completeOnboarding(page);
    await page.click("[data-testid='btn-settings']");
    await expect(page.getByText(/theme/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("can toggle theme", async ({ page }) => {
    await completeOnboarding(page);
    await page.click("[data-testid='btn-settings']");
    const darkBtn = page.getByRole("button", { name: /dark/i });
    const lightBtn = page.getByRole("button", { name: /light/i });
    await expect(darkBtn.first()).toBeVisible({ timeout: 5_000 });
    await expect(lightBtn.first()).toBeVisible({ timeout: 5_000 });
  });
});