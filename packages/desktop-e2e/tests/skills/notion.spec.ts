import { test, expect } from "../../fixtures/electron-app.js";

test.describe("notion skill (via bridge)", () => {
  test("executes notion_query intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("notion_query", { database: "tasks", filter: {} });
        b.simulateIntentResponse("notion_query", "5 results from Notion database");
      }
    });
    await expect(page.getByText(/notion|result/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
