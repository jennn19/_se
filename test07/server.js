import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MAX_NOTE_LENGTH = 50;

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const staticDirectory = path.join(currentDirectory, "static");

export function validateNote(rawContent) {
  if (typeof rawContent !== "string") {
    throw new Error("筆記內容必須是文字。");
  }

  const content = rawContent.trim();
  const length = Array.from(content).length;

  if (length === 0) {
    throw new Error("筆記內容不能為空。");
  }

  if (length > MAX_NOTE_LENGTH) {
    throw new Error(`筆記內容不能超過 ${MAX_NOTE_LENGTH} 個字元。`);
  }

  return content;
}

export function createApp(initialNotes = []) {
  const notes = [...initialNotes];
  const app = express();

  app.use(express.json({ limit: "16kb" }));

  app.get("/api/notes", (_request, response) => {
    response.json(notes);
  });

  app.post("/api/notes", (request, response) => {
    try {
      const content = validateNote(request.body?.content);
      notes.push(content);
      response.status(201).json({ content });
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "找不到 API 路由。" });
  });

  app.use(express.static(staticDirectory));

  app.use((error, _request, response, next) => {
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "JSON 格式錯誤。" });
      return;
    }

    next(error);
  });

  return app;
}

export const app = createApp();

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "127.0.0.1";

  app.listen(port, host, () => {
    console.log(`Note App running at http://${host}:${port}`);
  });
}
