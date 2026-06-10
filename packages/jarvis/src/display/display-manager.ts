export interface DisplayManager {
  listDisplays(): Promise<DisplayInfo[]>;
  openApp(app: string, displayId?: string): Promise<void>;
  openUrl(url: string, displayId?: string): Promise<void>;
  showText(text: string, displayId?: string): Promise<void>;
  clear(displayId?: string): Promise<void>;
}

export interface DisplayInfo {
  id: string;
  name: string;
  primary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}
