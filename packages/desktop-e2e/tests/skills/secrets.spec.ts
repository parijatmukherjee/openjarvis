import { test, expect } from "../../fixtures/electron-app.js";

test.describe("secrets skill (via bridge)", () => {
  test("executes secrets_get intent (op:// resolution)", async ({ page }) => {
    await page.evaluate(() => {
      const b = (window as unknown as Record<string, unknown>).__testBridge as
        | {
            executeIntent: (a: string, p: Record<string, unknown>) => Promise<void>;
            simulateIntentResponse: (a: string, r: string) => void;
          }
        | undefined;
      if (b) {
        b.executeIntent("secrets_get", {
          reference: "op://vault/item/field",
        });
        b.simulateIntentResponse(
          "secrets_get",
          "Secret resolved from 1Password"
        );
      }
    });
    await expect(page.getByText(/secret|1password|resolved/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});