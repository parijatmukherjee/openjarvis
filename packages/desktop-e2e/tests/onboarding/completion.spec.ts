import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Completion screen", () => {
  test.beforeEach(async ({ page }) => {
    await expect(page.getByText(/jarvis/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /initialize/i }).click();
    await expect(page.getByText(/language|locale/i)).toBeVisible({
      timeout: 10_000,
    });
    await page.getByText(/english/i).first().click();
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByText(/voice|calibrat/i)).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /next|skip|continue/i }).click();
    await expect(page.getByText(/agent|select/i)).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /next|continue|finish/i }).click();
  });

  test("displays completion/ready screen", async ({ page }) => {
    await expect(page.getByText(/ready|complete|all set|finished/i)).toBeVisible(
      { timeout: 10_000 }
    );
  });

  test("clicking Launch Dashboard shows the dashboard", async ({ page }) => {
    await page
      .getByRole("button", { name: /launch|dashboard|start|go/i })
      .click();
    await expect(
      page.getByText(/task|agent|conversation|dashboard/i)
    ).toBeVisible({ timeout: 10_000 });
  });
});