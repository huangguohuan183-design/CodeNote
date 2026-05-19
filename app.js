const DB_NAME = "codenote-knowledge-db";
const DB_VERSION = 1;

const DEFAULT_CATEGORIES = [
  { id: "cat-js", name: "JavaScript", color: "#16756b", order: 1 },
  { id: "cat-css", name: "HTML / CSS", color: "#315f91", order: 2 },
  { id: "cat-algo", name: "算法", color: "#b75139", order: 3 },
  { id: "cat-tools", name: "工具链", color: "#ae7b10", order: 4 },
  { id: "cat-other", name: "未分类", color: "#66736c", order: 5 },
];

const STATUS_LABELS = {
  draft: "草稿",
  learning: "学习中",
  review: "待复习",
  mastered: "已掌握",
};

const LEVEL_LABELS = {
  1: "入门",
  2: "普通",
  3: "重点",
  4: "困难",
};

const QUOTES = [
  {
    text: "学而时习之，不亦说乎？",
    source: "《论语·学而》",
  },
  {
    text: "知之者不如好之者，好之者不如乐之者。",
    source: "《论语·雍也》",
  },
  {
    text: "博学之，审问之，慎思之，明辨之，笃行之。",
    source: "《礼记·中庸》",
  },
  {
    text: "锲而不舍，金石可镂。",
    source: "《荀子·劝学》",
  },
  {
    text: "路漫漫其修远兮，吾将上下而求索。",
    source: "屈原《离骚》",
  },
  {
    text: "读书使人丰盈，论辩使人敏捷，落笔使人精确。",
    source: "培根《论读书》",
  },
  {
    text: "扰乱我们的并非事物本身，而是我们对事物的判断。",
    source: "爱比克泰德《手册》",
  },
  {
    text: "行动受阻之处，正是行动得以推进之处；挡路之物，也可成为道路。",
    source: "马可·奥勒留《沉思录》",
  },
];

