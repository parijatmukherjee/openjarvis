export interface DisplayManager {
  listDisplays(): Promise<DisplayInfo[]>;
  openApp(app: string, displayId?: string): Promise<void>;
  openUrl(url: string, displayId?: string): Promise<void>;
  showText(text: string, displayId?: string): Promise<void>;
  clear(displayId?: string): Promise<void>;
  /** Open a vision/camera feed view (v1.1). */
  openVisionFeed?(displayId?: string): Promise<void>;
  /** Show agent-specific output panel (v1.1). */
  showAgentOutput?(agentId: string, displayId?: string): Promise<void>;
  /** Show a context card overlay (v1.1). */
  showContextCard?(title: string, body: string, displayId?: string): Promise<void>;
}

export interface DisplayInfo {
  id: string;
  name: string;
  primary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}
