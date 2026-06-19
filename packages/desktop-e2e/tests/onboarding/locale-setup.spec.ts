import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Locale setup screen", () => {
  test.beforeEach(async ({ page }) => {
    await expect(page.getByText(/jarvis/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /initialize/i }).click();
    await expect(page.getByText(/language|locale|region/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("displays language options after clicking Initialize", async ({
    page,
  }) => {
    await expect(page.getByText(/english/i)).toBeVisible({ timeout: 10_000 });
  });

  test("selecting a language highlights it", async ({ page }) => {
    const langOption = page.getByText(/english/i).first();
    await langOption.click();
    await expect(langOption).toHaveAttribute(
      /aria-selected|data-selected|class/,
      /.*/,
      { timeout: 5_000 }
    );
  });

  test("clicking Next advances to voice calibration", async ({ page }) => {
    await page.getByText(/english/i).first().click();
    await page.getByRole("button", { name: /next/i }).click();
    await expect(
      page.getByText(/voice|calibrat|microphone|speak/i)
    ).toBeVisible({ timeout: 10_000 });
  });
});