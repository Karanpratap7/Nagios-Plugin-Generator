import express from "express";
import path from "path";
import dotenv from "dotenv";

import { router as apiRouter } from "./routes/api";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use("/api", apiRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Nagios Plugin Generator server listening on port ${port}`);
});

