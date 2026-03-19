import crypto from "crypto";
import path from "path";
import {
  PluginInput,
  GeneratedPluginMeta,
  slugifyName
} from "./schema";
import { CheckType } from "./schema";
import { generateHttpPluginScript } from "./scriptGenerators/httpScript";
import { generateCpuPluginScript } from "./scriptGenerators/cpuScript";
import { generateMemoryPluginScript } from "./scriptGenerators/memoryScript";
import { generateDiskPluginScript } from "./scriptGenerators/diskScript";

export interface GenerateOptions {
  outputDir: string;
}

export function generatePluginScript(
  input: PluginInput,
  options: GenerateOptions
): GeneratedPluginMeta {
  const id = crypto.randomBytes(6).toString("hex");
  const slug = slugifyName(input.name);
  const filename = `${slug}_${id}.sh`;

  const safeOutputDir = path.resolve(options.outputDir);
  const relativePath = filename;
  const absolutePath = path.join(safeOutputDir, filename);

  const script = generateByCheckType(input);

  return {
    id,
    filename,
    relativePath,
    absolutePath,
    content: script
  };
}

function generateByCheckType(input: PluginInput): string {
  const checkType: CheckType = (input.checkType ?? "HTTP_API") as CheckType;
  switch (checkType) {
    case "HTTP_API":
      return generateHttpPluginScript(input);
    case "CPU":
      return generateCpuPluginScript(input);
    case "MEMORY":
      return generateMemoryPluginScript(input);
    case "DISK":
      return generateDiskPluginScript(input);
  }
}
