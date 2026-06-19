import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Task board", () => {
  test("renders tasks from the bridge", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>)
        .__testBridge as Record<string, unknown> | undefined;
      if (b && typeof b.getTasks === "function") {
        return (b.getTasks as () => Promise<Array<{ description: string }>>)();
      }
      return [];
    });
    await expect(
      page.getByText(/fetching weather|loading calendar|web search/i)
    ).toBeVisible({ timeout: 10_000 });
  });
});