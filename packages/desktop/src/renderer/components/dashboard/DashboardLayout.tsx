import { Header } from "./Header";
import { VoiceWaveform } from "../ui/VoiceWaveform";
import { AgentRadar } from "../ui/AgentRadar";
import { TaskBoard } from "./TaskBoard";
import { AgentStatusGrid } from "./AgentStatusGrid";
import { ConversationPanel } from "./ConversationPanel";

export function DashboardLayout() {
  return (
    <div className="h-screen flex flex-col bg-bg-deep">
      <Header />

      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <div className="grid grid-cols-12 gap-6 h-full">
          {/* Left column - Voice Waveform + Agent Radar */}
          <div className="col-span-3 flex flex-col gap-6">
            <div className="flex-1 flex items-center justify-center">
              <VoiceWaveform />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <AgentRadar />
            </div>
          </div>

          {/* Center column - Task Board */}
          <div className="col-span-6">
            <TaskBoard />
          </div>

          {/* Right column - Agent Status */}
          <div className="col-span-3">
            <AgentStatusGrid />
          </div>
        </div>

        {/* Bottom - Conversation Panel */}
        <div className="mt-4">
          <ConversationPanel />
        </div>
      </div>
    </div>
  );
}
