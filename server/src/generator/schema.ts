import { z } from "zod";

export const pluginInputSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(64, "Name must be at most 64 characters"),
  description: z.string().max(256).optional().or(z.literal("")),
  author: z.string().max(128).optional().or(z.literal("")),
  version: z.string().max(32).optional().or(z.literal("")),
  command: z
    .string()
    .min(1, "Command is required")
    .max(1024, "Command must be at most 1024 characters"),
  warningThreshold: z.string().max(128).nullable().optional(),
  criticalThreshold: z.string().max(128).nullable().optional(),
  outputTemplate: z.string().max(256).nullable().optional(),
  copyToContainer: z.boolean().optional().default(false),
  containerName: z.string().max(128).nullable().optional(),
  targetDir: z.string().max(256).nullable().optional()
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

