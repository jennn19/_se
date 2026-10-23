import { expect, test } from "@playwright/test";

test("使用者可以新增筆記並在列表中看到內容", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "微光筆記" })).toBeVisible();

  const content = `今天要記得喝水 ${Date.now()}`;
  const input = page.getByTestId("note-input");

  await input.fill(content);
  await page.getByTestId("note-submit").click();

  const note = page.getByTestId("note-item").filter({ hasText: content });

  await expect(note).toBeVisible();
  await expect(note).toContainText(content);
  await expect(note).toHaveClass(/rounded-xl/);
  await expect(note).toHaveClass(/shadow-sm/);
  await expect(input).toHaveValue("");
  await expect(page.getByTestId("empty-state")).toBeHidden();
});
