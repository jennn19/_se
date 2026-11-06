const MODEL = "@cf/zai-org/glm-4.7-flash";

const SYSTEM_PROMPT = `你是一位不浪費食物的創意五星級大廚，擅長把冰箱裡零碎的剩餘食材，變成簡單、美味、20 分鐘內能完成的家常料理。

請遵守以下規則：
1. 優先使用使用者提供的食材；最多只能額外補充 5 樣常見廚房常備品（例如油、鹽、醬油、蒜、蛋），並放在 pantry 欄位。
2. 設計 1 到 2 道料理，每一道都必須能在 20 分鐘內完成。
3. 份量與調味要符合使用者提供的人數。
4. 步驟要具體、可操作，包含火候與時間。
5. 一律使用繁體中文（台灣用語），語氣親切、精簡。
6. 只輸出 JSON，不要 markdown code fence，不要任何 JSON 以外的文字。

JSON 格式必須完全符合以下結構：
{
  "chefNote": "一句話的剩食小提醒或鼓勵",
  "recipes": [
    {
      "name": "料理名稱",
      "description": "一句話介紹這道菜",
      "cookTime": "15 分鐘",
      "servings": "2 人份",
      "difficulty": "簡單",
      "ingredients": ["食材與份量", "食材與份量"],
      "pantry": ["額外需要的常備調味料"],
      "steps": ["步驟一", "步驟二", "步驟三"],
      "tip": "主廚小撇步"
    }
  ]
}`;

const MAX_INGREDIENTS = 20;
const MAX_INGREDIENT_LENGTH = 30;
const MAX_NOTES_LENGTH = 200;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/recipes") {
      if (request.method !== "POST") {
        return json({ error: "請使用 POST 方法。" }, 405, { Allow: "POST" });
      }
      return handleRecipes(request, env);
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, model: MODEL, aiBound: Boolean(env.AI) });
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function handleRecipes(request, env) {
  if (!env.AI) {
    return json(
      {
        error: "Workers AI 尚未啟用。請確認 wrangler.jsonc 已設定 ai binding，並登入 Cloudflare 後再試。",
      },
      500
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "請求格式錯誤，請重新整理頁面再試。" }, 400);
  }

  const ingredients = normalizeIngredients(body?.ingredients);
  if (ingredients.length === 0) {
    return json({ error: "請至少輸入一樣冰箱裡的食材。" }, 400);
  }

  const servings = clampInteger(body?.servings, 1, 8, 2);
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, MAX_NOTES_LENGTH) : "";

  const userPrompt = [
    `我冰箱裡有以下食材：${ingredients.join("、")}。`,
    `用餐人數：${servings} 人。`,
    `其他需求或限制：${notes || "沒有特別限制"}。`,
    "請依照規則設計 1 到 2 道 20 分鐘內能完成的晚餐，並只回傳指定的 JSON 格式。",
  ].join("\n");

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 1800,
      temperature: 0.7,
      chat_template_kwargs: { enable_thinking: false },
      response_format: { type: "json_object" },
    });

    const text = extractText(result);
    if (!text) {
      return json({ error: "大廚這次沒有靈感，請再試一次。" }, 502);
    }

    const parsed = parseRecipeJson(text);
    return json(
      {
        ok: true,
        model: MODEL,
        data: parsed.data,
        raw: parsed.raw,
      },
      200,
      { "Cache-Control": "no-store" }
    );
  } catch (error) {
    return json(
      {
        error: "AI 產生食譜時發生錯誤，請稍後再試一次。",
        detail: error instanceof Error ? error.message : String(error),
      },
      502
    );
  }
}

function extractText(result) {
  if (!result) return "";

  if (typeof result.response === "string") {
    return result.response.trim();
  }

  const choice = Array.isArray(result.choices) ? result.choices[0] : null;
  if (choice) {
    const content = choice.message?.content;
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((part) => (typeof part === "string" ? part : part?.text || ""))
        .join("")
        .trim();
    }
    if (typeof choice.text === "string") return choice.text.trim();
  }

  if (typeof result.output_text === "string") {
    return result.output_text.trim();
  }

  return "";
}

function normalizeIngredients(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const cleaned = item.replace(/\s+/g, " ").trim().slice(0, MAX_INGREDIENT_LENGTH);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= MAX_INGREDIENTS) break;
  }
  return result;
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function parseRecipeJson(text) {
  const candidates = [];
  const trimmed = text.trim();
  candidates.push(trimmed);

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (withoutFence !== trimmed) candidates.push(withoutFence);

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    candidates.push(trimmed.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && Array.isArray(parsed.recipes) && parsed.recipes.length > 0) {
        return { data: parsed, raw: text };
      }
    } catch {
      // 換下一種擷取方式
    }
  }

  return { data: null, raw: text };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
