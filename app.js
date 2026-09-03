// ============================================================
// STOCKBOOK OS — app shell (runs on every authenticated page)
// ============================================================
import { supabase, requireAuth, getCurrentBusiness } from "./supabase.js";
import { toggleTheme, showToast } from "./utils.js";

const session = await requireAuth();

if (session) {
  const business = await getCurrentBusiness();
  const label = document.getElementById("businessNameLabel");
  if (label) label.textContent = business ? business.name : "Your business";
}

document.getElementById("logoutLink")?.addEventListener("click", async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  window.location.href = "index.html";
});

document.getElementById("themeToggle")?.addEventListener("click", (e) => {
  toggleTheme();
  e.target.textContent = document.body.getAttribute("data-theme") === "dark" ? "☀️" : "🌙";
});

// Mobile menu drawer (full nav, since the floating bar only fits a few icons)
const drawerBackdrop = document.getElementById("mobileDrawerBackdrop");
document.getElementById("mobileMoreBtn")?.addEventListener("click", () => {
  drawerBackdrop?.classList.add("open");
});
drawerBackdrop?.addEventListener("click", (e) => {
  if (e.target === drawerBackdrop) drawerBackdrop.classList.remove("open");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") drawerBackdrop?.classList.remove("open");
});

// Command palette (Ctrl/Cmd + K) — global search shell.
// Product/customer/receipt search logic lives per-page; this wires the
// keyboard shortcut and modal chrome shared everywhere.
function openCommandPalette() {
  if (document.getElementById("commandPaletteBackdrop")) return;
  const backdrop = document.createElement("div");
  backdrop.id = "commandPaletteBackdrop";
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-panel">
      <input class="command-input" placeholder="Search products, customers, suppliers, receipts…" autofocus />
      <div class="command-results" id="commandResults"></div>
    </div>`;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  document.body.appendChild(backdrop);
  backdrop.querySelector("input").focus();

  backdrop.querySelector("input").addEventListener("input", async (e) => {
    const q = e.target.value.trim();
    const results = document.getElementById("commandResults");
    if (q.length < 2) { results.innerHTML = ""; return; }

    const [{ data: products }, { data: customers }] = await Promise.all([
      supabase.from("products").select("id,name").ilike("name", `%${q}%`).limit(5),
      supabase.from("customers").select("id,name").ilike("name", `%${q}%`).limit(5),
    ]);

    const items = [
      ...(products || []).map((p) => ({ label: p.name, type: "Product", href: `inventory.html?id=${p.id}` })),
      ...(customers || []).map((c) => ({ label: c.name, type: "Customer", href: `customers.html?id=${c.id}` })),
    ];

    results.innerHTML = items.length
      ? items.map((i) => `<a class="command-result" href="${i.href}"><span>${i.label}</span><span style="color:var(--stone);">${i.type}</span></a>`).join("")
      : `<div class="command-result" style="color:var(--stone);">No matches</div>`;
  });
}

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openCommandPalette();
  }
  if (e.key === "Escape") {
    document.getElementById("commandPaletteBackdrop")?.remove();
  }
});

document.getElementById("searchTrigger")?.addEventListener("click", openCommandPalette);

// Realtime: toast when inventory changes from another device/session.
supabase
  .channel("inventory-notify")
  .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
    showToast("Inventory updated", "info");
  })
  .subscribe();
