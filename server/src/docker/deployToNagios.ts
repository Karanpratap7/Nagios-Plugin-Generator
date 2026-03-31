import fs from "fs";
import path from "path";
import { PassThrough } from "stream";
import Docker from "dockerode";
import tar from "tar-stream";

// ─── Config paths inside the Nagios container ───────────────────────────────
const LIBEXEC_DIR = "/usr/local/nagios/libexec";
const COMMANDS_CFG = "/opt/nagios/etc/objects/commands.cfg";
const LOCALHOST_CFG = "/opt/nagios/etc/objects/localhost.cfg";
const NAGIOS_BIN = "/usr/local/nagios/bin/nagios";
const NAGIOS_CFG = "/opt/nagios/etc/nagios.cfg";

// ─── Public types ────────────────────────────────────────────────────────────
export interface DeployOptions {
  dockerSocketPath?: string;
  containerName: string;
  localFilePath: string;
  filename: string;
  /** Sanitized command_name (e.g. "check_http_custom") */
  pluginName: string;
  /** Human-readable service_description */
  pluginDescription: string;
  /** host_name for the service definition (default: "localhost") */
  hostName: string;
}

export interface DeployLogEntry {
  step: string;
  status: "success" | "error" | "skipped" | "info";
  message: string;
}

export interface DeployResult {
  success: boolean;
  logs: DeployLogEntry[];
  /** Present when Docker is unavailable – ready-to-run shell script */
  fallbackScript?: string;
}

// ─── Sanitizers ─────────────────────────────────────────────────────────────
export function sanitizePluginName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 64) || "check_plugin";
}

export function sanitizeDescription(desc: string): string {
  return desc
    .replace(/[\r\n{}#;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 128) || "Nagios Service";
}

// ─── Docker helpers ──────────────────────────────────────────────────────────
async function execInContainer(
  container: Docker.Container,
  cmd: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true
  });

  const stream = await exec.start({ hijack: true, stdin: false });

  return new Promise((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();

    stdoutStream.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    stderrStream.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    // dockerode exposes modem.demuxStream for multiplexed streams
    (container as any).modem.demuxStream(stream, stdoutStream, stderrStream);

    stream.on("end", async () => {
      try {
        const inspect = await exec.inspect();
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: Buffer.concat(stderrChunks).toString("utf8"),
          exitCode: inspect.ExitCode ?? 0
        });
      } catch {
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: Buffer.concat(stderrChunks).toString("utf8"),
          exitCode: 0
        });
      }
    });

    stream.on("error", reject);
  });
}

async function writeFileToContainer(
  container: Docker.Container,
  content: string,
  targetPath: string
): Promise<void> {
  const filename = path.basename(targetPath);
  const dir = path.dirname(targetPath);

  const pack = tar.pack();
  const tarPromise = new Promise<void>((resolve, reject) => {
    pack.entry({ name: filename }, Buffer.from(content, "utf8"), (err) => {
      if (err) {
        reject(err);
        return;
      }
      pack.finalize();
      resolve();
    });
  });

  const putArchivePromise = container.putArchive(pack, { path: dir });
  await Promise.all([tarPromise, putArchivePromise]);
}

// ─── Config block builders ───────────────────────────────────────────────────
function buildCommandDef(pluginName: string, filename: string): string {
  return (
    "\ndefine command {\n" +
    `    command_name    ${pluginName}\n` +
    `    command_line    ${LIBEXEC_DIR}/${filename}\n` +
    "}\n"
  );
}

function buildServiceDef(
  pluginName: string,
  pluginDescription: string,
  hostName: string
): string {
  return (
    "\ndefine service {\n" +
    "    use                     local-service\n" +
    `    host_name               ${hostName}\n` +
    `    service_description     ${pluginDescription}\n` +
    `    check_command           ${pluginName}\n` +
    "}\n"
  );
}

