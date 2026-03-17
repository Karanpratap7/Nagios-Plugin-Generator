import { Router } from "express";
import fs from "fs";
import path from "path";
import { pluginInputSchema } from "../generator/schema";
import { generatePluginScript } from "../generator/bashTemplate";
import { copyPluginToContainer } from "../docker/copyToContainer";

export const router = Router();

const OUTPUT_DIR = path.join(__dirname, "..", "..", "generated-plugins");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.post("/generate", async (req, res) => {
  try {
    const parsed = pluginInputSchema.parse(req.body);

    const meta = generatePluginScript(parsed, { outputDir: OUTPUT_DIR });

    await fs.promises.writeFile(meta.absolutePath, meta.content, {
      mode: 0o755
    });

    return res.status(201).json({
      id: meta.id,
      filename: meta.filename,
      path: meta.relativePath,
      preview: meta.content
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({
        error: "Invalid input",
        details: err.flatten()
      });
    }
    // eslint-disable-next-line no-console
    console.error("Error generating plugin", err);
    return res.status(500).json({ error: "Failed to generate plugin" });
  }
});

router.get("/plugins/:id/download", async (req, res) => {
  const { id } = req.params;

  try {
    const files = await fs.promises.readdir(OUTPUT_DIR);
    const match = files.find((f) => f.includes(id));
    if (!match) {
      return res.status(404).json({ error: "Plugin not found" });
    }

    const filePath = path.join(OUTPUT_DIR, match);
    res.download(filePath, match);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error serving download", err);
    return res.status(500).json({ error: "Failed to download plugin" });
  }
});

router.post("/plugins/:id/copy-to-container", async (req, res) => {
  const { id } = req.params;
  const containerName =
    (req.body && req.body.containerName) ||
    process.env.NAGIOS_CONTAINER_NAME ||
    "nagios";
  const targetDir =
    (req.body && req.body.targetDir) ||
    process.env.NAGIOS_TARGET_DIR ||
    "/usr/local/nagios/libexec";

  try {
    const files = await fs.promises.readdir(OUTPUT_DIR);
    const match = files.find((f) => f.includes(id));
    if (!match) {
      return res.status(404).json({ error: "Plugin not found" });
    }

    const filePath = path.join(OUTPUT_DIR, match);

    const result = await copyPluginToContainer({
      containerName,
      localFilePath: filePath,
      targetDir,
      filename: match
    });

    return res.json({
      containerName: result.containerName,
      targetPath: result.targetPath
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Error copying plugin to container", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to copy plugin to container" });
  }
});

