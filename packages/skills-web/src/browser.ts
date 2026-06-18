import type { LaunchOptions } from "playwright";

export interface BrowserAutomation {
  navigate(url: string): Promise<{ title: string; url: string }>;
  click(selector: string): Promise<{ clicked: boolean }>;
  screenshot(): Promise<{ data: string; mimeType: string }>;
  close(): Promise<void>;
}

export class PlaywrightBrowserAutomation implements BrowserAutomation {
  private browser: import("playwright").Browser | undefined;
  private page: import("playwright").Page | undefined;
  private readonly launchOptions: LaunchOptions | undefined;

  constructor(options?: { launchOptions?: LaunchOptions }) {
    this.launchOptions = options?.launchOptions;
  }

  private async ensureBrowser(): Promise<import("playwright").Page> {
    if (!this.browser) {
      const { chromium } = await import("playwright");
      this.browser = await chromium.launch(this.launchOptions);
    }
    if (!this.page) {
      const context = await this.browser.newContext();
      this.page = await context.newPage();
    }
    return this.page;
  }

  async navigate(url: string): Promise<{ title: string; url: string }> {
    const page = await this.ensureBrowser();
    const response = await page.goto(url);
    if (!response) {
      throw new Error(`failed to navigate to ${url}`);
    }
    const title = await page.title();
    return { title, url: page.url() };
  }

  async click(selector: string): Promise<{ clicked: boolean }> {
    const page = await this.ensureBrowser();
    await page.click(selector, { timeout: 5000 });
    return { clicked: true };
  }

  async screenshot(): Promise<{ data: string; mimeType: string }> {
    const page = await this.ensureBrowser();
    const buffer = await page.screenshot({ type: "png" });
    return { data: buffer.toString("base64"), mimeType: "image/png" };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
      this.page = undefined;
    }
  }
}
