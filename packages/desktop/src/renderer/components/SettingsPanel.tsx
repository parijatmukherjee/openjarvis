import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassPanel } from "./ui/GlassPanel";
import { NeonButton } from "./ui/NeonButton";
import { useSettingsContext } from "../context/SettingsContext";

type AppSettings = ReturnType<typeof useSettingsContext>["settings"];

type DiscordConfig = NonNullable<NonNullable<AppSettings["channels"]>["discord"]>;
type TelegramConfig = NonNullable<NonNullable<AppSettings["channels"]>["telegram"]>;
type GmailConfig = NonNullable<NonNullable<AppSettings["skills"]>["email"]>["gmail"] &
  Record<string, unknown>;
type GraphConfig = NonNullable<NonNullable<AppSettings["skills"]>["email"]>["graph"] &
  Record<string, unknown>;
type CalendarConfig = NonNullable<AppSettings["skills"]>["calendar"] & Record<string, unknown>;
type NotionConfig = NonNullable<AppSettings["skills"]>["notion"] & Record<string, unknown>;
type WeatherConfig = NonNullable<AppSettings["skills"]>["weather"] & Record<string, unknown>;

type Section = "general" | "model" | "channels" | "skills" | "about";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, profile, updateSetting, updateProfile, resetSettings } = useSettingsContext();
  const [section, setSection] = useState<Section>("general");

  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: isOpen ? 1 : 0 }}
      transition={{ duration: 0.2 }}
      style={{ pointerEvents: isOpen ? "auto" : "none" }}
    >
      <motion.div
        className="w-full max-w-2xl mx-4"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: isOpen ? 1 : 0.95, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      >
        <GlassPanel className="p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-medium">Settings</h2>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-neon-cyan transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="flex gap-2 mb-6">
            {(["general", "model", "channels", "skills", "about"] as const).map((s) => (
              <button
                key={s}
                data-testid={`settings-tab-${s}`}
                onClick={() => setSection(s)}
                className={`px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-colors ${
                  section === s
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                    : "bg-white/5 text-text-secondary border border-white/10 hover:border-neon-cyan/20"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {section === "general" && (
            <GeneralSection
              settings={settings}
              profile={profile}
              updateSetting={updateSetting as (key: string, value: unknown) => void}
              updateProfile={updateProfile as (patch: Record<string, unknown>) => void}
            />
          )}
          {section === "model" && (
            <ModelSection
              settings={settings}
              updateSetting={updateSetting as (key: string, value: unknown) => void}
            />
          )}
          {section === "channels" && (
            <ChannelsSection
              settings={settings}
              updateSetting={updateSetting as (key: string, value: unknown) => void}
            />
          )}
          {section === "skills" && (
            <SkillsSection
              settings={settings}
              updateSetting={updateSetting as (key: string, value: unknown) => void}
            />
          )}
          {section === "about" && <AboutSection onReset={resetSettings} />}

          <div className="mt-6 flex justify-end">
            <NeonButton onClick={onClose}>Done</NeonButton>
          </div>
        </GlassPanel>
      </motion.div>
    </motion.div>
  );
}

function GeneralSection({
  settings,
  profile,
  updateSetting,
  updateProfile,
}: {
  settings: AppSettings;
  profile: { userName: string };
  updateSetting: (key: string, value: unknown) => void;
  updateProfile: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <SettingRow label="User Name">
        <input
          type="text"
          value={profile.userName}
          onChange={(e) => updateProfile({ userName: e.target.value })}
          className="settings-input"
        />
      </SettingRow>

      <SettingRow label="Theme">
        <div className="flex gap-2">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateSetting("theme", t)}
              className={`settings-toggle ${settings.theme === t ? "settings-toggle--active" : ""}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow label="Locale">
        <input
          type="text"
          value={settings.locale}
          onChange={(e) => updateSetting("locale", e.target.value)}
          className="settings-input w-24"
        />
      </SettingRow>

      <SettingRow label="Reduced Motion">
        <Toggle
          checked={settings.reducedMotion}
          onChange={(v) => updateSetting("reducedMotion", v)}
        />
      </SettingRow>

      <SettingRow label="Global Shortcut">
        <span className="text-xs font-mono text-neon-cyan bg-neon-cyan/10 px-2 py-1 rounded">
          {settings.shortcut}
        </span>
      </SettingRow>

      <SettingRow label="Auto-start on Login">
        <Toggle checked={settings.autoStart} onChange={(v) => updateSetting("autoStart", v)} />
      </SettingRow>
    </div>
  );
}

function ModelSection({
  settings,
  updateSetting,
}: {
  settings: AppSettings;
  updateSetting: (key: string, value: unknown) => void;
}) {
  const model = settings.model ?? {
    provider: "ollama" as const,
    model: "llama3",
    baseUrl: "http://127.0.0.1:11434",
  };
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const refreshModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const api = window.electronAPI;
      if (api?.modelList) {
        const models = await api.modelList(model.provider, model.baseUrl, model.apiKey);
        setAvailableModels(models);
      } else {
        const defaults: Record<string, string[]> = {
          ollama: [
            "llama3",
            "llama3.1",
            "llama3.2",
            "mistral",
            "codellama",
            "phi3",
            "gemma2",
            "qwen2.5",
            "deepseek-coder",
          ],
          "ollama-cloud": [
            "llama3.1",
            "llama3.2",
            "mistral",
            "codellama",
            "phi3",
            "gemma2",
            "qwen2.5",
          ],
          "openai-compat": [
            "llama-3.1-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
          ],
        };
        setAvailableModels(defaults[model.provider] ?? defaults.ollama);
      }
    } catch {
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [model.provider, model.baseUrl, model.apiKey]);

  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  const defaultUrls: Record<string, string> = {
    ollama: "http://127.0.0.1:11434",
    "ollama-cloud": "https://api.ollama.com/v1",
    "openai-compat": "https://api.groq.com/openai/v1",
  };

  return (
    <div className="space-y-4">
      <SettingRow label="Provider">
        <div className="flex gap-2">
          {(["ollama", "ollama-cloud", "openai-compat"] as const).map((p) => (
            <button
              key={p}
              data-testid={`provider-${p}`}
              onClick={() =>
                updateSetting("model", {
                  ...model,
                  provider: p,
                  baseUrl: defaultUrls[p] ?? model.baseUrl,
                })
              }
              className={`settings-toggle ${model.provider === p ? "settings-toggle--active" : ""}`}
            >
              {p === "ollama" ? "Ollama Local" : p === "ollama-cloud" ? "Ollama Cloud" : "OpenAI Compat"}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow label="Model">
        <div className="flex items-center gap-2">
          <select
            data-testid="model-select"
            value={availableModels.includes(model.model) ? model.model : "custom"}
            onChange={(e) => {
              if (e.target.value !== "custom") {
                updateSetting("model", { ...model, model: e.target.value });
              }
            }}
            className="settings-input flex-1"
          >
            {availableModels.includes(model.model) ? null : (
              <option value="custom">{model.model}</option>
            )}
            {availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {availableModels.length === 0 && !loadingModels && (
              <option value="custom">Type manually below</option>
            )}
          </select>
          <button
            onClick={() => void refreshModels()}
            disabled={loadingModels}
            className="px-2 py-1 text-xs rounded border border-white/10 hover:border-neon-cyan/30 transition-colors disabled:opacity-50"
          >
            {loadingModels ? "..." : "Refresh"}
          </button>
        </div>
      </SettingRow>

      <SettingRow label="Custom Model">
        <input
          type="text"
          data-testid="model-name-input"
          value={model.model}
          onChange={(e) => updateSetting("model", { ...model, model: e.target.value })}
          placeholder="e.g. llama3, mistral"
          className="settings-input"
        />
      </SettingRow>

      <SettingRow label="Base URL">
        <input
          type="text"
          data-testid="model-base-url-input"
          value={model.baseUrl}
          onChange={(e) => updateSetting("model", { ...model, baseUrl: e.target.value })}
          placeholder={defaultUrls[model.provider] ?? "http://127.0.0.1:11434"}
          className="settings-input"
        />
      </SettingRow>

      {model.provider !== "ollama" && (
        <SettingRow label="API Key">
          <input
            type="password"
            data-testid="model-api-key-input"
            value={model.apiKey ?? ""}
            onChange={(e) =>
              updateSetting("model", { ...model, apiKey: e.target.value || undefined })
            }
            placeholder="Required for cloud"
            className="settings-input"
          />
        </SettingRow>
      )}
    </div>
  );
}

function ChannelsSection({
  settings,
  updateSetting,
}: {
  settings: AppSettings;
  updateSetting: (key: string, value: unknown) => void;
}) {
  const channels: NonNullable<AppSettings["channels"]> = settings.channels ?? {
    discord: { guilds: [] },
    telegram: {},
  };
  const discord: DiscordConfig = channels.discord ?? { guilds: [] };
  const telegram: TelegramConfig = channels.telegram ?? {};

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium text-neon-cyan mb-3 tracking-wider">DISCORD</h3>
        <div className="space-y-3">
          <SettingRow label="Bot Token">
            <input
              type="password"
              value={discord.token ?? ""}
              onChange={(e) =>
                updateSetting("channels", {
                  ...channels,
                  discord: { ...discord, token: e.target.value || undefined },
                })
              }
              placeholder="Enter bot token"
              className="settings-input"
            />
          </SettingRow>
          <SettingRow label="Guild IDs">
            <input
              type="text"
              value={(discord.guilds ?? []).join(", ")}
              onChange={(e) =>
                updateSetting("channels", {
                  ...channels,
                  discord: {
                    ...discord,
                    guilds: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
              placeholder="Comma-separated guild IDs"
              className="settings-input"
            />
          </SettingRow>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-neon-cyan mb-3 tracking-wider">TELEGRAM</h3>
        <div className="space-y-3">
          <SettingRow label="Bot Token">
            <input
              type="password"
              value={telegram.token ?? ""}
              onChange={(e) =>
                updateSetting("channels", {
                  ...channels,
                  telegram: { token: e.target.value || undefined },
                })
              }
              placeholder="Enter bot token"
              className="settings-input"
            />
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

function SkillsSection({
  settings,
  updateSetting,
}: {
  settings: AppSettings;
  updateSetting: (key: string, value: unknown) => void;
}) {
  const skills: NonNullable<AppSettings["skills"]> = settings.skills ?? {};
  const email: NonNullable<NonNullable<AppSettings["skills"]>["email"]> = skills.email ?? {};
  const gmail: GmailConfig = email.gmail ?? {
    imap: "imap.gmail.com",
    smtp: "smtp.gmail.com",
    imapPort: 993,
    smtpPort: 465,
  };
  const graph: GraphConfig = email.graph ?? { tenant: "consumers" };
  const calendar: CalendarConfig = skills.calendar ?? { provider: "live" };
  const notion: NotionConfig = skills.notion ?? {};
  const weather: WeatherConfig = skills.weather ?? { provider: "wttr" };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium text-neon-cyan mb-3 tracking-wider">EMAIL</h3>
        <div className="space-y-3">
          <SettingRow label="Gmail IMAP Host">
            <input
              type="text"
              value={gmail.imap ?? ""}
              onChange={(e) =>
                updateSetting("skills", {
                  ...skills,
                  email: {
                    ...email,
                    gmail: { ...gmail, imap: e.target.value || "imap.gmail.com" },
                  },
                })
              }
              className="settings-input"
            />
          </SettingRow>
          <SettingRow label="Gmail SMTP Host">
            <input
              type="text"
              value={gmail.smtp ?? ""}
              onChange={(e) =>
                updateSetting("skills", {
                  ...skills,
                  email: {
                    ...email,
                    gmail: { ...gmail, smtp: e.target.value || "smtp.gmail.com" },
                  },
                })
              }
              className="settings-input"
            />
          </SettingRow>
          <SettingRow label="IMAP Port">
            <input
              type="number"
              value={gmail.imapPort ?? 993}
              onChange={(e) =>
                updateSetting("skills", {
                  ...skills,
                  email: { ...email, gmail: { ...gmail, imapPort: Number(e.target.value) || 993 } },
                })
              }
              className="settings-input w-20"
            />
          </SettingRow>
          <SettingRow label="SMTP Port">
            <input
              type="number"
              value={gmail.smtpPort ?? 465}
              onChange={(e) =>
                updateSetting("skills", {
                  ...skills,
                  email: { ...email, gmail: { ...gmail, smtpPort: Number(e.target.value) || 465 } },
                })
              }
              className="settings-input w-20"
            />
          </SettingRow>
          <SettingRow label="Graph Client ID">
            <input
              type="text"
              value={graph.clientId ?? ""}
              onChange={(e) =>
                updateSetting("skills", {
                  ...skills,
                  email: { ...email, graph: { ...graph, clientId: e.target.value || undefined } },
                })
              }
              placeholder="Microsoft Graph client ID"
              className="settings-input"
            />
          </SettingRow>
          <SettingRow label="Graph Tenant">
            <input
              type="text"
              value={graph.tenant ?? "consumers"}
              onChange={(e) =>
                updateSetting("skills", {
                  ...skills,
                  email: { ...email, graph: { ...graph, tenant: e.target.value || "consumers" } },
                })
              }
              className="settings-input"
            />
          </SettingRow>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-neon-cyan mb-3 tracking-wider">CALENDAR</h3>
        <div className="space-y-3">
          <SettingRow label="Provider">
            <div className="flex gap-2">
              {(["live", "google"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => updateSetting("skills", { ...skills, calendar: { provider: p } })}
                  className={`settings-toggle ${
                    (calendar.provider ?? "live") === p ? "settings-toggle--active" : ""
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </SettingRow>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-neon-cyan mb-3 tracking-wider">NOTION</h3>
        <div className="space-y-3">
          <SettingRow label="API Token">
            <input
              type="password"
              value={notion.token ?? ""}
              onChange={(e) =>
                updateSetting("skills", {
                  ...skills,
                  notion: { token: e.target.value || undefined },
                })
              }
              placeholder="Enter Notion integration token"
              className="settings-input"
            />
          </SettingRow>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-neon-cyan mb-3 tracking-wider">WEATHER</h3>
        <div className="space-y-3">
          <SettingRow label="Provider">
            <div className="flex gap-2">
              {(["wttr", "openweathermap"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => updateSetting("skills", { ...skills, weather: { provider: p } })}
                  className={`settings-toggle ${
                    (weather.provider ?? "wttr") === p ? "settings-toggle--active" : ""
                  }`}
                >
                  {p === "wttr" ? "wttr.in" : "OWM"}
                </button>
              ))}
            </div>
          </SettingRow>
          {(weather.provider ?? "wttr") === "openweathermap" && (
            <SettingRow label="OWM API Key">
              <input
                type="password"
                value={(weather as WeatherConfig & { apiKey?: string }).apiKey ?? ""}
                onChange={(e) =>
                  updateSetting("skills", {
                    ...skills,
                    weather: { provider: "openweathermap", apiKey: e.target.value || undefined },
                  })
                }
                placeholder="OpenWeatherMap API key"
                className="settings-input"
              />
            </SettingRow>
          )}
        </div>
      </div>
    </div>
  );
}

function AboutSection({ onReset }: { onReset: () => void }) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <h3 className="text-2xl font-light tracking-tighter text-neon-cyan mb-1">JARVIS</h3>
        <p className="text-xs text-text-secondary tracking-wider">PERSONAL AI ASSISTANT v0.1.0</p>
      </div>
      <div className="space-y-2 text-xs text-text-secondary">
        <p>OpenJarvis Desktop — local-first, privacy-first AI assistant.</p>
        <p>All data stays on your device. No cloud services required.</p>
        <div className="pt-3 border-t border-white/10 space-y-1">
          <p>Architecture: Electron + NexusEngine</p>
          <p>Agents: 15 built-in skill agents</p>
          <p>Channels: Discord, Telegram</p>
        </div>
      </div>
      <div className="pt-4 border-t border-white/10">
        {confirmed ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                onReset();
                setConfirmed(false);
              }}
              className="px-3 py-1.5 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
            >
              Confirm Reset
            </button>
            <button
              onClick={() => setConfirmed(false)}
              className="px-3 py-1.5 rounded text-xs border border-white/10 hover:border-neon-cyan/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmed(true)}
            className="px-3 py-1.5 rounded text-xs border border-white/10 text-text-secondary hover:border-red-500/30 hover:text-red-400 transition-colors"
          >
            Reset to Defaults
          </button>
        )}
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm shrink-0">{label}</span>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-6 rounded-full p-1 transition-colors ${
        checked ? "bg-neon-cyan/30" : "bg-white/10"
      }`}
    >
      <motion.div
        className="w-4 h-4 rounded-full bg-white"
        animate={{ x: checked ? 16 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