const els = {
  root: document.documentElement,
  searchInput: document.querySelector("#searchInput"),
  allCount: document.querySelector("#allCount"),
  pinnedCount: document.querySelector("#pinnedCount"),
  reviewCount: document.querySelector("#reviewCount"),
  archivedCount: document.querySelector("#archivedCount"),
  categoryList: document.querySelector("#categoryList"),
  tagCloud: document.querySelector("#tagCloud"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  dateLine: document.querySelector("#dateLine"),
  quoteText: document.querySelector("#quoteText"),
  quoteSource: document.querySelector("#quoteSource"),
  nextQuoteBtn: document.querySelector("#nextQuoteBtn"),
  themeToggle: document.querySelector("#themeToggle"),
  newNoteBtn: document.querySelector("#newNoteBtn"),
  statNotes: document.querySelector("#statNotes"),
  statWeek: document.querySelector("#statWeek"),
  statImages: document.querySelector("#statImages"),
  statReview: document.querySelector("#statReview"),
  clearFiltersBtn: document.querySelector("#clearFiltersBtn"),
  activeFilter: document.querySelector("#activeFilter"),
  notesList: document.querySelector("#notesList"),
  noteForm: document.querySelector("#noteForm"),
  titleInput: document.querySelector("#titleInput"),
  pinBtn: document.querySelector("#pinBtn"),
  archiveBtn: document.querySelector("#archiveBtn"),
  deleteNoteBtn: document.querySelector("#deleteNoteBtn"),
  categorySelect: document.querySelector("#categorySelect"),
  statusSelect: document.querySelector("#statusSelect"),
  levelSelect: document.querySelector("#levelSelect"),
  sourceInput: document.querySelector("#sourceInput"),
  tagsInput: document.querySelector("#tagsInput"),
  bodyInput: document.querySelector("#bodyInput"),
  previewPane: document.querySelector("#previewPane"),
  imageInput: document.querySelector("#imageInput"),
  saveState: document.querySelector("#saveState"),
  attachments: document.querySelector("#attachments"),
  addCategoryBtn: document.querySelector("#addCategoryBtn"),
  categoryDialog: document.querySelector("#categoryDialog"),
  categoryDialogTitle: document.querySelector("#categoryDialogTitle"),
  categoryNameInput: document.querySelector("#categoryNameInput"),
  categoryColorInput: document.querySelector("#categoryColorInput"),
  deleteCategoryBtn: document.querySelector("#deleteCategoryBtn"),
  cancelCategoryBtn: document.querySelector("#cancelCategoryBtn"),
  saveCategoryBtn: document.querySelector("#saveCategoryBtn"),
  toast: document.querySelector("#toast"),
};

const state = {
  db: null,
  notes: [],
  categories: [],
  selectedNoteId: null,
  activeView: "all",
  activeCategoryId: null,
  activeTag: null,
  sortBy: "updatedAt",
  editorMode: "write",
  editingCategoryId: null,
  saveTimer: null,
  toastTimer: null,
  quoteIndex: 0,
};

init();

async function init() {
  applySavedTheme();
  setDateLine();
  renderDailyQuote();
  bindEvents();

  try {
    state.db = await openDatabase();
    await ensureDefaults();
    await loadAllData();
    if (state.notes.length === 0) {
      await createNote({ silent: true });
    }
    state.selectedNoteId = getFirstVisibleNote()?.id || state.notes[0]?.id || null;
    renderAll();
    loadSelectedNote();
  } catch (error) {
    console.error(error);
    showToast("本地数据库打开失败");
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("notes")) {
        db.createObjectStore("notes", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("categories")) {
        db.createObjectStore("categories", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(name, mode = "readonly") {
  return state.db.transaction(name, mode).objectStore(name);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAll(storeName) {
  return requestToPromise(txStore(storeName).getAll());
}

async function putItem(storeName, value) {
  return requestToPromise(txStore(storeName, "readwrite").put(value));
}

async function deleteItem(storeName, id) {
  return requestToPromise(txStore(storeName, "readwrite").delete(id));
}

async function ensureDefaults() {
  const categories = await getAll("categories");
  if (categories.length > 0) return;

  const now = new Date().toISOString();
  await Promise.all(
    DEFAULT_CATEGORIES.map((category) =>
      putItem("categories", {
        ...category,
        createdAt: now,
        updatedAt: now,
      })
    )
  );
}

async function loadAllData() {
  const [notes, categories] = await Promise.all([getAll("notes"), getAll("categories")]);
  state.notes = notes;
  state.categories = categories.sort(
    (a, b) => getCategoryOrder(a) - getCategoryOrder(b) || (a.createdAt || "").localeCompare(b.createdAt || "") || a.name.localeCompare(b.name, "zh-CN")
  );
}

function getCategoryOrder(category) {
  const defaultCategory = DEFAULT_CATEGORIES.find((item) => item.id === category.id);
  return category.order ?? defaultCategory?.order ?? 9999;
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      state.activeCategoryId = null;
      state.activeTag = null;
      renderAll();
      selectFirstVisibleIfNeeded();
    });
  });

  document.querySelectorAll(".segmented button").forEach((button) => {
    button.addEventListener("click", () => {
      state.sortBy = button.dataset.sort;
      document.querySelectorAll(".segmented button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderNotesList();
    });
  });

  document.querySelectorAll(".editor-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.editorMode = button.dataset.mode;
      document.querySelectorAll(".editor-tabs button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      toggleEditorMode();
    });
  });

  els.searchInput.addEventListener("input", () => {
    renderNotesList();
    renderActiveFilter();
  });

  els.clearFiltersBtn.addEventListener("click", () => {
    state.activeView = "all";
    state.activeCategoryId = null;
    state.activeTag = null;
    els.searchInput.value = "";
    renderAll();
    selectFirstVisibleIfNeeded();
  });

  els.newNoteBtn.addEventListener("click", () => createNote());
  els.nextQuoteBtn.addEventListener("click", nextQuote);
  els.themeToggle.addEventListener("click", toggleTheme);
  els.pinBtn.addEventListener("click", togglePin);
  els.archiveBtn.addEventListener("click", toggleArchive);
  els.deleteNoteBtn.addEventListener("click", deleteSelectedNote);
  els.exportBtn.addEventListener("click", exportData);
  els.importInput.addEventListener("change", importData);
  els.imageInput.addEventListener("change", addImagesFromInput);
  els.addCategoryBtn.addEventListener("click", () => openCategoryDialog());
  els.deleteCategoryBtn.addEventListener("click", deleteCategoryFromDialog);
  els.cancelCategoryBtn.addEventListener("click", closeCategoryDialog);
  els.saveCategoryBtn.addEventListener("click", saveCategoryFromDialog);
  els.categoryDialog.addEventListener("click", (event) => {
    if (event.target === els.categoryDialog) closeCategoryDialog();
  });

  [els.titleInput, els.categorySelect, els.statusSelect, els.levelSelect, els.sourceInput, els.tagsInput, els.bodyInput].forEach(
    (input) => {
      input.addEventListener("input", scheduleSave);
      input.addEventListener("change", scheduleSave);
    }
  );
  els.titleInput.addEventListener("input", autoResizeTitle);

  document.addEventListener("paste", handlePaste);
  document.addEventListener("keydown", handleKeyboard);
  window.addEventListener("beforeunload", () => {
    if (state.saveTimer) saveSelectedNow();
  });
}

function setDateLine() {
  els.dateLine.textContent = new Date().toLocaleDateString("zh-CN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderDailyQuote() {
  const daySeed = Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000);
  const savedIndex = Number(localStorage.getItem("codenote-quote-index"));
  state.quoteIndex = Number.isInteger(savedIndex) ? savedIndex % QUOTES.length : daySeed % QUOTES.length;
  renderQuote();
}

function renderQuote() {
  const quote = QUOTES[(state.quoteIndex + QUOTES.length) % QUOTES.length];
  els.quoteText.textContent = quote.text;
  els.quoteSource.textContent = quote.source;
  localStorage.setItem("codenote-quote-index", String(state.quoteIndex));
}

function nextQuote() {
  state.quoteIndex = (state.quoteIndex + 1) % QUOTES.length;
  renderQuote();
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem("codenote-theme");
  if (savedTheme === "dark") {
    els.root.classList.add("dark");
  }
}

function toggleTheme() {
  els.root.classList.toggle("dark");
  localStorage.setItem("codenote-theme", els.root.classList.contains("dark") ? "dark" : "light");
}

async function createNote({ silent = false } = {}) {
  await saveSelectedNow({ updateTimestamp: false });
  const now = new Date().toISOString();
  const categoryId = state.activeCategoryId || state.categories.find((category) => category.id === "cat-js")?.id || state.categories[0]?.id || "cat-other";
  const note = {
    id: crypto.randomUUID(),
    title: "未命名笔记",
    body: "",
    categoryId,
    status: "learning",
    level: "2",
    source: "",
    tags: [],
    attachments: [],
    pinned: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  await putItem("notes", note);
  state.notes.unshift(note);
  state.selectedNoteId = note.id;
  state.activeView = "all";
  state.activeTag = null;
  els.searchInput.value = "";
  renderAll();
  loadSelectedNote();
  els.titleInput.focus();
  els.titleInput.select();
  if (!silent) showToast("已创建新笔记");
}

function getSelectedNote() {
  return state.notes.find((note) => note.id === state.selectedNoteId) || null;
}

function getFirstVisibleNote() {
  return getFilteredNotes()[0] || null;
}

function collectFormIntoNote(note, { updateTimestamp = true } = {}) {
  if (!note) return null;

  note.title = els.titleInput.value.trim() || "未命名笔记";
  note.categoryId = els.categorySelect.value || state.categories[0]?.id || "cat-other";
  note.status = els.statusSelect.value;
  note.level = els.levelSelect.value;
  note.source = els.sourceInput.value.trim();
  note.tags = parseTags(els.tagsInput.value);
  note.body = els.bodyInput.value;
  if (updateTimestamp) {
    note.updatedAt = new Date().toISOString();
  }
  return note;
}

function scheduleSave() {
  const note = getSelectedNote();
  if (!note) return;

  collectFormIntoNote(note);
  setSaveState("保存中...");
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(async () => {
    await saveSelectedNow();
    renderAll({ keepEditor: true });
  }, 450);
}

async function saveSelectedNow({ updateTimestamp = true } = {}) {
  const note = getSelectedNote();
  if (!note) return;

  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  collectFormIntoNote(note, { updateTimestamp });
  await putItem("notes", note);
  setSaveState("已保存");
}

function setSaveState(text) {
  els.saveState.textContent = text;
}

function loadSelectedNote() {
  const note = getSelectedNote();
  if (!note) {
    els.noteForm.classList.add("hidden");
    return;
  }

  els.noteForm.classList.remove("hidden");
  renderCategoryOptions();
  els.titleInput.value = note.title || "";
  autoResizeTitle();
  els.categorySelect.value = note.categoryId || state.categories[0]?.id || "";
  els.statusSelect.value = note.status || "learning";
  els.levelSelect.value = String(note.level || "2");
  els.sourceInput.value = note.source || "";
  els.tagsInput.value = (note.tags || []).join(", ");
  els.bodyInput.value = note.body || "";
  els.pinBtn.classList.toggle("active", Boolean(note.pinned));
  els.archiveBtn.classList.toggle("active", Boolean(note.archived));
  renderAttachments();
  toggleEditorMode();
  setSaveState("已保存");
}

function autoResizeTitle() {
  els.titleInput.style.height = "auto";
  els.titleInput.style.height = `${Math.max(48, els.titleInput.scrollHeight)}px`;
}

async function selectNote(id) {
  if (id === state.selectedNoteId) return;
  await saveSelectedNow({ updateTimestamp: false });
  state.selectedNoteId = id;
  renderNotesList();
  loadSelectedNote();
}

async function togglePin() {
  const note = getSelectedNote();
  if (!note) return;
  note.pinned = !note.pinned;
  await saveSelectedNow();
  renderAll({ keepEditor: true });
  loadSelectedNote();
}

async function toggleArchive() {
  const note = getSelectedNote();
  if (!note) return;
  note.archived = !note.archived;
  await saveSelectedNow();
  renderAll({ keepEditor: true });
  loadSelectedNote();
  showToast(note.archived ? "已归档" : "已取消归档");
}

async function deleteSelectedNote() {
  const note = getSelectedNote();
  if (!note) return;
  if (!confirm(`删除“${note.title || "未命名笔记"}”？`)) return;

  await deleteItem("notes", note.id);
  state.notes = state.notes.filter((item) => item.id !== note.id);
  state.selectedNoteId = getFirstVisibleNote()?.id || state.notes[0]?.id || null;
  renderAll();
  loadSelectedNote();
  showToast("已删除笔记");
}

function renderAll({ keepEditor = false } = {}) {
  renderNavigation();
  renderCategoryOptions();
  renderCategoryList();
  renderTagCloud();
  renderStats();
  renderActiveFilter();
  renderNotesList();
  if (!keepEditor) loadSelectedNote();
}

function renderNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.activeView && !state.activeCategoryId && !state.activeTag);
  });

  const nonArchived = state.notes.filter((note) => !note.archived);
  els.allCount.textContent = nonArchived.length;
  els.pinnedCount.textContent = nonArchived.filter((note) => note.pinned).length;
  els.reviewCount.textContent = nonArchived.filter((note) => note.status === "review").length;
  els.archivedCount.textContent = state.notes.filter((note) => note.archived).length;
}

