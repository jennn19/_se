import { describe, expect, it } from "vitest";
import { MAX_NOTE_LENGTH, validateNote } from "../server.js";

describe("validateNote", () => {
  it("接受去除前後空白後長度為 1 到 50 字的內容", () => {
    expect(validateNote("  買牛奶與雞蛋  ")).toBe("買牛奶與雞蛋");
  });

  it("空字串驗證失敗", () => {
    expect(() => validateNote("")).toThrow("筆記內容不能為空。");
  });

  it("只有空白的內容驗證失敗", () => {
    expect(() => validateNote("   \t\n")).toThrow("筆記內容不能為空。");
  });

  it("超過 50 字驗證失敗", () => {
    const content = "字".repeat(MAX_NOTE_LENGTH + 1);

    expect(() => validateNote(content)).toThrow(
      `筆記內容不能超過 ${MAX_NOTE_LENGTH} 個字元。`,
    );
  });

  it("剛好 50 字驗證成功", () => {
    const content = "字".repeat(MAX_NOTE_LENGTH);

    expect(validateNote(content)).toBe(content);
  });
});
