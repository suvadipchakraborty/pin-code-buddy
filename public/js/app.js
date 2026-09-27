// PIN Code Buddy — app logic
// No build step, no framework: plain DOM + fetch.

const API_BASE = "https://api.postalpincode.in/pincode/";
const RECENTS_KEY = "pinBuddy.recents";
const RECENTS_MAX = 8;
const APP_URL = "https://pin-code-buddy.suvadipchakraborty.workers.dev/";
const FEEDBACK_EMAIL = "suvadipchakraborty@gmail.com";

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

const els = {
  form: document.getElementById("pin-form"),
  input: document.getElementById("pin-input"),
  inputShell: document.getElementById("input-shell"),
  goBtn: document.getElementById("go-btn"),
  error: document.getElementById("pin-error"),
  postmark: document.getElementById("postmark"),
  digitSlots: Array.from(document.querySelectorAll(".digit-slot")),
  recentWrap: document.getElementById("recent-wrap"),
  recentChips: document.getElementById("recent-chips"),
  stateEmpty: document.getElementById("state-empty"),
  stateLoading: document.getElementById("state-loading"),
  stateError: document.getElementById("state-error"),
  stateResults: document.getElementById("state-results"),
  errorMessage: document.getElementById("error-message"),
  resultsSummary: document.getElementById("results-summary"),
  cardList: document.getElementById("card-list"),
  toast: document.getElementById("toast"),
  tabBtns: Array.from(document.querySelectorAll(".tab-btn")),
  panels: Array.from(document.querySelectorAll(".panel")),
};

// ---------------------------------------------------------------------------
// Feedback mailto links
// ---------------------------------------------------------------------------

function buildFeedbackHref() {
  const subject = encodeURIComponent("PIN Code Buddy feedback");
  const body = encodeURIComponent("Hey Suva,\n\n");
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
}

["feedback-link-home", "feedback-link-about"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.href = buildFeedbackHref();
});

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function showTab(target) {
  els.panels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== target;
  });
  els.tabBtns.forEach((btn) => {
    if (btn.dataset.target === target) {
      btn.setAttribute("aria-current", "page");
    } else {
      btn.removeAttribute("aria-current");
    }
  });
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

els.tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.target));
});

// ---------------------------------------------------------------------------
// Input handling: digits-only, postmark fill, haptics, auto-submit
// ---------------------------------------------------------------------------

function haptic(pattern) {
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (_) { /* no-op */ }
  }
}

function updatePostmark(value) {
  els.digitSlots.forEach((slot, i) => {
    slot.classList.toggle("filled", i < value.length);
  });
}

function setGoReady(ready) {
  els.goBtn.classList.toggle("ready", ready);
}

let stampedOnce = false;

els.input.addEventListener("input", () => {
  const digitsOnly = els.input.value.replace(/\D/g, "").slice(0, 6);
  if (digitsOnly !== els.input.value) els.input.value = digitsOnly;

  hideError();
  updatePostmark(digitsOnly);
  setGoReady(digitsOnly.length === 6);

  if (digitsOnly.length === 6 && !stampedOnce) {
    stampedOnce = true;
    els.postmark.classList.add("stamped");
    haptic(18);
    setTimeout(() => els.postmark.classList.remove("stamped"), 450);
    lookup(digitsOnly);
  }
  if (digitsOnly.length < 6) {
    stampedOnce = false;
  }
});

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = els.input.value.trim();
  if (value.length !== 6) {
    showError("A PIN code is 6 digits — you've entered " + value.length + ".");
    els.inputShell.classList.remove("shake");
    // restart animation
    void els.inputShell.offsetWidth;
    els.inputShell.classList.add("shake");
    haptic([12, 40, 12]);
    return;
  }
  lookup(value);
});

function showError(message) {
  els.error.textContent = message;
  els.error.hidden = false;
}
function hideError() {
  els.error.hidden = true;
}

// ---------------------------------------------------------------------------
// Recent searches (localStorage)
// ---------------------------------------------------------------------------

function getRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveRecent(pin, placeLabel) {
  try {
    let list = getRecents().filter((r) => r.pin !== pin);
    list.unshift({ pin, label: placeLabel || "" });
    list = list.slice(0, RECENTS_MAX);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
    renderRecents();
  } catch (_) { /* storage unavailable — silently skip */ }
}