function renderStats() {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const nonArchived = state.notes.filter((note) => !note.archived);
  els.statNotes.textContent = nonArchived.length;
  els.statWeek.textContent = nonArchived.filter((note) => new Date(note.updatedAt).getTime() >= weekAgo).length;
  els.statImages.textContent = state.notes.reduce((sum, note) => sum + (note.attachments?.length || 0), 0);
  els.statReview.textContent = nonArchived.filter((note) => note.status === "review").length;
}

function renderCategoryOptions() {
  const selected = els.categorySelect.value;
  els.categorySelect.innerHTML = state.categories
    .map((category) => `<option value="${escapeAttr(category.id)}">${escapeHtml(category.name)}</option>`)
    .join("");
  if (state.categories.some((category) => category.id === selected)) {
    els.categorySelect.value = selected;
  }
}

function renderCategoryList() {
  const counts = new Map();
  state.notes
    .filter((note) => !note.archived)
    .forEach((note) => counts.set(note.categoryId, (counts.get(note.categoryId) || 0) + 1));

  els.categoryList.innerHTML = state.categories
    .map(
      (category) => `
        <div class="category-row">
          <button class="category-item ${state.activeCategoryId === category.id ? "active" : ""}" type="button" data-category-id="${escapeAttr(
        category.id
      )}">
            <i class="category-dot" style="background:${escapeAttr(category.color)}"></i>
            <span>${escapeHtml(category.name)}</span>
            <b>${counts.get(category.id) || 0}</b>
          </button>
          <button class="icon-button category-edit" type="button" title="编辑分类" aria-label="编辑分类" data-edit-category-id="${escapeAttr(
            category.id
          )}">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"></path>
            </svg>
          </button>
        </div>
      `
    )
    .join("");

  els.categoryList.querySelectorAll("[data-category-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCategoryId = button.dataset.categoryId;
      state.activeTag = null;
      state.activeView = "all";
      renderAll();
      selectFirstVisibleIfNeeded();
    });
  });

  els.categoryList.querySelectorAll("[data-edit-category-id]").forEach((button) => {
    button.addEventListener("click", () => {
      openCategoryDialog(button.dataset.editCategoryId);
    });
  });
}

