// ============================================================
// STOCKBOOK OS — shared utilities
// ============================================================

/** Show a quiet toast in the bottom-right stack. */
export function showToast(message, kind = "info") {
  const stack = document.getElementById("toastStack");
  if (!stack) return;
  const icons = { info: "☁️", success: "✅", warning: "🟡", error: "🔴" };
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${icons[kind] || icons.info}</span><span>${message}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 3800);
}

/** Switch between full-page views on a single-page shell (welcome/signup/signin/etc). */
export function gotoView(viewId) {
  document.querySelectorAll("[id$='View']").forEach((el) => {
    el.style.display = "none";
  });
  const target = document.getElementById(viewId + "View");
  if (target) target.style.display = "";
}

/** Animate a numeric value counting up smoothly. Call once elements are in the DOM. */
export function animateCount(el, endValue, { prefix = "", duration = 900 } = {}) {
  const start = performance.now();
  const startValue = 0;
  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = startValue + (endValue - startValue) * eased;
    el.textContent = prefix + Math.round(current).toLocaleString("en-NG");
    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      el.classList.add("counted");
    }
  }
  el.classList.add("counted");
  requestAnimationFrame(frame);
}

/** Wire up the offline detection banner. Call once per page. */
export function initOfflineDetection() {
  const banner = document.getElementById("offlineBanner");
  if (!banner) return;
  function update() {
    banner.classList.toggle("show", !navigator.onLine);
  }
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

/** Applies saved theme preference (light/dark) on page load. */
export function applyStoredTheme() {
  const theme = localStorage.getItem("stockbook_theme") || "light";
  if (theme === "dark") document.body.setAttribute("data-theme", "dark");
}

/** Toggles and persists theme preference. */
export function toggleTheme() {
  const isDark = document.body.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.body.removeAttribute("data-theme");
    localStorage.setItem("stockbook_theme", "light");
  } else {
    document.body.setAttribute("data-theme", "dark");
    localStorage.setItem("stockbook_theme", "dark");
  }
}

/** Briefly flashes a quiet, premium success indicator across the screen. */
export function flashSuccess() {
  const el = document.createElement("div");
  el.className = "success-flash";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

initOfflineDetection();
applyStoredTheme();

// Numeric fields use type="text" + inputmode="decimal" instead of
// type="number" — some embedded WebView previews (code-editor apps,
// in-app browsers) don't reliably open a numeric keyboard for
// type="number". This restores the same guarantee (digits + one
// decimal point only) without relying on that input type.
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.tagName === "INPUT" && el.getAttribute("inputmode") === "decimal") {
    const cleaned = el.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    if (cleaned !== el.value) el.value = cleaned;
  }
});

// Mascot subtly tracks the cursor — small, quiet life in the character.
document.addEventListener("mousemove", (e) => {
  document.querySelectorAll(".mascot-body").forEach((body) => {
    const rect = body.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 400));
    const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 400));
    body.style.setProperty("--tilt-x", `${dx * 3}px`);
    body.style.setProperty("--tilt-y", `${dy * 2}px`);
  });
});
