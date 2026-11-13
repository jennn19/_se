const QUICK_INGREDIENTS = [
  "雞蛋",
  "高麗菜",
  "紅蘿蔔",
  "洋蔥",
  "番茄",
  "豆腐",
  "雞胸肉",
  "白飯",
  "青蔥",
  "馬鈴薯",
  "菇類",
  "起司",
];

const MAX_INGREDIENTS = 20;
const MAX_INGREDIENT_LENGTH = 30;
const STORAGE_KEY = "fridge-recipe-master:v1";

const ICON_COPY = `
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="7" y="7" width="9" height="10" rx="2" stroke="currentColor" stroke-width="1.6" />
    <path d="M5 13H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 2h8A1.5 1.5 0 0 1 13.5 3.5V4" stroke="currentColor" stroke-width="1.6" />
  </svg>`;

const ICON_CLOCK = `
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.6" />
    <path d="M10 6.2V10l2.6 1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;

const ICON_USERS = `
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="8" cy="7" r="2.6" stroke="currentColor" stroke-width="1.6" />
    <path d="M3.5 16c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    <path d="M13.2 5.1a2.4 2.4 0 0 1 0 4.5M14 11.9c1.7.5 2.8 1.9 2.8 4.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
  </svg>`;

const ICON_CHEF = `
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M6.2 8.4a2.6 2.6 0 1 1 .6-5.1 3.2 3.2 0 0 1 6.4 0 2.6 2.6 0 1 1 .6 5.1v5.1H6.2V8.4Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M6.2 16.4h7.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  </svg>`;

const els = {
  form: document.getElementById("recipe-form"),
  input: document.getElementById("ingredient-input"),
  chips: document.getElementById("chips"),
  quickList: document.getElementById("quick-list"),
  servings: document.getElementById("servings"),
  notes: document.getElementById("notes"),
  generate: document.getElementById("generate"),
  result: document.getElementById("result"),
  resultSub: document.getElementById("result-sub"),
  resultActions: document.getElementById("result-actions"),
  copyAll: document.getElementById("copy-all"),
  retry: document.getElementById("retry"),
  inlineError: document.getElementById("inline-error"),
  toast: document.getElementById("toast"),
};

const state = {
  ingredients: [],
  servings: 2,
  loading: false,
  recipes: [],
  result: null,
  raw: "",
};

let loadingTimer = null;
let toastTimer = null;

init();

function init() {
  restoreState();
  renderChips();
  renderQuickList();
  renderServings();

  els.input.addEventListener("keydown", onInputKeydown);
  els.input.addEventListener("input", hideInlineError);
  els.chips.addEventListener("click", onChipClick);
  els.quickList.addEventListener("click", onQuickClick);
  els.form.addEventListener("submit", onSubmit);

  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", onStep);
  });

  els.notes.addEventListener("input", saveState);
  els.copyAll.addEventListener("click", () => copyText(buildAllText()));
  els.retry.addEventListener("click", generate);
  els.result.addEventListener("click", onResultClick);

  if (state.ingredients.length > 0) {
    els.resultSub.textContent = "上次的食材幫你留著了，按「開始規劃晚餐」就能再想菜色。";
  }
}

/* ---------------- 食材輸入 ---------------- */

function onInputKeydown(event) {
  if (event.isComposing) return;

  if (event.key === "Enter") {
    event.preventDefault();
    const value = els.input.value;
    if (value.trim()) {
      addIngredients(value);
      els.input.value = "";
    } else if (state.ingredients.length > 0) {
      els.form.requestSubmit();
    }
    return;
  }

  if (event.key === "," || event.key === "，" || event.key === "、") {
    if (els.input.value.trim()) {
      event.preventDefault();
      addIngredients(els.input.value);
      els.input.value = "";
    }
    return;
  }

  if (event.key === "Backspace" && els.input.value === "" && state.ingredients.length > 0) {
    state.ingredients.pop();
    renderChips();
    syncQuickState();
    saveState();
  }
}

function addIngredients(raw) {
  if (state.ingredients.length >= MAX_INGREDIENTS) {
    toast(`最多 ${MAX_INGREDIENTS} 樣食材，先幫冰箱留點空間吧。`);
    return;
  }

  const parts = String(raw).split(/[,，、;；\n]+/);
  let added = false;

  for (const part of parts) {
    const cleaned = part.replace(/\s+/g, " ").trim().slice(0, MAX_INGREDIENT_LENGTH);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (state.ingredients.some((item) => item.toLowerCase() === key)) continue;
    if (state.ingredients.length >= MAX_INGREDIENTS) break;

    state.ingredients.push(cleaned);
    added = true;
  }

  if (added) {
    hideInlineError();
    renderChips();
    syncQuickState();
    saveState();
  }
}

function renderChips() {
  els.chips.replaceChildren();

  state.ingredients.forEach((name, index) => {
    const chip = el("li", "chip");
    chip.append(document.createTextNode(name));

    const remove = el("button", null, "×");
    remove.type = "button";
    remove.dataset.remove = String(index);
    remove.setAttribute("aria-label", `移除 ${name}`);
    chip.append(remove);

    els.chips.append(chip);
  });

  els.input.placeholder =
    state.ingredients.length > 0
      ? "再加一樣食材…"
      : "例如：高麗菜、紅蘿蔔、剩半塊豆腐";
}

function onChipClick(event) {
  const button = event.target.closest("[data-remove]");
  if (!button) return;

  const index = Number(button.dataset.remove);
  if (!Number.isInteger(index)) return;

  state.ingredients.splice(index, 1);
  renderChips();
  syncQuickState();
  saveState();
  els.input.focus();
}

function renderQuickList() {
  els.quickList.replaceChildren();

  for (const name of QUICK_INGREDIENTS) {
    const button = el("button", null, name);
    button.type = "button";
    button.dataset.name = name;
    els.quickList.append(button);
  }

  syncQuickState();
}

function syncQuickState() {
  const keys = new Set(state.ingredients.map((item) => item.toLowerCase()));

  els.quickList.querySelectorAll("button").forEach((button) => {
    const added = keys.has(button.dataset.name.toLowerCase());
    button.classList.toggle("is-added", added);
    button.disabled = added;
  });
}

function onQuickClick(event) {
  const button = event.target.closest("button[data-name]");
  if (!button) return;

  addIngredients(button.dataset.name);
  els.input.focus();
}

/* ---------------- 人數 ---------------- */

function onStep(event) {
  const delta = Number(event.currentTarget.dataset.step);
  if (!Number.isFinite(delta)) return;

  state.servings = Math.min(8, Math.max(1, state.servings + delta));
  renderServings();
  saveState();
}

function renderServings() {
  els.servings.textContent = String(state.servings);
  const minus = document.querySelector('[data-step="-1"]');
  const plus = document.querySelector('[data-step="1"]');
  if (minus) minus.disabled = state.servings <= 1;
  if (plus) plus.disabled = state.servings >= 8;
}

/* ---------------- 產生食譜 ---------------- */

async function onSubmit(event) {
  event.preventDefault();

  const typed = els.input.value.trim();
  if (typed) {
    addIngredients(typed);
    els.input.value = "";
  }

  if (state.ingredients.length === 0) {
    showInlineError("請先加入至少一樣冰箱裡的食材。");
    els.input.focus();
    return;
  }

  await generate();
}

async function generate() {
  if (state.loading) return;

  if (state.ingredients.length === 0) {
    showInlineError("請先加入至少一樣冰箱裡的食材。");
    els.input.focus();
    return;
  }

  hideInlineError();
  setLoading(true);
  showLoadingState();

  try {
    const response = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredients: state.ingredients,
        servings: state.servings,
        notes: els.notes.value.trim(),
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload || payload.ok !== true) {
      throw new Error(payload?.error || "伺服器暫時無法使用，請稍後再試一次。");
    }

    state.result = payload.data || null;
    state.raw = typeof payload.raw === "string" ? payload.raw : "";

    if (state.result) {
      renderRecipes(state.result);
      els.resultSub.textContent = "大廚幫你配好了，趁熱開動。";
    } else {
      state.recipes = [];
      renderRaw(state.raw);
      els.resultSub.textContent = "大廚的回覆格式有點調皮，先顯示原始內容。";
    }

    els.resultActions.hidden = false;
    els.copyAll.hidden = !state.result;

    if (window.matchMedia("(max-width: 980px)").matches) {
      requestAnimationFrame(() => {
        document.querySelector(".result-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  } catch (error) {
    state.result = null;
    state.recipes = [];
    state.raw = "";
    renderError(error instanceof Error ? error.message : String(error));
    els.resultActions.hidden = true;
    els.resultSub.textContent = "這次沒能生出菜單。";
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  state.loading = loading;
  els.generate.disabled = loading;
  els.generate.classList.toggle("is-loading", loading);
  const label = els.generate.querySelector(".primary-label");
  if (label) label.textContent = loading ? "大廚翻冰箱中…" : "開始規劃晚餐";
  if (!loading) stopLoadingMessages();
}

function showLoadingState() {
  els.resultActions.hidden = true;
  els.resultSub.textContent = "大廚正在翻冰箱、試味道…";
  els.result.innerHTML = `
    <p class="loading-status" id="loading-status">翻找冰箱裡的剩料…</p>
    <div class="skeleton-card">
      <div class="skeleton-line" style="width: 52%"></div>
      <div class="skeleton-line" style="width: 34%"></div>
      <div class="skeleton-line" style="width: 92%"></div>
      <div class="skeleton-line" style="width: 78%"></div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-line" style="width: 46%"></div>
      <div class="skeleton-line" style="width: 86%"></div>
      <div class="skeleton-line" style="width: 68%"></div>
    </div>
  `;

  const status = els.result.querySelector("#loading-status");
  const messages = ["翻找冰箱裡的剩料…", "挑選最適合的組合…", "調整火候與時間…", "擺盤，準備上菜…"];
  let index = 0;

  stopLoadingMessages();
  loadingTimer = window.setInterval(() => {
    if (!status || !status.isConnected) {
      stopLoadingMessages();
      return;
    }
    index = (index + 1) % messages.length;
    status.textContent = messages[index];
  }, 1400);
}

function stopLoadingMessages() {
  if (loadingTimer !== null) {
    window.clearInterval(loadingTimer);
    loadingTimer = null;
  }
}

/* ---------------- 結果呈現 ---------------- */

function renderRecipes(data) {
  const recipes = Array.isArray(data.recipes)
    ? data.recipes.filter((recipe) => recipe && typeof recipe === "object")
    : [];

  if (recipes.length === 0) {
    state.recipes = [];
    renderRaw(state.raw);
    return;
  }

  state.recipes = recipes.slice(0, 2);
  els.result.replaceChildren();

  if (typeof data.chefNote === "string" && data.chefNote.trim()) {
    const note = el("p", "raw-notice");
    note.textContent = `主廚悄悄話 · ${clip(data.chefNote, 200)}`;
    els.result.append(note);
  }

  state.recipes.forEach((recipe, index) => {
    els.result.append(buildRecipeCard(recipe, index));
  });
}

function buildRecipeCard(recipe, index) {
  const card = el("article", "recipe-card");
  card.style.animationDelay = `${index * 90}ms`;

  const head = el("div", "recipe-head");
  const headText = el("div");
  headText.append(el("span", "recipe-index", `RECIPE ${index + 1}`));
  headText.append(el("h3", null, clip(recipe.name, 120) || "大廚私房料理"));

  if (recipe.description) {
    headText.append(el("p", "recipe-desc", clip(recipe.description, 300)));
  }

  const copyButton = el("button", "icon-btn");
  copyButton.type = "button";
  copyButton.dataset.copy = String(index);
  copyButton.setAttribute("aria-label", "複製這道食譜");
  copyButton.innerHTML = ICON_COPY;

  head.append(headText, copyButton);
  card.append(head);

  const meta = el("div", "meta");
  addMeta(meta, ICON_CLOCK, clip(recipe.cookTime, 40) || "20 分鐘內");
  addMeta(meta, ICON_USERS, clip(recipe.servings, 40) || `${state.servings} 人份`);
  if (recipe.difficulty) addMeta(meta, ICON_CHEF, clip(recipe.difficulty, 40));
  card.append(meta);

  const body = el("div", "recipe-body");

  const ingredientsBlock = el("div");
  ingredientsBlock.append(el("h4", null, "食材"));
  ingredientsBlock.append(buildList("ingredient-list", toStringArray(recipe.ingredients)));

  const pantry = toStringArray(recipe.pantry);
  if (pantry.length > 0) {
    ingredientsBlock.append(el("h4", null, "常備調味"));
    ingredientsBlock.append(buildList("pantry-list", pantry));
  }

  const stepsBlock = el("div");
  stepsBlock.append(el("h4", null, "做法"));
  const steps = el("ol", "steps");
  for (const step of toStringArray(recipe.steps)) {
    steps.append(el("li", null, step));
  }
  stepsBlock.append(steps);

  body.append(ingredientsBlock, stepsBlock);
  card.append(body);

  if (recipe.tip) {
    const tip = el("p", "tip");
    tip.append(el("span", null, "主廚小撇步"));
    tip.append(document.createTextNode(clip(recipe.tip, 400)));
    card.append(tip);
  }

  return card;
}

function buildList(className, items) {
  const list = el("ul", className);
  for (const item of items) {
    list.append(el("li", null, item));
  }
  return list;
}

function addMeta(container, icon, text) {
  const item = el("span", "meta-item");
  item.insertAdjacentHTML("afterbegin", icon);
  item.append(document.createTextNode(text));
  container.append(item);
}

function renderRaw(raw) {
  els.result.replaceChildren();

  const notice = el(
    "p",
    "raw-notice",
    "大廚這次沒有照格式回答，先顯示原始內容。你可以按「再想一道」重新試試。"
  );

  const output = el("div", "raw-output");
  output.textContent =
    typeof raw === "string" && raw.trim() ? raw.trim() : "目前沒有收到內容，請再試一次。";

  els.result.append(notice, output);
}

function renderError(message) {
  els.result.replaceChildren();

  const card = el("div", "error-card");
  card.append(el("h3", null, "廚房暫時出了點狀況"));
  card.append(el("p", null, message || "請稍後再試一次。"));

  const retry = el("button", null, "再試一次");
  retry.type = "button";
  retry.addEventListener("click", generate);
  card.append(retry);

  els.result.append(card);
}

function onResultClick(event) {
  const button = event.target.closest("[data-copy]");
  if (!button) return;

  const index = Number(button.dataset.copy);
  const recipe = state.recipes[index];
  if (!recipe) return;

  copyText(buildRecipeText(recipe));
}

/* ---------------- 複製 ---------------- */

function buildRecipeText(recipe) {
  const lines = [];

  lines.push(clip(recipe.name, 120) || "大廚私房料理");
  if (recipe.description) lines.push(clip(recipe.description, 300));
  lines.push("");
  lines.push(
    `時間：${clip(recipe.cookTime, 40) || "20 分鐘內"}　份量：${
      clip(recipe.servings, 40) || `${state.servings} 人份`
    }`
  );
  lines.push("");

  const ingredients = toStringArray(recipe.ingredients);
  if (ingredients.length > 0) {
    lines.push("【食材】");
    ingredients.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  const pantry = toStringArray(recipe.pantry);
  if (pantry.length > 0) {
    lines.push("【常備調味】");
    pantry.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }

  const steps = toStringArray(recipe.steps);
  if (steps.length > 0) {
    lines.push("【做法】");
    steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
    lines.push("");
  }

  if (recipe.tip) {
    lines.push(`主廚小撇步：${clip(recipe.tip, 400)}`);
  }

  return lines.join("\n").trim();
}

function buildAllText() {
  if (!state.result || state.recipes.length === 0) return "";

  const header = [
    "冰箱剩食食譜大師",
    `使用食材：${state.ingredients.join("、")}`,
    `用餐人數：${state.servings} 人`,
  ].join("\n");

  const body = state.recipes.map((recipe) => buildRecipeText(recipe)).join("\n\n────────\n\n");
  return `${header}\n\n${body}`;
}

async function copyText(text) {
  if (!text) {
    toast("目前沒有可以複製的食譜。");
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-1000px";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("copy failed");
    }
    toast("已複製食譜");
  } catch {
    toast("複製失敗，請手動選取文字。");
  }
}

/* ---------------- 儲存 / 工具 ---------------- */

function saveState() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ingredients: state.ingredients,
        servings: state.servings,
        notes: els.notes.value,
      })
    );
  } catch {
    // 無痕模式或空間不足時忽略
  }
}

function restoreState() {
  let stored;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    stored = JSON.parse(raw);
  } catch {
    return;
  }

  if (Array.isArray(stored.ingredients)) {
    const seen = new Set();
    for (const item of stored.ingredients) {
      if (typeof item !== "string") continue;
      const cleaned = item.replace(/\s+/g, " ").trim().slice(0, MAX_INGREDIENT_LENGTH);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      state.ingredients.push(cleaned);
      if (state.ingredients.length >= MAX_INGREDIENTS) break;
    }
  }

  if (Number.isFinite(stored.servings)) {
    state.servings = Math.min(8, Math.max(1, Math.round(stored.servings)));
  }

  if (typeof stored.notes === "string") {
    els.notes.value = stored.notes.slice(0, 200);
  }
}

function toStringArray(value) {
  let items = value;

  if (typeof value === "string") {
    items = value
      .split(/\n|；|;/)
      .map((item) => item.replace(/^\s*[-*•\d.、)]+\s*/, ""))
      .filter(Boolean);
  }

  if (!Array.isArray(items)) return [];

  return items
    .map((item) => (typeof item === "number" ? String(item) : item))
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.replace(/\s+/g, " ").trim().slice(0, 800))
    .slice(0, 20);
}

function clip(value, max) {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function showInlineError(message) {
  els.inlineError.textContent = message;
  els.inlineError.hidden = false;
}

function hideInlineError() {
  els.inlineError.hidden = true;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
