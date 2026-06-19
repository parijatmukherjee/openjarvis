import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Memory recall and reinforce", () => {
  test("sends a recall intent and displays the response", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("memory_recall", { query: "project deadline" });
        b.simulateIntentResponse(
          "memory_recall",
          "Recalled: Project deadline is June 30"
        );
      }
    });
    await expect(page.getByText(/recalled|deadline/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});