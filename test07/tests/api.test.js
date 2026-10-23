import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../server.js";

describe("POST /api/notes", () => {
  it("帶入正確 JSON 時回傳 201 Created", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/notes")
      .set("Accept", "application/json")
      .send({ content: "  買牛奶與雞蛋  " });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ content: "買牛奶與雞蛋" });
  });

  it("新增後的筆記可透過 GET /api/notes 取得", async () => {
    const app = createApp();

    await request(app)
      .post("/api/notes")
      .send({ content: "閱讀一章書" })
      .expect(201);

    const response = await request(app).get("/api/notes").expect(200);

    expect(response.body).toEqual(["閱讀一章書"]);
  });

  it("內容超過 50 字時回傳 400 Bad Request", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/notes")
      .send({ content: "字".repeat(51) });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "筆記內容不能超過 50 個字元。",
    });
  });
});
