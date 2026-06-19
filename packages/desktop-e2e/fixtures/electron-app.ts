import { test as base, type Page, type ElectronApplication } from "@playwright/test";
import { _electron as electron } from "playwright";
import path from "node:path";
import os from "node:os";

export type ElectronFixture = {
  electronApp: ElectronApplication;
  page: Page;
};

const projectRoot = path.resolve(import.meta.dirname, "../../..");
const appEntry = path.join(projectRoot, "packages/desktop/dist/electron-main.js");

export const test = base.extend<ElectronFixture>({
  electronApp: async ({}, use) => {
    const userDataDir = path.join(os.tmpdir(), `openhawkins-e2e-${Date.now()}`);
    const app = await electron.launch({
      args: [appEntry, `--user-data-dir=${userDataDir}`],
      env: {
        ...process.env,
        OPENJARVIS_DEV: "1",
        NODE_ENV: "test",
        OLLAMA_API_KEY: process.env.OLLAMA_API_KEY ?? "",
      },
    });
    await use(app);
    await app.close();
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await use(page);
  },
});

export const expect = test.expect;

export async function completeOnboarding(page: Page) {
  await page.waitForSelector("[data-testid='onboarding-initialize']", { timeout: 30_000 });
  await page.click("[data-testid='onboarding-initialize']");

  await expect(page.getByRole("heading", { name: /language/i })).toBeVisible({ timeout: 10_000 });
  await page.click("[data-testid='onboarding-continue']");

  await expect(page.locator("[data-testid='voice-start']")).toBeVisible({ timeout: 10_000 });
  await page.click("[data-testid='voice-start']");
  await expect(page.locator("[data-testid='voice-continue']")).toBeVisible({ timeout: 15_000 });
  await page.click("[data-testid='voice-continue']");

  await expect(page.getByText("Research").first()).toBeVisible({ timeout: 10_000 });
  await page.click("[data-testid='onboarding-continue']");

  await expect(page.getByRole("heading", { name: "Ready" })).toBeVisible({ timeout: 10_000 });
  await page.click("[data-testid='onboarding-launch']");

  await expect(page.locator("[data-testid='btn-settings']")).toBeVisible({ timeout: 10_000 });
}