function renderTagCloud() {
  const tagCounts = new Map();
  state.notes
    .filter((note) => !note.archived)
    .flatMap((note) => note.tags || [])
    .forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));

  const tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, 18);

  if (tags.length === 0) {
    els.tagCloud.innerHTML = `<div class="empty-chip">无标签</div>`;
    return;
  }

  els.tagCloud.innerHTML = tags
    .map(
      ([tag, count]) => `
        <button class="tag-pill ${state.activeTag === tag ? "active" : ""}" type="button" data-tag="${escapeAttr(tag)}">
          ${escapeHtml(tag)} · ${count}
        </button>
      `
    )
    .join("");

  els.tagCloud.querySelectorAll("[data-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTag = button.dataset.tag;
      state.activeCategoryId = null;
      state.activeView = "all";
      renderAll();
      selectFirstVisibleIfNeeded();
    });
  });
}

function renderActiveFilter() {
  const parts = [];
  const query = els.searchInput.value.trim();
  if (query) parts.push(`搜索：${query}`);
  if (state.activeView !== "all") parts.push(getViewLabel(state.activeView));
  if (state.activeCategoryId) parts.push(`分类：${getCategoryName(state.activeCategoryId)}`);
  if (state.activeTag) parts.push(`标签：${state.activeTag}`);
  els.activeFilter.textContent = parts.length ? parts.join(" / ") : "全部可用笔记";
}

