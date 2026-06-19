import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Welcome screen", () => {
  test("renders the JARVIS title", async ({ page }) => {
    await expect(page.getByText(/jarvis/i)).toBeVisible({ timeout: 10_000 });
  });

  test("renders the Initialize button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /initialize/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("clicking Initialize advances to locale setup", async ({ page }) => {
    await page.getByRole("button", { name: /initialize/i }).click();
    await expect(page.getByText(/language|locale|region/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
