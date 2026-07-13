(function () {
  "use strict";

  var STORAGE_KEY = "focusAppState";
  var MAX_TASKS = 5;
  var CARRY_PROMPT_THRESHOLD = 3;

  // ---------- Date helpers ----------

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function toDateStr(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function todayStr() {
    return toDateStr(new Date());
  }

  function yesterdayStr() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return toDateStr(d);
  }

  function formatDisplayDate(dateStr) {
    var parts = dateStr.split("-").map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ---------- State ----------

  function defaultState() {
    return { tasks: [], history: [], lastCheckInDate: null };
  }

  function loadState() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    try {
      var parsed = JSON.parse(raw);
      if (!parsed.tasks) parsed.tasks = [];
      if (!parsed.history) parsed.history = [];
      if (parsed.lastCheckInDate === undefined) parsed.lastCheckInDate = null;
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  var state = loadState();

  // ---------- Greeting ----------

  function renderGreeting() {
    var textEl = document.getElementById("greeting-text");
    var dateEl = document.getElementById("greeting-date");

    var msg;
    var yStr = yesterdayStr();

    if (state.history.length === 0 && state.lastCheckInDate === null) {
      msg = "New here — let's set today's focus.";
    } else if (state.lastCheckInDate !== yStr) {
      msg = "No check-in yesterday — today's list is a guess, not a plan.";
    } else {
      var entry = null;
      for (var i = state.history.length - 1; i >= 0; i--) {
        if (state.history[i].date === yStr) { entry = state.history[i]; break; }
      }
      if (!entry) {
        msg = "No check-in yesterday — today's list is a guess, not a plan.";
      } else if (entry.tasksTotal === 0) {
        msg = "No tasks logged yesterday. Let's set some today.";
      } else if (entry.tasksCompleted >= entry.tasksTotal) {
        msg = "Clean sweep yesterday. Let's keep it that way.";
      } else {
        msg = "You closed " + entry.tasksCompleted + " of " + entry.tasksTotal + " yesterday — let's fix that today.";
      }
    }

    textEl.textContent = msg;
    dateEl.textContent = formatDisplayDate(todayStr());
  }

  // ---------- Tasks ----------

  function sortedTasks() {
    var tasks = state.tasks.slice();
    tasks.sort(function (a, b) {
      var aCarried = a.carriedOverCount > 0 ? 0 : 1;
      var bCarried = b.carriedOverCount > 0 ? 0 : 1;
      return aCarried - bCarried;
    });
    return tasks;
  }

  function buildTaskRow(task, listIdPrefix) {
    var li = document.createElement("li");
    li.className = "task-row" + (task.carriedOverCount > 0 ? " carried" : "");

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", function () {
      toggleTaskDone(task.id, checkbox.checked);
    });

    var textWrap = document.createElement("div");
    textWrap.style.flex = "1";

    var span = document.createElement("span");
    span.className = "task-text" + (task.done ? " done" : "");
    span.textContent = task.text;
    textWrap.appendChild(span);

    if (task.carriedOverCount > 0) {
      var badge = document.createElement("div");
      badge.className = "task-carry-badge";
      badge.textContent = "Carried over " + task.carriedOverCount + " day" + (task.carriedOverCount > 1 ? "s" : "");
      textWrap.appendChild(badge);
    }

    var delBtn = document.createElement("button");
    delBtn.className = "task-delete";
    delBtn.setAttribute("aria-label", "Delete task");
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", function () {
      removeTask(task.id);
    });

    li.appendChild(checkbox);
    li.appendChild(textWrap);
    li.appendChild(delBtn);
    return li;
  }

  function buildCarryPrompt(task) {
    var wrap = document.createElement("div");
    wrap.className = "carry-prompt";
    wrap.innerHTML = "Carried over " + task.carriedOverCount + " days — still relevant?";

    var actions = document.createElement("div");
    actions.className = "carry-prompt-actions";

    var keepBtn = document.createElement("button");
    keepBtn.className = "keep";
    keepBtn.textContent = "Keep";
    keepBtn.addEventListener("click", function () {
      acknowledgeCarry(task.id);
    });

    var dropBtn = document.createElement("button");
    dropBtn.textContent = "Drop";
    dropBtn.addEventListener("click", function () {
      removeTask(task.id);
    });

    actions.appendChild(keepBtn);
    actions.appendChild(dropBtn);
    wrap.appendChild(actions);
    return wrap;
  }

  function renderTasks() {
    var list = document.getElementById("task-list");
    var checkinList = document.getElementById("checkin-task-list");
    list.innerHTML = "";
    checkinList.innerHTML = "";

    var tasks = sortedTasks();

    if (tasks.length === 0) {
      var empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "No tasks yet — add up to 5 below.";
      list.appendChild(empty);

      var empty2 = document.createElement("li");
      empty2.className = "empty-state";
      empty2.textContent = "No tasks to check in on.";
      checkinList.appendChild(empty2);
    }

    tasks.forEach(function (task) {
      list.appendChild(buildTaskRow(task));
      checkinList.appendChild(buildTaskRow(task));

      if (task.carriedOverCount >= CARRY_PROMPT_THRESHOLD && task.carryPromptAckAt !== task.carriedOverCount) {
        var promptRow = document.createElement("li");
        promptRow.style.listStyle = "none";
        promptRow.appendChild(buildCarryPrompt(task));
        list.appendChild(promptRow);
      }
    });

    var limitNote = document.getElementById("task-limit-note");
    limitNote.style.display = tasks.length >= MAX_TASKS ? "block" : "none";
  }

  function toggleTaskDone(id, done) {
    var task = state.tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    task.done = done;
    saveState(state);
    renderTasks();
  }

  function removeTask(id) {
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    saveState(state);
    renderTasks();
  }

  function acknowledgeCarry(id) {
    var task = state.tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    task.carryPromptAckAt = task.carriedOverCount;
    saveState(state);
    renderTasks();
  }

  function addTask(text) {
    text = text.trim();
    if (!text) return;
    if (state.tasks.length >= MAX_TASKS) {
      var limitNote = document.getElementById("task-limit-note");
      limitNote.style.display = "block";
      return;
    }
    state.tasks.push({
      id: uuid(),
      text: text,
      done: false,
      carriedOverCount: 0,
      carryPromptAckAt: -1,
      createdDate: todayStr()
    });
    saveState(state);
    renderTasks();
  }

  // ---------- Digest ----------

  function renderDigest(data) {
    var container = document.getElementById("digest-content");
    container.innerHTML = "";

    if (!data || !Array.isArray(data.items) || data.items.length === 0) {
      var fallback = document.createElement("p");
      fallback.className = "digest-fallback";
      fallback.textContent = "No digest available right now.";
      container.appendChild(fallback);
      return;
    }

    data.items.slice(0, 5).forEach(function (item) {
      var div = document.createElement("div");
      div.className = "digest-item";

      var title = document.createElement("p");
      title.className = "digest-title";
      title.textContent = item.title || "";

      var why = document.createElement("p");
      why.className = "digest-why";
      why.textContent = item.why || "";

      div.appendChild(title);
      div.appendChild(why);
      container.appendChild(div);
    });

    if (data.generatedAt) {
      var meta = document.createElement("p");
      meta.className = "digest-meta";
      try {
        var d = new Date(data.generatedAt);
        meta.textContent = "Updated " + d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      } catch (e) {
        meta.textContent = "";
      }
      container.appendChild(meta);
    }
  }

  function loadDigest() {
    fetch("data/digest.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("bad response");
        return res.json();
      })
      .then(renderDigest)
      .catch(function () {
        var container = document.getElementById("digest-content");
        container.innerHTML = "";
        var fallback = document.createElement("p");
        fallback.className = "digest-fallback";
        fallback.textContent = "Digest unavailable right now (offline or not yet generated).";
        container.appendChild(fallback);
      });
  }

  // ---------- Check-in ----------

  function closeOutToday() {
    var today = todayStr();
    var feedbackEl = document.getElementById("feedback-note");
    var feedbackNote = feedbackEl.value.trim();

    var tasksTotal = state.tasks.length;
    var tasksCompleted = state.tasks.filter(function (t) { return t.done; }).length;

    var existingIdx = state.history.findIndex(function (h) { return h.date === today; });
    var entry = { date: today, tasksCompleted: tasksCompleted, tasksTotal: tasksTotal, feedbackNote: feedbackNote };
    if (existingIdx >= 0) {
      state.history[existingIdx] = entry;
    } else {
      state.history.push(entry);
    }

    state.lastCheckInDate = today;

    // Drop completed tasks; carry the rest forward.
    state.tasks = state.tasks
      .filter(function (t) { return !t.done; })
      .map(function (t) {
        t.carriedOverCount += 1;
        return t;
      });

    saveState(state);
    renderTasks();
    renderGreeting();

    var btn = document.getElementById("closeout-btn");
    var original = btn.textContent;
    btn.textContent = "Saved";
    btn.classList.add("saved");
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove("saved");
    }, 1800);
  }

  // ---------- Wiring ----------

  document.getElementById("add-task-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("new-task-input");
    addTask(input.value);
    input.value = "";
  });

  document.getElementById("closeout-btn").addEventListener("click", closeOutToday);

  renderGreeting();
  renderTasks();
  loadDigest();

  if (window.location.hash === "#checkin") {
    var target = document.getElementById("checkin");
    if (target) target.scrollIntoView();
  }

  // ---------- Service worker ----------

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
