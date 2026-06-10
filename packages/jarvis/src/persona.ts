export interface Persona {
  name: string;
  voice: VoiceProfile;
  greeting: string;
  farewell: string;
  tone: "formal" | "casual" | "professional";
  injectIntoSystemPrompt(base: string): string;
}

export interface VoiceProfile {
  engine: string;
  model?: string;
  speed: number;
  pitch: number;
}
