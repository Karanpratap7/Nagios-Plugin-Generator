import { z } from "zod";

export const checkTypeSchema = z.enum(["HTTP_API", "CPU", "MEMORY", "DISK"]);
export type CheckType = z.infer<typeof checkTypeSchema>;

const commonFields = z.object({
  name: z.string().min(1, "Name is required").max(64),
  description: z.string().max(256).optional().or(z.literal("")),
  author: z.string().max(128).optional().or(z.literal("")),
  version: z.string().max(32).optional().or(z.literal("")),

  checkType: checkTypeSchema.optional(), // optional for backward-compat
  target: z.string().max(1024).nullable().optional(),

  // Backward compatibility: old UI posted `command` (URL or command).
  command: z.string().max(1024).nullable().optional(),

  advancedMode: z.boolean().optional().default(false),
  manualCommand: z.string().max(2048).nullable().optional(),

  warningThreshold: z.string().max(128).nullable().optional(),
  criticalThreshold: z.string().max(128).nullable().optional(),

  timeoutSeconds: z.number().int().min(1).max(120).optional(),

  copyToContainer: z.boolean().optional().default(false),
  containerName: z.string().max(128).nullable().optional(),
  targetDir: z.string().max(256).nullable().optional()
});

export const pluginInputSchema = commonFields.superRefine((val, ctx) => {
  // Normalize legacy input:
  // - If checkType missing, default to HTTP_API
  // - If target missing, use `command` as target (legacy)
  const checkType = val.checkType ?? "HTTP_API";

  const target = (val.target ?? "").trim();
  const legacy = (val.command ?? "").trim();

  const effectiveTarget = target || legacy;
  const needsTarget = checkType === "HTTP_API" || checkType === "DISK";
  if (needsTarget && !effectiveTarget && !val.manualCommand) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Target is required (or provide legacy command).",
      path: ["target"]
    });
  }

  if (val.advancedMode) {
    if (!val.manualCommand || !val.manualCommand.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Manual command is required in Advanced Mode.",
        path: ["manualCommand"]
      });
    }
  }

  // Minimal check-type/target expectations (detailed validation happens later)
  if (checkType === "DISK" && effectiveTarget && !effectiveTarget.startsWith("/")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Disk target should be a filesystem path like / or /var.",
      path: ["target"]
    });
  }
});

export type PluginInput = z.infer<typeof pluginInputSchema>;

export interface GeneratedPluginMeta {
  id: string;
  filename: string;
  relativePath: string;
  absolutePath: string;
  content: string;
}

export function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!base) return "plugin";
  if (base.startsWith("check_")) return base;
  return `check_${base}`;
}

/**
 * Parse threshold strings like:
 *  - "response time > 0.5"
 *  - ">0.75"
 *  - "0.5"
 * Returns a number (seconds) or null if not parsable.
 */
export function parseThresholdSeconds(input?: string | null): number | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  // Extract first floating number in the string
  const match = trimmed.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!isFinite(n)) return null;
  return n;
}