// ─── Fallback shell script ───────────────────────────────────────────────────
function generateFallbackScript(options: DeployOptions): string {
  const { containerName, filename, pluginName, pluginDescription, hostName } =
    options;

  const cmdBlock = buildCommandDef(pluginName, filename);
  const svcBlock = buildServiceDef(pluginName, pluginDescription, hostName);

  // Escape single quotes for heredoc safety
  const escapedCmd = cmdBlock.replace(/'/g, "'\\''");
  const escapedSvc = svcBlock.replace(/'/g, "'\\''");

  return `#!/usr/bin/env bash
# ============================================================
# Nagios Plugin Deployment Script
# Generated by Nagios Plugin Generator
# Run this on a host where Docker CLI is available.
# ============================================================
set -euo pipefail

CONTAINER="${containerName}"
LOCAL_FILE="${filename}"
PLUGIN_PATH="${LIBEXEC_DIR}/${filename}"
COMMANDS_CFG="${COMMANDS_CFG}"
LOCALHOST_CFG="${LOCALHOST_CFG}"

echo "[1/5] Copying plugin into container..."
docker cp "$LOCAL_FILE" "$CONTAINER:$PLUGIN_PATH"
echo "      Done."

echo "[2/5] Making plugin executable..."
docker exec "$CONTAINER" chmod +x "$PLUGIN_PATH"
echo "      Done."

echo "[3/5] Appending command definition (if not already present)..."
EXISTING_CMD=$(docker exec "$CONTAINER" grep -c "command_name    ${pluginName}" "$COMMANDS_CFG" 2>/dev/null || echo "0")
if [ "$EXISTING_CMD" -eq "0" ]; then
  docker exec "$CONTAINER" bash -c 'cat >> '"$COMMANDS_CFG"' << '"'"'NAGIOS_EOF'"'"'
${escapedCmd}
NAGIOS_EOF'
  echo "      Command definition added."
else
  echo "      Command definition already exists, skipped."
fi

echo "[4/5] Appending service definition (if not already present)..."
EXISTING_SVC=$(docker exec "$CONTAINER" grep -c "service_description     ${pluginDescription}" "$LOCALHOST_CFG" 2>/dev/null || echo "0")
if [ "$EXISTING_SVC" -eq "0" ]; then
  docker exec "$CONTAINER" bash -c 'cat >> '"$LOCALHOST_CFG"' << '"'"'NAGIOS_EOF'"'"'
${escapedSvc}
NAGIOS_EOF'
  echo "      Service definition added."
else
  echo "      Service definition already exists, skipped."
fi

echo "[5/5] Validating configuration..."
docker exec "$CONTAINER" ${NAGIOS_BIN} -v ${NAGIOS_CFG}

echo ""
echo "Restarting Nagios container..."
docker restart "$CONTAINER"

echo ""
echo "============================================================"
echo "Deployment complete!"
echo "============================================================"
`;
}

// ─── Main deploy function ────────────────────────────────────────────────────
export async function deployPluginToNagios(
  options: DeployOptions
): Promise<DeployResult> {
  const logs: DeployLogEntry[] = [];
  const socketPath = options.dockerSocketPath ?? "/var/run/docker.sock";

  // ── Docker availability check ────────────────────────────────────────────
  if (!fs.existsSync(socketPath)) {
    const fallbackScript = generateFallbackScript(options);
    return {
      success: false,
      logs: [
        {
          step: "docker_check",
          status: "error",
          message:
            `Docker socket not found at ${socketPath}. ` +
            "Docker is unavailable – a deployment shell script has been generated instead."
        }
      ],
      fallbackScript
    };
  }

  const docker = new Docker({ socketPath });

  // ── Container existence check ────────────────────────────────────────────
  const container = docker.getContainer(options.containerName);
  try {
    await container.inspect();
    logs.push({
      step: "container_check",
      status: "success",
      message: `Container '${options.containerName}' found and accessible.`
    });
  } catch {
    const fallbackScript = generateFallbackScript(options);
    return {
      success: false,
      logs: [
        {
          step: "container_check",
          status: "error",
          message:
            `Container '${options.containerName}' not found or not accessible. ` +
            "A deployment shell script has been generated instead."
        }
      ],
      fallbackScript
    };
  }

  // ── Step 1 · Copy plugin file ─────────────────────────────────────────────
  try {
    const fileContent = await fs.promises.readFile(options.localFilePath);
    const pack = tar.pack();
    const tarPromise = new Promise<void>((resolve, reject) => {
      pack.entry(
        { name: options.filename, mode: 0o755 },
        fileContent,
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          pack.finalize();
          resolve();
        }
      );
    });
    await Promise.all([tarPromise, container.putArchive(pack, { path: LIBEXEC_DIR })]);

    logs.push({
      step: "copy",
      status: "success",
      message: `Plugin copied to ${LIBEXEC_DIR}/${options.filename}`
    });
  } catch (err: any) {
    logs.push({
      step: "copy",
      status: "error",
      message: `Failed to copy plugin: ${err.message}`
    });
    return { success: false, logs };
  }

  // ── Step 2 · chmod +x ────────────────────────────────────────────────────
  try {
    const targetPath = `${LIBEXEC_DIR}/${options.filename}`;
    const result = await execInContainer(container, ["chmod", "+x", targetPath]);
    if (result.exitCode !== 0) {
      logs.push({
        step: "chmod",
        status: "error",
        message: `chmod failed (exit ${result.exitCode}): ${result.stderr.trim()}`
      });
      return { success: false, logs };
    }
    logs.push({
      step: "chmod",
      status: "success",
      message: `Plugin made executable: ${LIBEXEC_DIR}/${options.filename}`
    });
  } catch (err: any) {
    logs.push({
      step: "chmod",
      status: "error",
      message: `chmod error: ${err.message}`
    });
    return { success: false, logs };
  }

  // ── Step 3 · Update commands.cfg ─────────────────────────────────────────
  try {
    const readResult = await execInContainer(container, ["cat", COMMANDS_CFG]);
    const existing = readResult.stdout;
    const marker = `command_name    ${options.pluginName}`;

    if (existing.includes(marker)) {
      logs.push({
        step: "command_config",
        status: "skipped",
        message: `Command '${options.pluginName}' already exists in commands.cfg – skipped.`
      });
    } else {
      const updated = existing + buildCommandDef(options.pluginName, options.filename);
      await writeFileToContainer(container, updated, COMMANDS_CFG);
      logs.push({
        step: "command_config",
        status: "success",
        message: `Command definition for '${options.pluginName}' appended to commands.cfg`
      });
    }
  } catch (err: any) {
    logs.push({
      step: "command_config",
      status: "error",
      message: `Failed to update commands.cfg: ${err.message}`
    });
    return { success: false, logs };
  }

  // ── Step 4 · Update localhost.cfg (service definition) ───────────────────
  try {
    const readResult = await execInContainer(container, ["cat", LOCALHOST_CFG]);
    const existing = readResult.stdout;
    const marker = `service_description     ${options.pluginDescription}`;

    if (existing.includes(marker)) {
      logs.push({
        step: "service_config",
        status: "skipped",
        message: `Service '${options.pluginDescription}' already exists in localhost.cfg – skipped.`
      });
    } else {
      const updated =
        existing +
        buildServiceDef(
          options.pluginName,
          options.pluginDescription,
          options.hostName
        );
      await writeFileToContainer(container, updated, LOCALHOST_CFG);
      logs.push({
        step: "service_config",
        status: "success",
        message: `Service definition for '${options.pluginDescription}' appended to localhost.cfg`
      });
    }
  } catch (err: any) {
    logs.push({
      step: "service_config",
      status: "error",
      message: `Failed to update localhost.cfg: ${err.message}`
    });
    return { success: false, logs };
  }

  // ── Step 5 · Validate configuration ──────────────────────────────────────
  let validationOutput = "";
  try {
    const result = await execInContainer(container, [NAGIOS_BIN, "-v", NAGIOS_CFG]);
    validationOutput = (result.stdout + result.stderr).trim();

    if (result.exitCode !== 0) {
      logs.push({
        step: "validate",
        status: "error",
        message:
          `Configuration validation FAILED (exit ${result.exitCode}).\n` +
          validationOutput
      });
      return { success: false, logs };
    }

    logs.push({
      step: "validate",
      status: "success",
      message: `Configuration validation passed.\n${validationOutput}`
    });
  } catch (err: any) {
    logs.push({
      step: "validate",
      status: "error",
      message: `Validation command error: ${err.message}`
    });
    return { success: false, logs };
  }

  // ── Step 6 · Restart container ───────────────────────────────────────────
  try {
    await container.restart({ t: 10 });
    logs.push({
      step: "restart",
      status: "success",
      message: `Container '${options.containerName}' restarted successfully.`
    });
  } catch (err: any) {
    logs.push({
      step: "restart",
      status: "error",
      message: `Failed to restart container: ${err.message}`
    });
    return { success: false, logs };
  }

  return { success: true, logs };
}