function renderNotesList() {
  const notes = getFilteredNotes();

  if (notes.length === 0) {
    els.notesList.innerHTML = `<div class="empty-state">暂无笔记</div>`;
    return;
  }

  els.notesList.innerHTML = notes.map(renderNoteCard).join("");
  els.notesList.querySelectorAll(".note-card").forEach((card) => {
    card.addEventListener("click", () => selectNote(card.dataset.id));
  });
}

function renderNoteCard(note) {
  const category = getCategory(note.categoryId);
  const statusClass = note.status === "review" ? "status-review" : note.status === "mastered" ? "status-mastered" : "";
  const attachmentCount = note.attachments?.length || 0;
  const tagHtml = (note.tags || [])
    .slice(0, 4)
    .map((tag) => `<span class="mini-tag">${escapeHtml(tag)}</span>`)
    .join("");

  return `
    <button class="note-card ${note.id === state.selectedNoteId ? "active" : ""}" type="button" data-id="${escapeAttr(note.id)}">
      <div class="note-title-row">
        <div class="note-title">${note.pinned ? "★ " : ""}${escapeHtml(note.title || "未命名笔记")}</div>
        <span class="status-badge ${statusClass}">${STATUS_LABELS[note.status] || "学习中"}</span>
      </div>
      <div class="note-excerpt">${escapeHtml(makeExcerpt(note.body))}</div>
      <div class="note-meta">
        <span class="category-dot" style="background:${escapeAttr(category?.color || "#66736c")}"></span>
        <span>${escapeHtml(category?.name || "未分类")}</span>
        <span>${formatDate(note.updatedAt)}</span>
        <span>${LEVEL_LABELS[note.level] || "普通"}</span>
        ${attachmentCount ? `<span>${attachmentCount} 图</span>` : ""}
      </div>
      <div class="note-tags">${tagHtml || `<span class="mini-tag">无标签</span>`}</div>
    </button>
  `;
}

