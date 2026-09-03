// ============================================================
// STOCKBOOK OS — authentication
// ============================================================
import { supabase } from "./supabase.js";
import { showToast, gotoView } from "./utils.js";

// ------------------------------------------------------------
// Sign-up draft persistence (IndexedDB)
//
// This does NOT authenticate anyone — Supabase Auth remains the
// only source of truth for accounts and sessions. It just saves
// what someone has typed into the sign-up form (name, business,
// phone, email — never the password) so a dropped connection or
// accidental reload doesn't cost them their progress.
// ------------------------------------------------------------
const DB_NAME = "stockbook_drafts";
const STORE = "signup_draft";

function openDraftDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDraft(fields) {
  try {
    const db = await openDraftDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(fields, "current");
  } catch { /* best-effort only */ }
}

async function loadDraft() {
  try {
    const db = await openDraftDB();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get("current");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function clearDraft() {
  try {
    const db = await openDraftDB();
    db.transaction(STORE, "readwrite").objectStore(STORE).delete("current");
  } catch { /* ignore */ }
}

// Restore any saved draft into the sign-up form on load.
(async () => {
  const draft = await loadDraft();
  if (!draft) return;
  if (draft.fullName) document.getElementById("suFullName").value = draft.fullName;
  if (draft.businessName) document.getElementById("suBusinessName").value = draft.businessName;
  if (draft.phone) document.getElementById("suPhone").value = draft.phone;
  if (draft.email) document.getElementById("suEmail").value = draft.email;
})();

// Save as the person types (debounced via input events, non-sensitive fields only).
["suFullName", "suBusinessName", "suPhone", "suEmail"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", () => {
    saveDraft({
      fullName: document.getElementById("suFullName").value,
      businessName: document.getElementById("suBusinessName").value,
      phone: document.getElementById("suPhone").value,
      email: document.getElementById("suEmail").value,
    });
  });
});

// ---- view wiring ----
document.getElementById("getStartedBtn")?.addEventListener("click", () => gotoView("signUp"));
document.getElementById("signInBtn")?.addEventListener("click", () => gotoView("signIn"));
document.querySelectorAll("[data-goto]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    gotoView(link.dataset.goto);
  });
});

function setError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!message) {
    el.classList.remove("show");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.classList.add("show");
}

// ---- redirect straight to dashboard if already signed in ----
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) window.location.href = "dashboard.html";
})();

// ---- sign up ----
document.getElementById("signUpForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("signUpError", "");

  const fullName = document.getElementById("suFullName").value.trim();
  const businessName = document.getElementById("suBusinessName").value.trim();
  const phone = document.getElementById("suPhone").value.trim();
  const email = document.getElementById("suEmail").value.trim();
  const password = document.getElementById("suPassword").value;

  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account…";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone, business_name: businessName } },
  });

  if (error) {
    setError("signUpError", error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "Create account";
    return;
  }

  // Two possible outcomes depending on your Supabase project's email
  // confirmation setting:
  //  - data.session exists  -> user is signed in immediately
  //  - data.session is null -> confirmation email was sent, no session yet
  if (!data.session) {
    clearDraft();
    document.getElementById("signUpForm").style.display = "none";
    const notice = document.createElement("div");
    notice.style.cssText = "background:var(--verified-soft); color:var(--verified); font-size:0.88rem; padding:14px; border-radius:var(--radius-sm); line-height:1.5;";
    notice.textContent = `Account created for ${email}. Check your inbox to confirm your address, then sign in.`;
    document.getElementById("signUpForm").after(notice);
    showToast("Confirmation email sent", "success");
    return;
  }

  const user = data.user;
  // Note: profile + business + settings are created server-side by a
  // database trigger the instant the account row is inserted — no
  // client-side race with email confirmation timing anymore.

  showToast("Account created — welcome to Stockbook OS.", "success");
  clearDraft();
  window.location.href = "dashboard.html";
});

// ---- sign in ----
document.getElementById("signInForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("signInError", "");

  const email = document.getElementById("siEmail").value.trim();
  const password = document.getElementById("siPassword").value;

  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Signing in…";

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setError("signInError", error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign in";
    return;
  }

  window.location.href = "dashboard.html";
});

// ---- forgot password ----
document.getElementById("forgotPasswordForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("fpError", "");
  const email = document.getElementById("fpEmail").value.trim();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/reset-password.html",
  });

  if (error) {
    setError("fpError", error.message);
    return;
  }
  document.getElementById("fpSuccess").style.display = "block";
  e.target.reset();
});
