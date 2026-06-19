import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Window controls", () => {
  test("displays window control buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: /minimize/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /maximize/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /close/i })).toBeVisible({ timeout: 10_000 });
  });
});
