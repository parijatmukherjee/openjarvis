import { test, expect, completeOnboarding } from "../../fixtures/electron-app.js";

test.describe("Settings — about and reset", () => {
  test("about section shows version info and reset button", async ({ page }) => {
    await completeOnboarding(page);
    await page.click("[data-testid='btn-settings']");
    await page.click("[data-testid='settings-tab-about']");
    await expect(page.getByText(/v0\.1\.0|version/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/reset/i)).toBeVisible({ timeout: 5_000 });
  });

  test("reset to defaults shows confirm and cancel buttons", async ({ page }) => {
    await completeOnboarding(page);
    await page.click("[data-testid='btn-settings']");
    await page.click("[data-testid='settings-tab-about']");
    await page.getByText(/reset/i).click();
    await expect(page.getByRole("button", { name: /confirm/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /cancel/i })).toBeVisible({ timeout: 5_000 });
  });
});