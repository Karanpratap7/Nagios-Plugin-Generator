import { CheckType, PluginInput, parseThresholdSeconds } from "./schema";

export interface GeneratedCommand {
  checkType: CheckType;
  command: string;
  notes: string[];
  // Flags derived from description keywords
  enableLatencyLogic: boolean;
  enableStatusLogic: boolean;
}

const latencyKeywords = ["latency", "response time", "responsetime", "slow"];
const statusKeywords = ["status", "health", "up", "availability"];

export function inferRuleFlags(description?: string | null): {
  enableLatencyLogic: boolean;
  enableStatusLogic: boolean;
} {
  const d = (description || "").toLowerCase();
  const enableLatencyLogic = latencyKeywords.some((k) => d.includes(k));
  const enableStatusLogic = statusKeywords.some((k) => d.includes(k));

  // Sensible defaults: if no keywords, enable both for HTTP.
  return {
    enableLatencyLogic,
    enableStatusLogic
  };
}

export function resolveEffectiveTarget(input: PluginInput): string {
  const target = (input.target ?? "").trim();
  if (target) return target;
  const legacy = (input.command ?? "").trim();
  if (legacy) return legacy;
  return "";
}

export function generateCommand(input: PluginInput): GeneratedCommand {
  const checkType: CheckType = (input.checkType ?? "HTTP_API") as CheckType;
  const target = resolveEffectiveTarget(input);

  const flags = inferRuleFlags(input.description || "");

  const notes: string[] = [];

  // Threshold parsing is handled in script generator, but we still validate basic format here
  const w = parseThresholdSeconds(input.warningThreshold ?? null);
  const c = parseThresholdSeconds(input.criticalThreshold ?? null);
  if (input.warningThreshold && w == null) {
    notes.push("Warning threshold could not be parsed; it may be ignored.");
  }
  if (input.criticalThreshold && c == null) {
    notes.push("Critical threshold could not be parsed; it may be ignored.");
  }

  switch (checkType) {
    case "HTTP_API": {
      // Auto command for display purposes; script generator uses structured inputs directly.
      const url = target;
      const cmd = `curl -s -o /dev/null -w "%{http_code} %{time_total}" "${url}"`;
      if (!flags.enableLatencyLogic) {
        notes.push(
          "Description did not match latency keywords; response-time thresholds may be disabled."
        );
      }
      if (!flags.enableStatusLogic) {
        notes.push(
          "Description did not match status/health keywords; HTTP status enforcement may be disabled."
        );
      }
      return {
        checkType,
        command: cmd,
        notes,
        enableLatencyLogic: flags.enableLatencyLogic,
        enableStatusLogic: flags.enableStatusLogic
      };
    }
    case "CPU":
      return {
        checkType,
        command: `top -bn1 | grep "Cpu(s)"`,
        notes,
        enableLatencyLogic: false,
        enableStatusLogic: true
      };
    case "MEMORY":
      return {
        checkType,
        command: `free -m`,
        notes,
        enableLatencyLogic: false,
        enableStatusLogic: true
      };
    case "DISK": {
      const path = target || "/";
      return {
        checkType,
        command: `df -h "${path}"`,
        notes,
        enableLatencyLogic: false,
        enableStatusLogic: true
      };
    }
  }
}

