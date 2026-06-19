import { test, expect } from "../../fixtures/electron-app.js";

test.describe("Discord channel (via bridge)", () => {
  test("executes discord_send intent through conversation", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("discord_send", {
          channel: "general",
          message: "Hello from JARVIS",
        });
        b.simulateIntentResponse("discord_send", "Message sent to #general");
      }
    });
    await expect(page.getByText(/sent to.*general|#general/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("executes discord_read intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("discord_read", { channel: "general", limit: 10 });
        b.simulateIntentResponse("discord_read", "3 messages read from #general");
      }
    });
    await expect(page.getByText(/messages read from.*general/i)).toBeVisible({ timeout: 5_000 });
  });

  test("executes discord_search intent", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("discord_search", { query: "deploy" });
        b.simulateIntentResponse("discord_search", 'Found 2 results for "deploy"');
      }
    });
    await expect(page.getByText(/found.*result/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
