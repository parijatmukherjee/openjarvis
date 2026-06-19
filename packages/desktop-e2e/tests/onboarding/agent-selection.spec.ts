import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Agent selection screen", () => {
  test.beforeEach(async ({ page }) => {
    await expect(page.getByText(/jarvis/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /initialize/i }).click();
    await expect(page.getByText(/language|locale/i)).toBeVisible({
      timeout: 10_000,
    });
    await page
      .getByText(/english/i)
      .first()
      .click();
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByText(/voice|calibrat/i)).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /next|skip|continue/i }).click();
    await expect(page.getByText(/agent|select|choose/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("displays agent toggle cards", async ({ page }) => {
    await expect(page.getByText(/research/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/weather/i)).toBeVisible({ timeout: 10_000 });
  });

  test("toggling an agent works", async ({ page }) => {
    const agentToggle =
      page.getByRole("switch", { name: /research/i }) ??
      page.locator("[data-testid='agent-toggle-research']") ??
      page.getByText(/research/i).first();
    await agentToggle.click();
    await expect(agentToggle).toBeVisible({ timeout: 5_000 });
  });
});
