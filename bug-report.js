(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const form = $("#bugForm");
  const dateEl = $("#date");
  const timeEl = $("#time");
  const titleEl = $("#title");
  const descEl = $("#description");
  const shotEl = $("#screenshot");

  const dateErr = $("#dateError");
  const timeErr = $("#timeError");
  const titleErr = $("#titleError");
  const descErr = $("#descError");
  const shotErr = $("#shotError");

  const titleCount = $("#titleCount");
  const descCount = $("#descCount");

  const fileInfo = $("#fileInfo");
  const fileText = $("#fileText");
  const shotPreview = $("#shotPreview");
  const removeShotBtn = $("#removeShotBtn");

  const results = $("#results");
  const statusMsg = $("#statusMsg");
  const preview = $("#preview");
  const downloadBtn = $("#downloadBtn");
  const copyBtn = $("#copyBtn");

  const savedBanner = $("#savedBanner");
  const loadSavedBtn = $("#loadSavedBtn");
  const dismissBannerBtn = $("#dismissBannerBtn");

  const themeToggle = $("#themeToggle");
  const themeToggleIcon = $("#themeToggleIcon");
  const themeToggleText = $("#themeToggleText");

  let lastReport = null;

  function getCurrentTheme() {
    const attr = document.documentElement.getAttribute("data-theme");
    return attr === "light" || attr === "dark" ? attr : "dark";
  }

  function updateThemeToggle(theme) {
    const isDark = theme === "dark";
    if (themeToggleIcon) themeToggleIcon.textContent = isDark ? "🌙" : "☀️";
    if (themeToggleText) themeToggleText.textContent = isDark ? "Dark" : "Light";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch (_) {
      // ignore storage errors
    }
    updateThemeToggle(theme);
  }

  function bytesToHuman(bytes) {
    if (!Number.isFinite(bytes)) return "";
    const units = ["B", "KB", "MB", "GB"];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i += 1;
    }
    const val = i === 0 ? String(Math.round(n)) : n.toFixed(1);
    return `${val} ${units[i]}`;
  }

  function setError(inputEl, errEl, message) {
    errEl.textContent = message || "";
    const hasError = Boolean(message);
    inputEl.setAttribute("aria-invalid", hasError ? "true" : "false");
  }

  function clearErrors() {
    setError(dateEl, dateErr, "");
    setError(timeEl, timeErr, "");
    setError(titleEl, titleErr, "");
    setError(descEl, descErr, "");
    setError(shotEl, shotErr, "");
  }

  function validateRequired() {
    let ok = true;

    if (!dateEl.value) {
      setError(dateEl, dateErr, "Please choose a date.");
      ok = false;
    } else {
      setError(dateEl, dateErr, "");
    }

    if (!timeEl.value) {
      setError(timeEl, timeErr, "Please choose a time.");
      ok = false;
    } else {
      setError(timeEl, timeErr, "");
    }

    const t = titleEl.value.trim();
    if (!t) {
      setError(titleEl, titleErr, "Please enter a short title.");
      ok = false;
    } else {
      setError(titleEl, titleErr, "");
    }

    const d = descEl.value.trim();
    if (!d) {
      setError(descEl, descErr, "Please add a description.");
      ok = false;
    } else {
      setError(descEl, descErr, "");
    }

    return ok;
  }

  function updateCounts() {
    titleCount.textContent = `${titleEl.value.length}/80`;
    descCount.textContent = `${descEl.value.length}/2000`;
  }

  function resetScreenshotUI() {
    // clearing file input reliably needs value assignment
    shotEl.value = "";
    fileInfo.hidden = true;
    fileText.textContent = "";
    shotPreview.removeAttribute("src");
    shotPreview.style.display = "none";
    setError(shotEl, shotErr, "");
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });
  }

  function renderPreview(report) {
    preview.innerHTML = "";

    const items = [
      { k: "Created At", v: report.createdAt, full: false },
      { k: "Date", v: report.date, full: false },
      { k: "Time", v: report.time, full: false },
      { k: "Title", v: report.title, full: true },
      { k: "Description", v: report.description, full: true },
    ];

    if (report.screenshotName) {
      items.push({
        k: "Screenshot",
        v: `${report.screenshotName} (${bytesToHuman(report.screenshotSize)})`,
        full: true,
      });
    } else {
      items.push({ k: "Screenshot", v: "None", full: true });
    }

    for (const it of items) {
      const card = document.createElement("div");
      card.className = `kv ${it.full ? "kv--full" : ""}`.trim();

      const k = document.createElement("div");
      k.className = "kv__k";
      k.textContent = it.k;

      const v = document.createElement("div");
      v.className = "kv__v";
      v.textContent = it.v;

      card.appendChild(k);
      card.appendChild(v);
      preview.appendChild(card);
    }
  }

  function reportToMarkdown(report) {
    const lines = [];
    lines.push("## Bug Report");
    lines.push("");
    lines.push(`**Date:** ${report.date}`);
    lines.push(`**Time:** ${report.time}`);
    lines.push(`**Created At:** ${report.createdAt}`);
    lines.push("");
    lines.push("### Title");
    lines.push(report.title);
    lines.push("");
    lines.push("### Description");
    lines.push(report.description);
    lines.push("");
    if (report.screenshotName) {
      lines.push(
        "_Screenshot included in report.json as Data URL (base64)._"
      );
    }
    return lines.join("\n");
  }

  async function copyToClipboard(text) {
    // Prefer modern clipboard API, with fallback
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (_) {
      return false;
    }
  }

  function downloadJson(report) {
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "report.json";
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Revoke after a short delay so download can start
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function setResultsEnabled(enabled) {
    downloadBtn.disabled = !enabled;
    copyBtn.disabled = !enabled;
  }

  function showResults(message) {
    results.hidden = false;
    statusMsg.textContent = message || "";
    setResultsEnabled(Boolean(lastReport));
  }

  function saveToLocalStorage(report) {
    try {
      localStorage.setItem("lastBugReport", JSON.stringify(report));
    } catch (_) {
      // ignore storage errors (quota, private mode)
    }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem("lastBugReport");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function showSavedBannerIfNeeded() {
    const saved = loadFromLocalStorage();
    if (saved) {
      savedBanner.hidden = false;
    }
  }

  // Live counts
  titleEl.addEventListener("input", updateCounts);
  descEl.addEventListener("input", updateCounts);

  // Screenshot handling
  shotEl.addEventListener("change", async () => {
    setError(shotEl, shotErr, "");
    const file = shotEl.files && shotEl.files[0];
    if (!file) {
      resetScreenshotUI();
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError(shotEl, shotErr, "Please select an image file.");
      resetScreenshotUI();
      return;
    }

    fileInfo.hidden = false;
    fileText.textContent = `${file.name} • ${bytesToHuman(file.size)}`;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      shotPreview.src = dataUrl;
      shotPreview.style.display = "block";
    } catch (e) {
      setError(shotEl, shotErr, "Could not read that file. Try a different image.");
      resetScreenshotUI();
    }
  });

  removeShotBtn.addEventListener("click", () => {
    resetScreenshotUI();
  });

  // Reset behavior
  form.addEventListener("reset", () => {
    // Allow native reset to happen first
    setTimeout(() => {
      clearErrors();
      updateCounts();
      resetScreenshotUI();
      statusMsg.textContent = "";
      // Keep results visible if a report exists; otherwise hide
      if (!lastReport) results.hidden = true;
    }, 0);
  });

  // Submit behavior
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const ok = validateRequired();
    if (!ok) {
      // Focus first invalid field for accessibility
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      showResults("Please fix the highlighted fields.");
      statusMsg.style.color = "var(--danger)";
      return;
    }

    statusMsg.style.color = "var(--success)";

    const report = {
      date: dateEl.value,
      time: timeEl.value,
      title: titleEl.value.trim(),
      description: descEl.value.trim(),
      createdAt: new Date().toISOString(),
    };

    const file = shotEl.files && shotEl.files[0];
    if (file) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        report.screenshotName = file.name;
        report.screenshotType = file.type;
        report.screenshotSize = file.size;
        report.screenshotDataUrl = dataUrl;
      } catch (err) {
        // Still allow submission without screenshot if reading fails
        setError(shotEl, shotErr, "Screenshot could not be read; generating report without it.");
        resetScreenshotUI();
      }
    }

    lastReport = report;
    saveToLocalStorage(report);

    renderPreview(report);
    showResults("Report generated ✅");
    setResultsEnabled(true);
  });

  // Results actions
  downloadBtn.addEventListener("click", () => {
    if (!lastReport) return;
    downloadJson(lastReport);
  });

  copyBtn.addEventListener("click", async () => {
    if (!lastReport) return;
    const md = reportToMarkdown(lastReport);
    const ok = await copyToClipboard(md);
    statusMsg.textContent = ok ? "Markdown copied ✅" : "Could not copy automatically — please copy from your browser.";
    statusMsg.style.color = ok ? "var(--success)" : "var(--danger)";
  });

  // Saved banner actions
  loadSavedBtn.addEventListener("click", () => {
    const saved = loadFromLocalStorage();
    if (!saved) return;

    lastReport = saved;
    renderPreview(saved);
    results.hidden = false;
    statusMsg.textContent = "Loaded saved report ✅";
    statusMsg.style.color = "var(--success)";
    setResultsEnabled(true);

    // Scroll results into view
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  dismissBannerBtn.addEventListener("click", () => {
    savedBanner.hidden = true;
  });

  // Init
  if (themeToggle) {
    const initialTheme = getCurrentTheme();
    updateThemeToggle(initialTheme);
    themeToggle.addEventListener("click", () => {
      const nextTheme = getCurrentTheme() === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
    });
  }
  updateCounts();
  clearErrors();
  resetScreenshotUI();
  showSavedBannerIfNeeded();
})();
