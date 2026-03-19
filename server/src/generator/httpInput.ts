import { z } from "zod";
import { parseThresholdSeconds, PluginInput } from "./schema";

export interface ParsedHttpInputs {
  url: string;
  warningThresholdSeconds: number | null;
  criticalThresholdSeconds: number | null;
  timeoutSeconds: number;
}

/**
 * Normalize and validate the "command" field as a URL.
 * We intentionally do NOT accept arbitrary shell commands.
 */
export function parseHttpInputs(input: PluginInput): ParsedHttpInputs {
  const raw = (input.target ?? input.command ?? "").toString();
  const url = normalizeHttpUrl(raw);

  const warning = parseThresholdSeconds(input.warningThreshold ?? null);
  const critical = parseThresholdSeconds(input.criticalThreshold ?? null);

  // Validate parseability if user supplied non-empty strings
  if (input.warningThreshold && warning == null) {
    throw new Error(
      `Unable to parse warning threshold: '${input.warningThreshold}'. Expected like 'response time > 0.8'.`
    );
  }
  if (input.criticalThreshold && critical == null) {
    throw new Error(
      `Unable to parse critical threshold: '${input.criticalThreshold}'. Expected like 'response time > 2.0'.`
    );
  }

  if (warning != null && warning < 0) {
    throw new Error("Warning threshold must be >= 0.");
  }
  if (critical != null && critical < 0) {
    throw new Error("Critical threshold must be >= 0.");
  }
  if (warning != null && critical != null && critical <= warning) {
    throw new Error("Critical threshold must be greater than warning threshold.");
  }

  const timeoutSeconds = input.timeoutSeconds ?? 5;
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 120) {
    throw new Error("Timeout must be an integer between 1 and 120 seconds.");
  }

  return {
    url,
    warningThresholdSeconds: warning,
    criticalThresholdSeconds: critical,
    timeoutSeconds
  };
}

export function normalizeHttpUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("URL is required.");
  if (/\s/.test(trimmed)) {
    throw new Error(
      "URL must not contain spaces. Provide a single URL (not a full curl command)."
    );
  }

  const withScheme = trimmed.match(/^https?:\/\//i)
    ? trimmed
    : `http://${trimmed}`;

  // Validate using WHATWG URL
  const url = new URL(withScheme);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }

  // Basic host validation via zod (extra guard)
  const hostSchema = z.string().min(1);
  hostSchema.parse(url.hostname);

  return url.toString();
}

