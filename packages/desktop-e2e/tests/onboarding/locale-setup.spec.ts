import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Locale setup", () => {
  test.beforeEach(async ({ page }) => {
    await page.locator("[data-testid='onboarding-initialize']").click();
    await expect(page.getByRole("heading", { name: /language/i })).toBeVisible({ timeout: 10_000 });
  });

  test("displays language options", async ({ page }) => {
    await expect(page.getByText("English (US)").first()).toBeVisible({ timeout: 10_000 });
  });

  test("selecting a language highlights it", async ({ page }) => {
    const langOption = page.locator("span.flex-1", { hasText: "English (US)" }).first();
    await langOption.click();
    await expect(langOption).toBeVisible({ timeout: 5_000 });
  });

  test("clicking Continue advances to voice calibration", async ({ page }) => {
    await page.locator("[data-testid='onboarding-continue']").click();
    await expect(page.getByRole("heading", { name: /voice calibration/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});
