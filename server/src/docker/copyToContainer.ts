import fs from "fs";
import path from "path";
import Docker from "dockerode";
import tar from "tar-stream";

export interface CopyOptions {
  dockerSocketPath?: string;
  containerName: string;
  localFilePath: string;
  targetDir: string;
  filename: string;
}

export async function copyPluginToContainer(
  options: CopyOptions
): Promise<{ containerName: string; targetPath: string }> {
  const socketPath = options.dockerSocketPath || "/var/run/docker.sock";

  if (!fs.existsSync(socketPath)) {
    throw new Error(
      `Docker socket not found at ${socketPath}. Is Docker available and mounted?`
    );
  }

  const docker = new Docker({ socketPath });

  const container = docker.getContainer(options.containerName);
  const stat = await container.inspect().catch(() => {
    throw new Error(
      `Container '${options.containerName}' not found or not accessible.`
    );
  });

  if (!stat) {
    throw new Error(
      `Container '${options.containerName}' not found or not accessible.`
    );
  }

  const fileContent = await fs.promises.readFile(options.localFilePath);

  const pack = tar.pack();
  const tarPromise = new Promise<void>((resolve, reject) => {
    pack.entry(
      {
        name: options.filename,
        mode: 0o755
      },
      fileContent,
      (err: Error | null | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        pack.finalize();
        resolve();
      }
    );
  });

  const targetDir = options.targetDir || "/usr/local/nagios/libexec";
  const targetPath = path
    .join(targetDir, options.filename)
    .replace(/\\/g, "/");

  const putArchivePromise = container.putArchive(pack, {
    path: targetDir
  });

  await Promise.all([tarPromise, putArchivePromise]);

  try {
    const exec = await container.exec({
      Cmd: ["chmod", "+x", targetPath],
      AttachStdout: true,
      AttachStderr: true
    });
    await exec.start({});
  } catch {
    // Best-effort; do not fail whole operation if chmod fails
  }

  return { containerName: options.containerName, targetPath };
}

