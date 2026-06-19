import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Agent status grid", () => {
  test("displays agent cards", async ({ page }) => {
    await expect(page.getByText(/research/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/weather/i)).toBeVisible({ timeout: 10_000 });
  });
});