function renderRecents() {
  const list = getRecents();
  if (!list.length) {
    els.recentWrap.hidden = true;
    return;
  }
  els.recentWrap.hidden = false;
  els.recentChips.innerHTML = "";
  list.forEach(({ pin, label }) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = label ? `${pin} · ${label}` : pin;
    chip.addEventListener("click", () => {
      els.input.value = pin;
      updatePostmark(pin);
      setGoReady(true);
      stampedOnce = true;
      lookup(pin);
    });
    els.recentChips.appendChild(chip);
  });
}

// ---------------------------------------------------------------------------
// Lookup + render states
// ---------------------------------------------------------------------------

function setState(name) {
  els.stateEmpty.hidden = name !== "empty";
  els.stateLoading.hidden = name !== "loading";
  els.stateError.hidden = name !== "error";
  els.stateResults.hidden = name !== "results";
}

let activeRequestId = 0;

async function lookup(pin) {
  const requestId = ++activeRequestId;
  setState("loading");

  try {
    const res = await fetch(API_BASE + encodeURIComponent(pin));
    if (requestId !== activeRequestId) return; // a newer lookup superseded this one
    if (!res.ok) throw new Error("network");

    const data = await res.json();
    if (requestId !== activeRequestId) return;

    const payload = Array.isArray(data) ? data[0] : data;

    if (!payload || payload.Status !== "Success" || !Array.isArray(payload.PostOffice) || !payload.PostOffice.length) {
      setState("error");
      els.errorMessage.textContent =
        payload && payload.Status === "Error"
          ? "That PIN code didn't turn up any post offices. Double-check the digits and try again."
          : "No post offices found for that PIN code.";
      return;
    }

    renderResults(pin, payload.PostOffice);
    const first = payload.PostOffice[0];
    saveRecent(pin, first.District || first.Name);
    setState("results");
  } catch (err) {
    if (requestId !== activeRequestId) return;
    setState("error");
    els.errorMessage.textContent = "Couldn't reach India Post's lookup right now. Check your connection and try again.";
  }
}

function renderResults(pin, offices) {
  els.resultsSummary.innerHTML = `<strong>${offices.length}</strong> post office${offices.length > 1 ? "s" : ""} share PIN <strong>${pin}</strong>`;
  els.cardList.innerHTML = "";

  offices.forEach((po) => {
    els.cardList.appendChild(buildCard(pin, po));
  });
}

function buildCard(pin, po) {
  const li = document.createElement("li");
  li.className = "po-card";

  const isDelivery = /delivery/i.test(po.DeliveryStatus || "") && !/non/i.test(po.DeliveryStatus || "");
  const statusLabel = po.DeliveryStatus
    ? po.DeliveryStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Status unavailable";

  li.innerHTML = `
    <div class="po-card-top">
      <div>
        <div class="po-name">${escapeHtml(po.Name || "Unnamed office")}</div>
        <div class="po-branch">${escapeHtml(po.BranchType || "")}</div>
      </div>
      <button type="button" class="share-btn" aria-label="Share this post office">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><circle cx="18" cy="5" r="2.6" stroke="currentColor" stroke-width="1.7"/><circle cx="6" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="19" r="2.6" stroke="currentColor" stroke-width="1.7"/><path d="M8.3 10.7l7.4-4.2M8.3 13.3l7.4 4.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      </button>
    </div>
    <dl class="po-meta">
      <dt>District</dt><dd>${escapeHtml(po.District || "—")}</dd>
      <dt>State</dt><dd>${escapeHtml(po.State || "—")}</dd>
      <dt>Division</dt><dd>${escapeHtml(po.Division || "—")}</dd>
      <dt>Circle</dt><dd>${escapeHtml(po.Circle || "—")}</dd>
    </dl>
    <div class="status-row">
      <span class="status-pill ${isDelivery ? "" : "non-delivery"}">${escapeHtml(statusLabel)}</span>
      <span class="pincode-pill">${escapeHtml(po.Pincode || pin)}</span>
    </div>
  `;

  li.querySelector(".share-btn").addEventListener("click", () => sharePostOffice(pin, po));
  return li;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

async function sharePostOffice(pin, po) {
  const text = `${po.Name} (${po.BranchType}) — ${po.District}, ${po.State}\nPIN: ${pin} · ${po.DeliveryStatus || ""}\n\nLooked up on PIN Code Buddy:`;
  const shareData = { title: "PIN Code Buddy", text, url: APP_URL };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (_) {
      /* user cancelled — no-op */
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(`${text} ${APP_URL}`);
    showToast("Copied to clipboard");
  } catch (_) {
    showToast("Couldn't share on this device");
  }
}

let toastTimer;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

renderRecents();
setState("empty");
els.input.focus({ preventScroll: true });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* PWA is a bonus, not required */ });
  });
}
