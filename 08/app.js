(function () {
  "use strict";

  const STORE_KEY = "taskflow:data:v2";
  const THEMES = ["auto", "light", "dark"];
  const REPEATS = { none: "", daily: "每天", weekly: "每週", monthly: "每月" };
  const LIST_COLORS = ["#2f6f4f", "#3f6fb0", "#b5793f", "#8a5bb0", "#b05270", "#4f8c8c"];
  const DAY_MS = 86400000;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const pad = (value) => String(value).padStart(2, "0");
  const isoDate = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const today = () => isoDate();
  const parseISO = (value) => {
    const parts = String(value).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };
  const isDateString = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const date = parseISO(value);
    return !Number.isNaN(date.getTime()) && isoDate(date) === value;
  };
  const addDays = (value, amount) => {
    const date = parseISO(value);
    date.setDate(date.getDate() + amount);
    return isoDate(date);
  };
  const addMonths = (value, amount) => {
    const date = parseISO(value);
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, maxDay));
    return isoDate(date);
  };
  const localDateOf = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : isoDate(date);
  };
  const fmtLong = (value) =>
    new Intl.DateTimeFormat("zh-Hant", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(parseISO(value));
  const fmtShort = (value) =>
    new Intl.DateTimeFormat("zh-Hant", { month: "numeric", day: "numeric", weekday: "short" }).format(parseISO(value));
  const fmtMonthDay = (value) => {
    const date = parseISO(value);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };
  const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const truncate = (text, max = 18) => (text.length > max ? `${text.slice(0, max)}…` : text);

  const el = {
    sidebar: $("#sidebar"),
    backdrop: $("#backdrop"),
    menuBtn: $("#menu-btn"),
    newTask: $("#new-task"),
    addList: $("#add-list"),
    lists: $("#lists"),
    navItems: $$(".nav-item[data-view]"),
    exportBtn: $("#export-btn"),
    importBtn: $("#import-btn"),
    themeBtn: $("#theme-btn"),
    viewTitle: $("#view-title"),
    viewSubtitle: $("#view-subtitle"),
    search: $("#search"),
    sort: $("#sort"),
    statToday: $("#stat-today"),
    statTodaySub: $("#stat-today-sub"),
    statOpen: $("#stat-open"),
    statOpenSub: $("#stat-open-sub"),
    statRate: $("#stat-rate"),
    statRateSub: $("#stat-rate-sub"),
    statStreak: $("#stat-streak"),
    statStreakSub: $("#stat-streak-sub"),
    chart: $("#chart"),
    chartTotal: $("#chart-total"),
    statusFilter: $("#status-filter"),
    priorityFilter: $("#priority-filter"),
    tagFilter: $("#tag-filter"),
    clearDone: $("#clear-done"),
    quickAdd: $("#quick-add"),
    quickInput: $("#quick-input"),
    detailedAdd: $("#detailed-add"),
    taskList: $("#task-list"),
    empty: $("#empty"),
    hint: $("#hint"),
    taskDialog: $("#task-dialog"),
    taskForm: $("#task-form"),
    taskDialogTitle: $("#task-dialog-title"),
    fTitle: $("#f-title"),
    fList: $("#f-list"),
    fPriority: $("#f-priority"),
    fDue: $("#f-due"),
    fRepeat: $("#f-repeat"),
    fTags: $("#f-tags"),
    fNotes: $("#f-notes"),
    fDelete: $("#f-delete"),
    subtaskEditor: $("#subtask-editor"),
    fSubtask: $("#f-subtask"),
    fSubtaskAdd: $("#f-subtask-add"),
    listDialog: $("#list-dialog"),
    listForm: $("#list-form"),
    listDialogTitle: $("#list-dialog-title"),
    lName: $("#l-name"),
    toast: $("#toast"),
    toastMsg: $("#toast-msg"),
    toastAction: $("#toast-action"),
    importFile: $("#import-file")
  };

  let state = loadState();
  let view = "today";
  let statusFilter = "all";
  let priorityFilter = "all";
  let tagFilter = "all";
  let searchTerm = "";
  let sortMode = "custom";
  let editingId = null;
  let editingListId = null;
  let draftSubtasks = [];
  let dragId = null;
  let undoState = null;
  let toastTimer = null;
  let activeDay = today();

  function defaultState() {
    return {
      version: 2,
      lists: [
        { id: "inbox", name: "收件匣", color: "#2f6f4f" },
        { id: "work", name: "工作", color: "#3f6fb0" },
        { id: "life", name: "生活", color: "#b5793f" }
      ],
      tasks: [],
      settings: { theme: "auto", lastList: "inbox" }
    };
  }

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== "object") return base;

    let lists = Array.isArray(raw.lists)
      ? raw.lists
          .filter((list) => list && typeof list.id === "string" && typeof list.name === "string")
          .map((list) => ({
            id: list.id,
            name: list.name.slice(0, 40),
            color: typeof list.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(list.color) ? list.color : "#2f6f4f"
          }))
      : base.lists;
    const seenListIds = new Set();
    lists = lists.filter((list) => {
      if (seenListIds.has(list.id)) return false;
      seenListIds.add(list.id);
      return true;
    });
    if (!lists.length) lists = base.lists;

    const listIds = new Set(lists.map((list) => list.id));
    let tasks = Array.isArray(raw.tasks)
      ? raw.tasks
          .filter((task) => task && typeof task.title === "string" && task.title.trim())
          .map((task) => ({
            id: typeof task.id === "string" ? task.id : uid("t"),
            listId: listIds.has(task.listId) ? task.listId : lists[0].id,
            title: task.title.slice(0, 200),
            notes: typeof task.notes === "string" ? task.notes : "",
            priority: [1, 2, 3].includes(task.priority) ? task.priority : 2,
            due: isDateString(task.due) ? task.due : null,
            tags: Array.isArray(task.tags)
              ? Array.from(new Set(task.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))).slice(0, 10)
              : [],
            subtasks: Array.isArray(task.subtasks)
              ? task.subtasks
                  .filter((subtask) => subtask && typeof subtask.title === "string")
                  .map((subtask) => ({
                    id: typeof subtask.id === "string" ? subtask.id : uid("s"),
                    title: subtask.title.slice(0, 200),
                    done: Boolean(subtask.done)
                  }))
              : [],
            done: Boolean(task.done),
            createdAt: typeof task.createdAt === "string" ? task.createdAt : new Date().toISOString(),
            completedAt: task.done && typeof task.completedAt === "string" ? task.completedAt : null,
            repeat: ["daily", "weekly", "monthly"].includes(task.repeat) ? task.repeat : "none",
            recurOf: typeof task.recurOf === "string" ? task.recurOf : null
          }))
      : [];
    const seenTaskIds = new Set();
    tasks = tasks.filter((task) => {
      if (seenTaskIds.has(task.id)) return false;
      seenTaskIds.add(task.id);
      return true;
    });

    const settings = Object.assign({}, base.settings);
    if (raw.settings && typeof raw.settings === "object") {
      if (THEMES.includes(raw.settings.theme)) settings.theme = raw.settings.theme;
      if (listIds.has(raw.settings.lastList)) settings.lastList = raw.settings.lastList;
    }

    return { version: 2, lists, tasks, settings };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return normalizeState(JSON.parse(raw));
    } catch (error) {
      console.warn("讀取資料失敗", error);
    }
    const fresh = defaultState();
    migrateFrom03(fresh);
    return fresh;
  }

  function migrateFrom03(fresh) {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith("todos:")) keys.push(key);
    }
    let imported = 0;
    for (const key of keys) {
      const date = key.slice(6);
      if (!isDateString(date)) continue;
      let items;
      try {
        items = JSON.parse(localStorage.getItem(key) || "[]");
      } catch (error) {
        continue;
      }
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || typeof item.text !== "string" || !item.text.trim()) continue;
        fresh.tasks.push({
          id: uid("t"),
          listId: "inbox",
          title: item.text.trim().slice(0, 200),
          notes: "",
          priority: 2,
          due: date,
          tags: [],
          subtasks: [],
          done: Boolean(item.done),
          createdAt: `${date}T08:00:00`,
          completedAt: item.done ? `${date}T12:00:00` : null,
          repeat: "none",
          recurOf: null
        });
        imported += 1;
      }
    }
    if (imported) console.info(`已從「今日待辦」匯入 ${imported} 項任務`);
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast("儲存失敗，瀏覽器空間可能已滿");
    }
  }

  function tasksForView(name) {
    const current = today();
    if (name === "today") {
      return state.tasks.filter((task) => task.due === current || (!task.done && task.due && task.due < current));
    }
    if (name === "upcoming") {
      const end = addDays(current, 7);
      return state.tasks.filter((task) => task.due && task.due > current && task.due <= end);
    }
    if (name === "all") return state.tasks.slice();
    if (name === "completed") return state.tasks.filter((task) => task.done);
    if (name.startsWith("list:")) {
      const id = name.slice(5);
      return state.tasks.filter((task) => task.listId === id);
    }
    return state.tasks.slice();
  }

  function countForView(name) {
    const tasks = tasksForView(name);
    return name === "completed" ? tasks.length : tasks.filter((task) => !task.done).length;
  }

  function listCount(listId) {
    return state.tasks.filter((task) => task.listId === listId && !task.done).length;
  }

  function filteredTasks() {
    const search = searchTerm.toLowerCase();
    let tasks = searchTerm ? state.tasks.slice() : tasksForView(view);

    if (statusFilter === "active") tasks = tasks.filter((task) => !task.done);
    if (statusFilter === "done") tasks = tasks.filter((task) => task.done);
    if (priorityFilter !== "all") tasks = tasks.filter((task) => task.priority === Number(priorityFilter));
    if (tagFilter !== "all") tasks = tasks.filter((task) => task.tags.includes(tagFilter));
    if (search) {
      tasks = tasks.filter((task) => {
        const haystack = [task.title, task.notes, ...task.tags, ...task.subtasks.map((subtask) => subtask.title)].join(" ").toLowerCase();
        return haystack.includes(search);
      });
    }

    const sorted = tasks.slice();
    if (sortMode === "due") {
      sorted.sort((a, b) => (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31") || b.priority - a.priority);
    } else if (sortMode === "priority") {
      sorted.sort((a, b) => b.priority - a.priority || (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31"));
    } else if (sortMode === "created") {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      const order = new Map(state.tasks.map((task, index) => [task.id, index]));
      sorted.sort((a, b) => order.get(a.id) - order.get(b.id));
    }
    return sorted;
  }

  function allTags() {
    const tags = new Set();
    for (const task of state.tasks) for (const tag of task.tags) tags.add(tag);
    return Array.from(tags).sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }

  function currentListId() {
    if (view.startsWith("list:")) {
      const id = view.slice(5);
      if (state.lists.some((list) => list.id === id)) return id;
    }
    if (state.lists.some((list) => list.id === state.settings.lastList)) return state.settings.lastList;
    return state.lists[0].id;
  }

  function defaultDue() {
    if (view === "today") return today();
    if (view === "upcoming") return addDays(today(), 1);
    return "";
  }

  function completionDates() {
    const dates = new Set();
    for (const task of state.tasks) {
      const date = task.completedAt ? localDateOf(task.completedAt) : null;
      if (date) dates.add(date);
    }
    return dates;
  }

  function streak() {
    const dates = completionDates();
    let cursor = today();
    if (!dates.has(cursor)) cursor = addDays(cursor, -1);
    let count = 0;
    while (dates.has(cursor) && count < 3650) {
      count += 1;
      cursor = addDays(cursor, -1);
    }
    return count;
  }

  function applyTheme() {
    const theme = state.settings.theme;
    if (theme === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = theme;
    }
    const labels = { auto: "主題：自動", light: "主題：淺色", dark: "主題：深色" };
    el.themeBtn.textContent = labels[theme] || labels.auto;
  }

  function updateStatusButtons() {
    for (const button of el.statusFilter.querySelectorAll("button[data-status]")) {
      button.classList.toggle("active", button.dataset.status === statusFilter);
    }
  }

  function renderAll() {
    if (!state.lists.some((list) => list.id === state.settings.lastList)) {
      state.settings.lastList = state.lists[0].id;
    }
    applyTheme();
    renderSidebar();
    renderDashboard();
    renderTagOptions();
    renderTasks();
  }

  function renderSidebar() {
    for (const button of el.navItems) {
      const name = button.dataset.view;
      button.classList.toggle("active", view === name);
      const count = button.querySelector(".count");
      const value = countForView(name);
      count.textContent = value ? String(value) : "";
    }

    el.lists.textContent = "";
    for (const list of state.lists) {
      const row = document.createElement("div");
      row.className = `list-row${view === `list:${list.id}` ? " active" : ""}`;

      const select = document.createElement("button");
      select.type = "button";
      select.className = "list-select";
      select.dataset.listId = list.id;

      const dot = document.createElement("span");
      dot.className = "list-dot";
      dot.style.background = list.color;

      const name = document.createElement("span");
      name.className = "list-name";
      name.textContent = list.name;

      const count = document.createElement("span");
      count.className = "count";
      const value = listCount(list.id);
      count.textContent = value ? String(value) : "";

      select.append(dot, name, count);
      select.addEventListener("click", () => setView(`list:${list.id}`));

      const actions = document.createElement("div");
      actions.className = "list-actions";

      const rename = document.createElement("button");
      rename.type = "button";
      rename.className = "icon-btn";
      rename.title = "重新命名專案";
      rename.setAttribute("aria-label", `重新命名 ${list.name}`);
      rename.textContent = "✎";
      rename.addEventListener("click", (event) => {
        event.stopPropagation();
        openListDialog(list);
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-btn";
      remove.title = "刪除專案";
      remove.setAttribute("aria-label", `刪除 ${list.name}`);
      remove.textContent = "✕";
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteList(list);
      });

      actions.append(rename, remove);
      row.append(select, actions);
      el.lists.append(row);
    }
  }

  function renderDashboard() {
    const current = today();
    const todaysDone = state.tasks.filter((task) => task.done && task.completedAt && localDateOf(task.completedAt) === current).length;
    const dueToday = state.tasks.filter((task) => !task.done && task.due === current).length;
    const active = state.tasks.filter((task) => !task.done);
    const overdue = active.filter((task) => task.due && task.due < current).length;
    const total = state.tasks.length;
    const done = state.tasks.filter((task) => task.done).length;

    el.statToday.textContent = String(todaysDone);
    el.statTodaySub.textContent = `今日到期 ${dueToday} 項`;
    el.statOpen.textContent = String(active.length);
    el.statOpenSub.textContent = overdue ? `其中 ${overdue} 項逾期` : "沒有逾期任務";
    el.statRate.textContent = total ? `${Math.round((done / total) * 100)}%` : "—";
    el.statRateSub.textContent = `共 ${total} 項任務`;

    const streakValue = streak();
    el.statStreak.textContent = `${streakValue} 天`;
    el.statStreakSub.textContent = streakValue ? "連續有完成任務" : "完成一項任務開始累積";

    renderChart();
  }

  function renderChart() {
    const current = today();
    const days = [];
    for (let index = 13; index >= 0; index -= 1) days.push(addDays(current, -index));
    const counts = days.map((day) => state.tasks.filter((task) => task.completedAt && localDateOf(task.completedAt) === day).length);
    const max = Math.max(1, ...counts);
    const total = counts.reduce((sum, value) => sum + value, 0);

    el.chartTotal.textContent = `合計 ${total} 項`;
    el.chart.textContent = "";

    days.forEach((day, index) => {
      const wrap = document.createElement("div");
      wrap.className = "bar-wrap";

      const track = document.createElement("div");
      track.className = "bar-track";

      const bar = document.createElement("div");
      bar.className = `bar${day === current ? " today" : ""}`;
      bar.style.height = `${Math.max(3, Math.round((counts[index] / max) * 86))}px`;
      bar.title = `${fmtShort(day)}：${counts[index]} 項完成`;
      if (counts[index]) {
        const number = document.createElement("span");
        number.className = "bar-count";
        number.textContent = String(counts[index]);
        bar.append(number);
      }

      const label = document.createElement("span");
      label.className = "bar-label";
      label.textContent = String(parseISO(day).getDate());

      track.append(bar);
      wrap.append(track, label);
      el.chart.append(wrap);
    });
  }

  function renderTagOptions() {
    const tags = allTags();
    if (tagFilter !== "all" && !tags.includes(tagFilter)) tagFilter = "all";
    el.tagFilter.textContent = "";
    el.tagFilter.append(new Option("所有標籤", "all"));
    for (const tag of tags) el.tagFilter.append(new Option(`#${tag}`, tag));
    el.tagFilter.value = tagFilter;
  }

  function renderTasks() {
    const tasks = filteredTasks();
    el.taskList.textContent = "";
    const fragment = document.createDocumentFragment();
    for (const task of tasks) fragment.append(buildTaskElement(task));
    el.taskList.append(fragment);
    renderEmpty(tasks.length);
    updateHeader();
  }

  function renderEmpty(count) {
    if (count > 0) {
      el.empty.hidden = true;
      el.empty.textContent = "";
      return;
    }
    el.empty.hidden = false;
    el.empty.textContent = "";

    const strong = document.createElement("strong");
    let message = "";
    if (searchTerm) {
      strong.textContent = "找不到符合的任務";
      message = "試試其他關鍵字，或清除搜尋條件。";
    } else if (statusFilter === "active") {
      strong.textContent = "沒有待完成的任務";
      message = "這個範圍內的任務都完成了，真棒。";
    } else if (statusFilter === "done") {
      strong.textContent = "尚無完成的任務";
      message = "完成任務後就會出現在這裡。";
    } else if (view === "completed") {
      strong.textContent = "還沒有完成的任務";
      message = "勾選任務左側的方框即可完成。";
    } else if (view === "today") {
      strong.textContent = "今天還沒有安排任務";
      message = "新增今天的任務，或到「全部任務」查看未安排日期的項目。";
    } else if (view === "upcoming") {
      strong.textContent = "接下來一週沒有任務";
      message = "替任務設定到期日，就會出現在這裡。";
    } else {
      strong.textContent = "這裡還沒有任務";
      message = "用上方的輸入框新增第一件任務吧。";
    }
    el.empty.append(strong, document.createTextNode(message));
  }

  function updateHeader() {
    let title = "任務";
    let subtitle = "";
    const current = today();

    if (view === "today") {
      title = "今天";
      subtitle = fmtLong(current);
    } else if (view === "upcoming") {
      title = "未來 7 天";
      subtitle = `${fmtShort(current)} – ${fmtShort(addDays(current, 7))}`;
    } else if (view === "all") {
      title = "全部任務";
      subtitle = "所有專案與任務";
    } else if (view === "completed") {
      title = "已完成";
      subtitle = "完成的任務都保存在這裡";
    } else if (view.startsWith("list:")) {
      const list = state.lists.find((item) => item.id === view.slice(5));
      title = list ? list.name : "專案";
      subtitle = "專案清單";
    }

    if (searchTerm) subtitle = `搜尋「${searchTerm}」的結果`;
    el.viewTitle.textContent = title;
    el.viewSubtitle.textContent = subtitle;
    el.hint.textContent =
      sortMode === "custom"
        ? "提示：拖曳任務可調整順序；按 N 新增任務、按 / 搜尋。"
        : "提示：按 N 新增任務、按 / 搜尋。";
  }

  function makeBadge(text, className) {
    const badge = document.createElement("span");
    badge.className = className ? `badge ${className}` : "badge";
    badge.textContent = text;
    return badge;
  }

  function makeListBadge(list) {
    const badge = document.createElement("span");
    badge.className = "badge";
    const dot = document.createElement("span");
    dot.className = "list-dot";
    dot.style.background = list.color;
    badge.append(dot, document.createTextNode(list.name));
    return badge;
  }

  function dueBadge(task) {
    if (!task.due) return null;
    const current = today();
    let text;
    let className = "";
    if (task.due === current) {
      text = "今天";
      className = "due-today";
    } else if (task.due < current) {
      text = task.done ? fmtMonthDay(task.due) : `逾期 ${fmtMonthDay(task.due)}`;
      className = task.done ? "due-done" : "due-overdue";
    } else {
      const diff = Math.round((parseISO(task.due) - parseISO(current)) / DAY_MS);
      text = diff === 1 ? "明天" : fmtMonthDay(task.due);
      className = diff <= 7 ? "due-soon" : "";
    }
    return makeBadge(text, className);
  }

  function buildTaskElement(task) {
    const item = document.createElement("li");
    item.className = `task${task.done ? " done" : ""}`;
    item.dataset.id = task.id;
    item.draggable = sortMode === "custom";

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "⋮⋮";
    handle.setAttribute("aria-hidden", "true");
    handle.hidden = sortMode !== "custom";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task-check";
    check.checked = task.done;
    check.setAttribute("aria-label", task.done ? `將「${task.title}」標記為未完成` : `將「${task.title}」標記為完成`);
    check.addEventListener("change", () => toggleTask(task, check.checked));

    const main = document.createElement("div");
    main.className = "task-main";

    const title = document.createElement("button");
    title.type = "button";
    title.className = "task-title";
    title.textContent = task.title;
    title.addEventListener("click", () => openTaskDialog(task));
    main.append(title);

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const list = state.lists.find((entry) => entry.id === task.listId);
    if (list) meta.append(makeListBadge(list));

    const due = dueBadge(task);
    if (due) meta.append(due);

    if (task.priority !== 2) {
      meta.append(makeBadge(task.priority === 3 ? "高優先" : "低優先", task.priority === 3 ? "priority-high" : "priority-low"));
    }

    if (task.repeat !== "none") meta.append(makeBadge(`↻ ${REPEATS[task.repeat]}`, ""));

    if (task.subtasks.length) {
      const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
      meta.append(makeBadge(`子任務 ${doneSubtasks}/${task.subtasks.length}`, ""));
    }

    for (const tag of task.tags) meta.append(makeBadge(`#${tag}`, "tag"));

    if (task.done && task.completedAt) {
      const completedDate = localDateOf(task.completedAt);
      if (completedDate) meta.append(makeBadge(`完成 ${fmtMonthDay(completedDate)}`, "due-done"));
    }

    main.append(meta);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "icon-btn";
    edit.title = "編輯任務";
    edit.setAttribute("aria-label", `編輯 ${task.title}`);
    edit.textContent = "✎";
    edit.addEventListener("click", () => openTaskDialog(task));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn delete";
    remove.title = "刪除任務";
    remove.setAttribute("aria-label", `刪除 ${task.title}`);
    remove.textContent = "🗑";
    remove.addEventListener("click", () => deleteTask(task));

    actions.append(edit, remove);
    item.append(handle, check, main, actions);

    if (sortMode === "custom") attachDrag(item, task);
    return item;
  }

  function attachDrag(item, task) {
    item.addEventListener("dragstart", (event) => {
      dragId = task.id;
      item.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        try {
          event.dataTransfer.setData("text/plain", task.id);
        } catch (error) {
          void error;
        }
      }
    });

    item.addEventListener("dragend", () => {
      dragId = null;
      item.classList.remove("dragging");
      for (const dropTarget of $$(".task.drag-over")) dropTarget.classList.remove("drag-over");
    });

    item.addEventListener("dragover", (event) => {
      if (!dragId || dragId === task.id) return;
      event.preventDefault();
      item.classList.add("drag-over");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });

    item.addEventListener("dragleave", () => item.classList.remove("drag-over"));

    item.addEventListener("drop", (event) => {
      event.preventDefault();
      item.classList.remove("drag-over");
      if (dragId && dragId !== task.id) reorderVisible(dragId, task.id);
    });
  }

  function reorderVisible(fromId, toId) {
    const visible = filteredTasks();
    const fromIndex = visible.findIndex((task) => task.id === fromId);
    const toIndex = visible.findIndex((task) => task.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const moved = visible.splice(fromIndex, 1)[0];
    visible.splice(toIndex, 0, moved);

    const ids = new Set(visible.map((task) => task.id));
    let cursor = 0;
    state.tasks = state.tasks.map((task) => (ids.has(task.id) ? visible[cursor++] : task));
    save();
    renderTasks();
  }

  function resetFilters() {
    statusFilter = "all";
    priorityFilter = "all";
    tagFilter = "all";
    el.priorityFilter.value = "all";
    el.tagFilter.value = "all";
    updateStatusButtons();
  }

  function setView(nextView) {
    view = nextView;
    searchTerm = "";
    el.search.value = "";
    resetFilters();
    closeSidebar();
    renderAll();
  }

  function setSidebar(open) {
    el.sidebar.classList.toggle("open", open);
    el.backdrop.classList.toggle("show", open);
  }

  function closeSidebar() {
    setSidebar(false);
  }

  function toggleTask(task, done) {
    const wasDone = task.done;
    task.done = done;
    task.completedAt = done ? new Date().toISOString() : null;

    if (done && task.repeat !== "none") {
      spawnNext(task);
    } else if (!done && wasDone && task.repeat !== "none") {
      const index = state.tasks.findIndex((entry) => entry.recurOf === task.id && !entry.done);
      if (index >= 0) state.tasks.splice(index, 1);
    }

    save();
    renderAll();
  }

  function spawnNext(task) {
    const base = task.due && task.due > today() ? task.due : today();
    const nextDue =
      task.repeat === "daily" ? addDays(base, 1) : task.repeat === "weekly" ? addDays(base, 7) : addMonths(base, 1);
    const exists = state.tasks.some((entry) => entry.recurOf === task.id && !entry.done && entry.due === nextDue);
    if (exists) return;

    state.tasks.unshift({
      id: uid("t"),
      listId: task.listId,
      title: task.title,
      notes: task.notes,
      priority: task.priority,
      due: nextDue,
      tags: task.tags.slice(),
      subtasks: task.subtasks.map((subtask) => ({ id: uid("s"), title: subtask.title, done: false })),
      done: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      repeat: task.repeat,
      recurOf: task.id
    });
  }

  function deleteTask(task) {
    const index = state.tasks.findIndex((entry) => entry.id === task.id);
    if (index < 0) return;
    state.tasks.splice(index, 1);
    save();
    renderAll();
    offerUndo(`已刪除「${truncate(task.title)}」`, [{ task, index }]);
  }

  function clearCompleted() {
    const completed = state.tasks.filter((task) => task.done);
    if (!completed.length) {
      showToast("目前沒有已完成的任務");
      return;
    }
    if (!window.confirm(`確定要清除 ${completed.length} 項已完成的任務嗎？`)) return;

    const items = completed.map((task) => ({ task, index: state.tasks.indexOf(task) }));
    state.tasks = state.tasks.filter((task) => !task.done);
    save();
    renderAll();
    offerUndo(`已清除 ${completed.length} 項完成任務`, items);
  }

  function offerUndo(label, items) {
    undoState = { items };
    showToast(
      label,
      "復原",
      () => {
        if (!undoState) return;
        const pending = undoState.items.slice().sort((a, b) => a.index - b.index);
        undoState = null;
        for (const entry of pending) {
          const index = clamp(entry.index, 0, state.tasks.length);
          state.tasks.splice(index, 0, entry.task);
        }
        hideToast();
        save();
        renderAll();
      },
      7000
    );
  }

  function showToast(message, actionLabel, action, duration = 4000) {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    el.toastMsg.textContent = message;
    el.toastAction.hidden = !actionLabel;
    el.toastAction.textContent = actionLabel || "";
    el.toastAction.onclick = action || null;
    el.toast.hidden = false;
    requestAnimationFrame(() => el.toast.classList.add("show"));
    toastTimer = setTimeout(() => hideToast(), duration);
  }

  function hideToast() {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    el.toast.classList.remove("show");
    el.toastAction.hidden = true;
    el.toastAction.onclick = null;
    setTimeout(() => {
      if (!el.toast.classList.contains("show")) el.toast.hidden = true;
    }, 220);
  }

  function fillListSelect(selectedId) {
    el.fList.textContent = "";
    for (const list of state.lists) el.fList.append(new Option(list.name, list.id));
    el.fList.value = selectedId;
  }

  function openTaskDialog(task) {
    editingId = task ? task.id : null;
    draftSubtasks = task ? task.subtasks.map((subtask) => ({ ...subtask })) : [];

    el.taskDialogTitle.textContent = task ? "編輯任務" : "新增任務";
    el.fTitle.value = task ? task.title : "";
    fillListSelect(task ? task.listId : currentListId());
    el.fPriority.value = String(task ? task.priority : 2);
    el.fDue.value = task ? task.due || "" : defaultDue();
    el.fRepeat.value = task ? task.repeat : "none";
    el.fTags.value = task ? task.tags.join(", ") : "";
    el.fNotes.value = task ? task.notes : "";
    el.fDelete.hidden = !task;
    el.fSubtask.value = "";
    renderSubtaskEditor();

    el.taskDialog.showModal();
    el.fTitle.focus();
  }

  function renderSubtaskEditor() {
    el.subtaskEditor.textContent = "";
    if (!draftSubtasks.length) {
      const hint = document.createElement("p");
      hint.className = "field-hint";
      hint.textContent = "尚無子任務";
      el.subtaskEditor.append(hint);
      return;
    }

    draftSubtasks.forEach((subtask, index) => {
      const row = document.createElement("div");
      row.className = "subtask-row";

      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = subtask.done;
      check.setAttribute("aria-label", `完成子任務 ${subtask.title}`);
      check.addEventListener("change", () => {
        subtask.done = check.checked;
      });

      const text = document.createElement("span");
      text.textContent = subtask.title;
      if (subtask.done) text.className = "done";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-btn";
      remove.setAttribute("aria-label", `刪除子任務 ${subtask.title}`);
      remove.textContent = "✕";
      remove.addEventListener("click", () => {
        draftSubtasks.splice(index, 1);
        renderSubtaskEditor();
      });

      row.append(check, text, remove);
      el.subtaskEditor.append(row);
    });
  }

  function addSubtask() {
    const title = el.fSubtask.value.trim();
    if (!title) return;
    draftSubtasks.push({ id: uid("s"), title, done: false });
    el.fSubtask.value = "";
    renderSubtaskEditor();
    el.fSubtask.focus();
  }

  function handleTaskSubmit(event) {
    event.preventDefault();
    const title = el.fTitle.value.trim();
    if (!title) {
      el.fTitle.focus();
      return;
    }

    const listId = state.lists.some((list) => list.id === el.fList.value) ? el.fList.value : state.lists[0].id;
    const priority = clamp(Number(el.fPriority.value) || 2, 1, 3);
    const due = el.fDue.value || null;
    const repeat = ["none", "daily", "weekly", "monthly"].includes(el.fRepeat.value) ? el.fRepeat.value : "none";
    const tags = Array.from(
      new Set(
        el.fTags.value
          .split(/[,，]/)
          .map((tag) => tag.trim().replace(/^#+/, ""))
          .filter(Boolean)
      )
    ).slice(0, 10);
    const notes = el.fNotes.value.trim();
    const subtasks = draftSubtasks.map((subtask) => ({ ...subtask, title: subtask.title.trim() })).filter((subtask) => subtask.title);

    if (editingId) {
      const task = state.tasks.find((entry) => entry.id === editingId);
      if (task) Object.assign(task, { title, listId, priority, due, repeat, tags, notes, subtasks });
    } else {
      state.tasks.unshift({
        id: uid("t"),
        listId,
        title,
        notes,
        priority,
        due,
        tags,
        subtasks,
        done: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        repeat,
        recurOf: null
      });
      if (view === "completed") view = "today";
    }

    state.settings.lastList = listId;
    save();
    el.taskDialog.close();
    renderAll();
  }

  function handleTaskDelete() {
    const task = state.tasks.find((entry) => entry.id === editingId);
    if (!task) return;
    el.taskDialog.close();
    deleteTask(task);
  }

  function handleQuickAdd(event) {
    event.preventDefault();
    const title = el.quickInput.value.trim();
    if (!title) {
      el.quickInput.focus();
      return;
    }

    if (view === "completed") view = "today";
    let due = null;
    if (view === "today") due = today();
    else if (view === "upcoming") due = addDays(today(), 1);

    const listId = currentListId();
    state.tasks.unshift({
      id: uid("t"),
      listId,
      title,
      notes: "",
      priority: 2,
      due,
      tags: [],
      subtasks: [],
      done: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      repeat: "none",
      recurOf: null
    });
    state.settings.lastList = listId;
    el.quickInput.value = "";
    save();
    renderAll();
    el.quickInput.focus();
  }

  function openListDialog(list) {
    editingListId = list ? list.id : null;
    el.listDialogTitle.textContent = list ? "重新命名專案" : "新增專案";
    el.lName.value = list ? list.name : "";
    el.listDialog.showModal();
    el.lName.focus();
  }

  function handleListSubmit(event) {
    event.preventDefault();
    const name = el.lName.value.trim();
    if (!name) {
      el.lName.focus();
      return;
    }

    if (editingListId) {
      const list = state.lists.find((entry) => entry.id === editingListId);
      if (list) list.name = name;
    } else {
      const list = { id: uid("list"), name, color: LIST_COLORS[state.lists.length % LIST_COLORS.length] };
      state.lists.push(list);
      state.settings.lastList = list.id;
    }

    el.listDialog.close();
    save();
    renderAll();
  }

  function deleteList(list) {
    if (state.lists.length <= 1) {
      showToast("至少要保留一個專案");
      return;
    }
    const fallback = state.lists.find((entry) => entry.id !== list.id);
    const count = state.tasks.filter((task) => task.listId === list.id).length;
    const message = count
      ? `刪除專案「${list.name}」？其中 ${count} 項任務會移到「${fallback.name}」。`
      : `刪除專案「${list.name}」？`;
    if (!window.confirm(message)) return;

    for (const task of state.tasks) {
      if (task.listId === list.id) task.listId = fallback.id;
    }
    state.lists = state.lists.filter((entry) => entry.id !== list.id);
    if (view === `list:${list.id}`) view = "today";
    if (state.settings.lastList === list.id) state.settings.lastList = fallback.id;
    save();
    renderAll();
  }

  function cycleTheme() {
    const index = THEMES.indexOf(state.settings.theme);
    state.settings.theme = THEMES[(index + 1) % THEMES.length];
    save();
    applyTheme();
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taskflow-${today()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("已匯出資料");
  }

  async function handleImport() {
    const file = el.importFile.files && el.importFile.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.lists)) {
        throw new Error("檔案格式不正確");
      }
      if (!window.confirm("匯入會覆蓋目前的資料，確定要繼續嗎？")) return;
      state = normalizeState(data);
      view = "today";
      searchTerm = "";
      el.search.value = "";
      resetFilters();
      save();
      renderAll();
      showToast("資料匯入完成");
    } catch (error) {
      showToast(`匯入失敗：${error.message}`);
    } finally {
      el.importFile.value = "";
    }
  }

  function handleKeydown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const active = document.activeElement;
    const typing =
      active &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable);
    const dialogOpen = Boolean(document.querySelector("dialog[open]"));

    if (event.key === "/" && !typing && !dialogOpen) {
      event.preventDefault();
      el.search.focus();
      el.search.select();
      return;
    }
    if ((event.key === "n" || event.key === "N") && !typing && !dialogOpen) {
      event.preventDefault();
      openTaskDialog(null);
      return;
    }
    if (event.key === "Escape" && active === el.search) {
      el.search.value = "";
      searchTerm = "";
      renderTasks();
    }
  }

  function bindEvents() {
    el.newTask.addEventListener("click", () => openTaskDialog(null));
    el.addList.addEventListener("click", () => openListDialog(null));
    el.menuBtn.addEventListener("click", () => setSidebar(!el.sidebar.classList.contains("open")));
    el.backdrop.addEventListener("click", closeSidebar);

    for (const button of el.navItems) button.addEventListener("click", () => setView(button.dataset.view));

    el.search.addEventListener("input", () => {
      searchTerm = el.search.value.trim();
      renderTasks();
    });

    el.sort.addEventListener("change", () => {
      sortMode = el.sort.value;
      renderTasks();
    });

    el.statusFilter.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-status]");
      if (!button) return;
      statusFilter = button.dataset.status;
      updateStatusButtons();
      renderTasks();
    });

    el.priorityFilter.addEventListener("change", () => {
      priorityFilter = el.priorityFilter.value;
      renderTasks();
    });

    el.tagFilter.addEventListener("change", () => {
      tagFilter = el.tagFilter.value;
      renderTasks();
    });

    el.clearDone.addEventListener("click", clearCompleted);
    el.quickAdd.addEventListener("submit", handleQuickAdd);
    el.detailedAdd.addEventListener("click", () => openTaskDialog(null));
    el.taskForm.addEventListener("submit", handleTaskSubmit);
    el.fDelete.addEventListener("click", handleTaskDelete);
    el.fSubtaskAdd.addEventListener("click", addSubtask);
    el.fSubtask.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addSubtask();
      }
    });
    el.listForm.addEventListener("submit", handleListSubmit);
    el.exportBtn.addEventListener("click", exportData);
    el.importBtn.addEventListener("click", () => el.importFile.click());
    el.importFile.addEventListener("change", handleImport);
    el.themeBtn.addEventListener("click", cycleTheme);

    document.addEventListener("click", (event) => {
      const close = event.target.closest("[data-close]");
      if (!close) return;
      const dialog = close.closest("dialog");
      if (dialog) dialog.close();
    });

    document.addEventListener("keydown", handleKeydown);

    window.addEventListener("storage", (event) => {
      if (event.key !== STORE_KEY || !event.newValue) return;
      try {
        state = normalizeState(JSON.parse(event.newValue));
        applyTheme();
        renderAll();
      } catch (error) {
        void error;
      }
    });
  }

  bindEvents();
  updateStatusButtons();
  renderAll();
  save();

  setInterval(() => {
    const current = today();
    if (current !== activeDay) {
      activeDay = current;
      renderAll();
    }
  }, 60000);
})();