function getFilteredNotes() {
  const query = els.searchInput.value.trim().toLowerCase();
  let notes = [...state.notes];

  if (state.activeView === "archived") {
    notes = notes.filter((note) => note.archived);
  } else {
    notes = notes.filter((note) => !note.archived);
  }

  if (state.activeView === "pinned") {
    notes = notes.filter((note) => note.pinned);
  }
  if (state.activeView === "review") {
    notes = notes.filter((note) => note.status === "review");
  }
  if (state.activeCategoryId) {
    notes = notes.filter((note) => note.categoryId === state.activeCategoryId);
  }
  if (state.activeTag) {
    notes = notes.filter((note) => (note.tags || []).includes(state.activeTag));
  }
  if (query) {
    notes = notes.filter((note) => {
      const haystack = [note.title, note.body, note.source, ...(note.tags || [])].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }

  notes.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (state.sortBy === "title") return (a.title || "").localeCompare(b.title || "", "zh-CN");
    return new Date(b[state.sortBy]).getTime() - new Date(a[state.sortBy]).getTime();
  });

  return notes;
}

function selectFirstVisibleIfNeeded() {
  const visible = getFilteredNotes();
  if (!visible.some((note) => note.id === state.selectedNoteId)) {
    state.selectedNoteId = visible[0]?.id || state.notes[0]?.id || null;
    loadSelectedNote();
  }
  renderNotesList();
}

function toggleEditorMode() {
  const isPreview = state.editorMode === "preview";
  els.bodyInput.classList.toggle("hidden", isPreview);
  els.previewPane.classList.toggle("hidden", !isPreview);
  if (isPreview) {
    els.previewPane.innerHTML = renderMarkdown(els.bodyInput.value);
  }
}

async function addImagesFromInput() {
  const files = [...els.imageInput.files].filter((file) => file.type.startsWith("image/"));
  if (files.length) await addImageFiles(files);
  els.imageInput.value = "";
}

async function handlePaste(event) {
  const items = [...(event.clipboardData?.items || [])];
  const files = items
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);

  if (!files.length) return;
  if (!getSelectedNote()) await createNote({ silent: true });
  event.preventDefault();
  await addImageFiles(files);
}

async function addImageFiles(files) {
  const note = getSelectedNote();
  if (!note) return;

  const images = await Promise.all(files.map(fileToAttachment));
  note.attachments = [...(note.attachments || []), ...images];
  note.updatedAt = new Date().toISOString();
  await putItem("notes", note);
  renderAttachments();
  renderAll({ keepEditor: true });
  showToast(`已添加 ${images.length} 张图片`);
}

function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: crypto.randomUUID(),
        name: file.name || `截图-${formatFileDate(new Date())}.png`,
        type: file.type || "image/png",
        size: file.size,
        dataUrl: reader.result,
        createdAt: new Date().toISOString(),
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function renderAttachments() {
  const note = getSelectedNote();
  const attachments = note?.attachments || [];
  if (!attachments.length) {
    els.attachments.innerHTML = "";
    return;
  }

  els.attachments.innerHTML = attachments
    .map(
      (attachment) => `
        <article class="attachment-card">
          <img src="${escapeAttr(attachment.dataUrl)}" alt="${escapeAttr(attachment.name || "图片附件")}" />
          <div class="attachment-info">
            <span class="attachment-meta">${escapeHtml(attachment.name || "图片附件")} · ${formatBytes(attachment.size || 0)}</span>
            <button class="icon-button attachment-remove danger" type="button" title="移除图片" aria-label="移除图片" data-attachment-id="${escapeAttr(
              attachment.id
            )}">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M4 7h16"></path>
                <path d="M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"></path>
              </svg>
            </button>
          </div>
        </article>
      `
    )
    .join("");

  els.attachments.querySelectorAll("[data-attachment-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const selected = getSelectedNote();
      selected.attachments = (selected.attachments || []).filter((item) => item.id !== button.dataset.attachmentId);
      selected.updatedAt = new Date().toISOString();
      await putItem("notes", selected);
      renderAttachments();
      renderAll({ keepEditor: true });
      showToast("已移除图片");
    });
  });
}

function openCategoryDialog(categoryId = null) {
  const category = state.categories.find((item) => item.id === categoryId);
  state.editingCategoryId = categoryId;
  els.categoryDialogTitle.textContent = category ? "编辑分类" : "新建分类";
  els.categoryNameInput.value = category?.name || "";
  els.categoryColorInput.value = category?.color || "#16756b";
  els.deleteCategoryBtn.classList.toggle("hidden", !category);
  els.categoryDialog.classList.remove("hidden");
  els.categoryNameInput.focus();
}

function closeCategoryDialog() {
  state.editingCategoryId = null;
  els.categoryDialog.classList.add("hidden");
}

