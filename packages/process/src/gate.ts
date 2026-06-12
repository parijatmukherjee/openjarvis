import { execSync } from "node:child_process";
import type { ProcessState } from "./engine.js";
import { ProcessError } from "./engine.js";
import { PHASE_RULES } from "./manifest.js";

export type CheckName = "build" | "lint" | "format" | "test" | "coverage";

export interface CheckResult {
  passed: boolean;
  failures: string[];
}

export async function checkBuild(): Promise<boolean> {
  try {
    execSync("npm run build", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export async function checkLint(): Promise<boolean> {
  try {
    execSync("npm run lint", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export async function checkFormat(): Promise<boolean> {
  try {
    execSync("npm run format:check", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export async function checkTests(): Promise<boolean> {
  try {
    execSync("npm test", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export async function checkCoverage(_threshold = 0.99): Promise<boolean> {
  try {
    execSync(`npm run coverage`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export const CHECKERS: Record<string, () => Promise<boolean>> = {
  build: checkBuild,
  lint: checkLint,
  format: checkFormat,
  test: checkTests,
  coverage: checkCoverage,
};

export async function runGate(
  checks: string[],
  checkers?: Record<string, () => Promise<boolean>>,
): Promise<CheckResult> {
  const failures: string[] = [];
  const map = checkers ?? CHECKERS;
  for (const check of checks) {
    const checker = map[check];
    if (checker && !(await checker())) {
      failures.push(`${check} failed`);
    }
  }
  return { passed: failures.length === 0, failures };
}

export async function validatePhase(
  _state: ProcessState,
  checkers?: Record<string, () => Promise<boolean>>,
): Promise<{ logs: string[] }> {
  const rules = PHASE_RULES.validate;
  if (!rules) return { logs: ["no validation rules"] };

  const { passed, failures } = await runGate(rules.gateChecks ?? [], checkers);
  if (!passed) throw new ProcessError(`Gate failed: ${failures.join(", ")}`);

  return { logs: ["all gates passed"] };
}
