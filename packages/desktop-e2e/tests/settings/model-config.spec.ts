import { test, expect, completeOnboarding } from "../../fixtures/electron-app.js";

test.describe("Settings — model configuration", () => {
  test("opens settings and navigates to model tab", async ({ page }) => {
    await completeOnboarding(page);
    await page.click("[data-testid='btn-settings']");
    await expect(page.locator("[data-testid='settings-tab-model']")).toBeVisible({
      timeout: 10_000,
    });
    await page.click("[data-testid='settings-tab-model']");
    await expect(page.locator("[data-testid='provider-ollama-cloud']")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("selecting Ollama Cloud shows API key field", async ({ page }) => {
    await completeOnboarding(page);
    await page.click("[data-testid='btn-settings']");
    await expect(page.locator("[data-testid='settings-tab-model']")).toBeVisible({
      timeout: 10_000,
    });
    await page.click("[data-testid='settings-tab-model']");
    await page.click("[data-testid='provider-ollama-cloud']");
    await expect(page.locator("[data-testid='model-api-key-input']")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("selecting local Ollama does not require API key", async ({ page }) => {
    await completeOnboarding(page);
    await page.click("[data-testid='btn-settings']");
    await expect(page.locator("[data-testid='settings-tab-model']")).toBeVisible({
      timeout: 10_000,
    });
    await page.click("[data-testid='settings-tab-model']");
    await page.click("[data-testid='provider-ollama']");
    await expect(page.locator("[data-testid='model-api-key-input']")).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test("can change model name and base URL", async ({ page }) => {
    await completeOnboarding(page);
    await page.click("[data-testid='btn-settings']");
    await expect(page.locator("[data-testid='settings-tab-model']")).toBeVisible({
      timeout: 10_000,
    });
    await page.click("[data-testid='settings-tab-model']");
    await page.locator("[data-testid='model-name-input']").fill("mistral");
    await page.locator("[data-testid='model-base-url-input']").fill("http://localhost:11434");
    await expect(page.locator("[data-testid='model-name-input']")).toHaveValue("mistral");
  });

  test("closes settings with Done button", async ({ page }) => {
    await completeOnboarding(page);
    await page.click("[data-testid='btn-settings']");
    await expect(page.locator("[data-testid='settings-tab-model']")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: /done/i }).click();
    await expect(page.locator("[data-testid='btn-settings']")).toBeVisible({ timeout: 5_000 });
  });
});
