const MAX_NOTE_LENGTH = 50;

const form = document.querySelector("#note-form");
const noteInput = document.querySelector("#note-input");
const submitButton = document.querySelector("#note-submit");
const submitLabel = document.querySelector("#submit-label");
const noteList = document.querySelector("#note-list");
const emptyState = document.querySelector("#empty-state");
const noteCount = document.querySelector("#note-count");
const errorMessage = document.querySelector("#note-error");
const characterCount = document.querySelector("#character-count");

function updateCharacterCount() {
  const length = Array.from(noteInput.value).length;
  characterCount.textContent = `${length} / ${MAX_NOTE_LENGTH}`;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.classList.add("hidden");
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitLabel.textContent = isSubmitting ? "儲存中…" : "新增筆記";
}

function createNoteElement(content) {
  const item = document.createElement("li");
  item.dataset.testid = "note-item";
  item.className =
    "group flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md";

  const marker = document.createElement("span");
  marker.className =
    "mt-1.5 h-2 w-2 flex-none rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 shadow-sm shadow-indigo-200";

  const text = document.createElement("p");
  text.className =
    "min-w-0 flex-1 break-words text-[15px] leading-6 text-slate-700";
  text.textContent = content;

  item.append(marker, text);

  return item;
}

function renderNotes(notes) {
  noteList.replaceChildren(...notes.map(createNoteElement));

  const hasNotes = notes.length > 0;
  emptyState.classList.toggle("hidden", hasNotes);
  noteCount.textContent = hasNotes ? `${notes.length} 則筆記` : "還沒有筆記";
}

async function loadNotes() {
  try {
    const response = await fetch("/api/notes", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("無法載入筆記，請稍後再試。");
    }

    const notes = await response.json();
    renderNotes(Array.isArray(notes) ? notes : []);
  } catch (error) {
    showError(error.message || "無法載入筆記，請稍後再試。");
  }
}

async function createNote(content) {
  const response = await fetch("/api/notes", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "新增筆記失敗，請稍後再試。");
  }

  return data;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const content = noteInput.value.trim();
  const length = Array.from(content).length;

  if (length === 0) {
    showError("請輸入筆記內容。");
    noteInput.focus();
    return;
  }

  if (length > MAX_NOTE_LENGTH) {
    showError(`筆記內容不能超過 ${MAX_NOTE_LENGTH} 個字元。`);
    noteInput.focus();
    return;
  }

  setSubmitting(true);

  try {
    await createNote(content);
    noteInput.value = "";
    updateCharacterCount();
    await loadNotes();
    noteInput.focus();
  } catch (error) {
    showError(error.message || "新增筆記失敗，請稍後再試。");
  } finally {
    setSubmitting(false);
  }
});

noteInput.addEventListener("input", () => {
  clearError();
  updateCharacterCount();
});

loadNotes();
