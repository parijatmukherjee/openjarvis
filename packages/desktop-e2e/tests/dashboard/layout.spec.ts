import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Dashboard layout", () => {
  test("renders the 3-column layout", async ({ page }) => {
    await expect(
      page.getByText(/voice|wave|listen/i).first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/task|board/i).first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/agent|status|grid/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});