async function saveCategoryFromDialog() {
  const name = els.categoryNameInput.value.trim();
  if (!name) {
    showToast("请输入分类名称");
    return;
  }

  const now = new Date().toISOString();
  const existing = state.categories.find((item) => item.id === state.editingCategoryId);
  const category = {
    id: existing?.id || crypto.randomUUID(),
    name,
    color: els.categoryColorInput.value,
    order: existing?.order || Date.now(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await putItem("categories", category);
  await loadAllData();
  closeCategoryDialog();
  renderAll({ keepEditor: true });
  showToast(existing ? "分类已更新" : "分类已创建");
}

async function deleteCategoryFromDialog() {
  const id = state.editingCategoryId;
  if (!id) return;
  if (state.categories.length <= 1) {
    showToast("至少保留一个分类");
    return;
  }

  const category = state.categories.find((item) => item.id === id);
  if (!category || !confirm(`删除分类“${category.name}”？`)) return;

  const fallback = state.categories.find((item) => item.id !== id);
  const affectedNotes = state.notes.filter((note) => note.categoryId === id);
  await Promise.all(
    affectedNotes.map((note) => {
      note.categoryId = fallback.id;
      note.updatedAt = new Date().toISOString();
      return putItem("notes", note);
    })
  );
  await deleteItem("categories", id);
  state.activeCategoryId = state.activeCategoryId === id ? null : state.activeCategoryId;
  await loadAllData();
  closeCategoryDialog();
  renderAll();
  showToast("分类已删除");
}

function exportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: state.categories,
    notes: state.notes,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `codenote-backup-${formatFileDate(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("已导出备份");
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const payload = JSON.parse(reader.result);
      const categories = Array.isArray(payload.categories) ? payload.categories : [];
      const notes = Array.isArray(payload.notes) ? payload.notes : [];
      if (!categories.length && !notes.length) throw new Error("invalid data");

      await Promise.all(categories.map((category) => putItem("categories", category)));
      await Promise.all(notes.map((note) => putItem("notes", normalizeImportedNote(note))));
      await loadAllData();
      state.selectedNoteId = notes[0]?.id || state.selectedNoteId;
      renderAll();
      showToast("导入完成");
    } catch (error) {
      console.error(error);
      showToast("导入文件格式不正确");
    } finally {
      els.importInput.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
}

function normalizeImportedNote(note) {
  const now = new Date().toISOString();
  return {
    id: note.id || crypto.randomUUID(),
    title: note.title || "未命名笔记",
    body: note.body || "",
    categoryId: note.categoryId || state.categories[0]?.id || "cat-other",
    status: note.status || "learning",
    level: String(note.level || "2"),
    source: note.source || "",
    tags: Array.isArray(note.tags) ? note.tags : parseTags(note.tags || ""),
    attachments: Array.isArray(note.attachments) ? note.attachments : [],
    pinned: Boolean(note.pinned),
    archived: Boolean(note.archived),
    createdAt: note.createdAt || now,
    updatedAt: note.updatedAt || now,
  };
}

function handleKeyboard(event) {
  const isMeta = event.ctrlKey || event.metaKey;
  if (isMeta && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveSelectedNow().then(() => showToast("已保存"));
  }
  if (isMeta && event.key.toLowerCase() === "n") {
    event.preventDefault();
    createNote();
  }
  if (event.key === "Escape" && !els.categoryDialog.classList.contains("hidden")) {
    closeCategoryDialog();
  }
}

function renderMarkdown(text) {
  if (!text.trim()) return `<p class="empty-state">暂无内容</p>`;

  const lines = text.split(/\r?\n/);
  const html = [];
  let inCode = false;
  let codeLines = [];
  let codeLang = "";
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        html.push(renderCodeBlock(codeLines.join("\n"), codeLang));
        codeLines = [];
        codeLang = "";
        inCode = false;
      } else {
        closeList();
        inCode = true;
        codeLang = line.trim().slice(3).trim().split(/\s+/)[0] || "text";
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)/);
    const bullet = line.match(/^[-*]\s+(.+)/);
    const quote = line.match(/^>\s?(.+)/);

    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${formatInline(heading[2])}</h${level}>`);
    } else if (bullet) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${formatInline(bullet[1])}</li>`);
    } else if (quote) {
      closeList();
      html.push(`<blockquote>${formatInline(quote[1])}</blockquote>`);
    } else {
      closeList();
      html.push(`<p>${formatInline(line)}</p>`);
    }
  }

  closeList();
  if (inCode) {
    html.push(renderCodeBlock(codeLines.join("\n"), codeLang));
  }

  return html.join("");
}

function renderCodeBlock(code, language = "text") {
  const lang = language.toLowerCase();
  const label = getLanguageLabel(lang);
  return `
    <figure class="code-block">
      <figcaption>
        <span>${escapeHtml(label)}</span>
        <i></i>
      </figcaption>
      <pre><code class="language-${escapeAttr(lang || "text")}">${highlightCode(code, lang)}</code></pre>
    </figure>
  `;
}

function getLanguageLabel(language) {
  const labels = {
    js: "JavaScript",
    javascript: "JavaScript",
    ts: "TypeScript",
    typescript: "TypeScript",
    html: "HTML",
    xml: "XML",
    css: "CSS",
    java: "Java",
    py: "Python",
    python: "Python",
    json: "JSON",
    sql: "SQL",
    bash: "Shell",
    shell: "Shell",
    text: "Code",
  };
  return labels[language] || language || "Code";
}

function highlightCode(code, language) {
  if (["html", "xml"].includes(language)) return highlightHtmlCode(code);
  if (language === "css") return highlightCssCode(code);
  return highlightGenericCode(code);
}

function highlightGenericCode(code) {
  const keywords = new Set([
    "abstract",
    "async",
    "await",
    "boolean",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "implements",
    "import",
    "in",
    "instanceof",
    "interface",
    "let",
    "new",
    "null",
    "private",
    "protected",
    "public",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "undefined",
    "var",
    "void",
    "while",
    "yield",
  ]);
  const tokenPattern = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b/g;
  return applyTokenHighlight(code, tokenPattern, (token, index) => {
    if (token.startsWith("//") || token.startsWith("/*")) return "syntax-comment";
    if (/^["'`]/.test(token)) return "syntax-string";
    if (/^\d/.test(token)) return "syntax-number";
    if (keywords.has(token)) return "syntax-keyword";
    if (/^\s*\(/.test(code.slice(index + token.length))) return "syntax-function";
    return "";
  });
}

