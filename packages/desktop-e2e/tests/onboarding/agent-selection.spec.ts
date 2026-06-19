import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Agent selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.locator("[data-testid='onboarding-initialize']").click();
    await expect(page.getByRole("heading", { name: /language/i })).toBeVisible({ timeout: 10_000 });
    await page.locator("[data-testid='onboarding-continue']").click();
    await expect(page.getByRole("heading", { name: /voice calibration/i })).toBeVisible({ timeout: 10_000 });
    await page.locator("[data-testid='voice-start']").click();
    await expect(page.locator("[data-testid='voice-continue']")).toBeVisible({ timeout: 15_000 });
    await page.locator("[data-testid='voice-continue']").click();
  });

  test("displays agent toggle cards", async ({ page }) => {
    await expect(page.getByText("Research").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Weather").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Calendar").first()).toBeVisible({ timeout: 10_000 });
  });

  test("toggling an agent works", async ({ page }) => {
    const researchCard = page.getByText("Research").first();
    await researchCard.click();
    await expect(researchCard).toBeVisible({ timeout: 5_000 });
  });

  test("clicking Continue advances to completion", async ({ page }) => {
    await page.locator("[data-testid='onboarding-continue']").click();
    await expect(page.getByRole("heading", { name: "Ready" })).toBeVisible({ timeout: 10_000 });
  });
});