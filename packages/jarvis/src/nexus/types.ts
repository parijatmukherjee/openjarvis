export interface Intent {
  action: string;
  params: Record<string, unknown>;
  confidence: number;
  ambiguous: boolean;
}

export interface AgentRoute {
  agentId: string;
  confidence: number;
  required: boolean;
  timeoutMs?: number;
}

export interface DispatchPlan {
  parallel: AgentRoute[];
  sequential: AgentRoute[];
  primary: AgentRoute;
}

export interface AgentResult {
  agentId: string;
  output: unknown;
  success: boolean;
}

export interface Synthesis {
  text: string;
  sourceAgentIds: string[];
}