function highlightCssCode(code) {
  const tokenPattern = /\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms)?\b|[A-Za-z_-][\w-]*(?=\s*:)/g;
  return applyTokenHighlight(code, tokenPattern, (token) => {
    if (token.startsWith("/*")) return "syntax-comment";
    if (/^["']/.test(token)) return "syntax-string";
    if (token.startsWith("#") || /^\d/.test(token)) return "syntax-number";
    return "syntax-keyword";
  });
}

function highlightHtmlCode(code) {
  const tokenPattern = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
  return applyTokenHighlight(code, tokenPattern, (token) => {
    if (token.startsWith("<!--")) return "syntax-comment";
    if (/^["']/.test(token)) return "syntax-string";
    if (token.startsWith("<")) return "syntax-keyword";
    return "";
  });
}

function applyTokenHighlight(code, tokenPattern, classify) {
  let html = "";
  let lastIndex = 0;
  for (const match of code.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index || 0;
    html += escapeHtml(code.slice(lastIndex, index));
    const className = classify(token, index);
    html += className ? `<span class="${className}">${escapeHtml(token)}</span>` : escapeHtml(token);
    lastIndex = index + token.length;
  }
  html += escapeHtml(code.slice(lastIndex));
  return html;
}

function formatInline(text) {
  let safe = escapeHtml(text);
  safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  safe = safe.replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return safe;
}

function parseTags(value) {
  return [...new Set(String(value).split(/[,，#\s]+/).map((tag) => tag.trim()).filter(Boolean))].slice(0, 24);
}

function makeExcerpt(value) {
  const text = String(value || "").replace(/```[\s\S]*?```/g, "代码片段").replace(/\s+/g, " ").trim();
  return text || "暂无正文";
}

function getCategory(id) {
  return state.categories.find((category) => category.id === id) || state.categories[0] || null;
}

function getCategoryName(id) {
  return getCategory(id)?.name || "未分类";
}

function getViewLabel(view) {
  return {
    all: "全部笔记",
    pinned: "置顶",
    review: "待复习",
    archived: "归档",
  }[view];
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function formatFileDate(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(
    date.getHours()
  ).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatBytes(bytes) {
  if (!bytes) return "图片";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}
