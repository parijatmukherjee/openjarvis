import type { DisplayManager, DisplayInfo } from "./display-manager.js";

/**
 * Mock display manager for v1. Logs commands to a callback (for testing)
 * instead of actually opening apps on a monitor.
 *
 * v1.1: Replace with Electron + OS-native display controller.
 */
export class MockDisplayManager implements DisplayManager {
  private commands: DisplayCommand[] = [];

  async listDisplays(): Promise<DisplayInfo[]> {
    return [
      {
        id: "display-1",
        name: "Primary",
        primary: true,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      },
    ];
  }

  async openApp(app: string, displayId?: string): Promise<void> {
    this.commands.push({
      type: "open_app",
      app,
      ...(displayId !== undefined ? { displayId } : {}),
    });
  }

  async openUrl(url: string, displayId?: string): Promise<void> {
    this.commands.push({
      type: "open_url",
      url,
      ...(displayId !== undefined ? { displayId } : {}),
    });
  }

  async showText(text: string, displayId?: string): Promise<void> {
    this.commands.push({
      type: "show_text",
      text,
      ...(displayId !== undefined ? { displayId } : {}),
    });
  }

  async clear(displayId?: string): Promise<void> {
    this.commands.push({ type: "clear", ...(displayId !== undefined ? { displayId } : {}) });
  }

  async openVisionFeed(displayId?: string): Promise<void> {
    this.commands.push({
      type: "open_vision_feed",
      ...(displayId !== undefined ? { displayId } : {}),
    });
  }

  async showAgentOutput(agentId: string, displayId?: string): Promise<void> {
    this.commands.push({
      type: "show_agent_output",
      agentId,
      ...(displayId !== undefined ? { displayId } : {}),
    });
  }

  async showContextCard(title: string, body: string, displayId?: string): Promise<void> {
    this.commands.push({
      type: "show_context_card",
      title,
      body,
      ...(displayId !== undefined ? { displayId } : {}),
    });
  }

  /** All commands since the last clear (for test assertions). */
  getCommands(): DisplayCommand[] {
    return [...this.commands];
  }

  clearCommands(): void {
    this.commands = [];
  }
}

export interface DisplayCommand {
  type:
    | "open_app"
    | "open_url"
    | "show_text"
    | "clear"
    | "open_vision_feed"
    | "show_agent_output"
    | "show_context_card";
  app?: string;
  url?: string;
  text?: string;
  title?: string;
  body?: string;
  agentId?: string;
  displayId?: string;
}
