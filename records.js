// ============================================================
// STOCKBOOK OS — record book (ledger)
// ============================================================
import { supabase, getCurrentBusiness } from "./supabase.js";

const business = await getCurrentBusiness();
if (!business) {
  const main = document.querySelector(".main-content");
  if (main) main.innerHTML = '<div class="card" style="padding:32px; text-align:center; color:var(--stone);">Setting up your business profile — refresh in a moment. If this persists, sign out and back in.</div>';
}
const businessId = business?.id;
let allRecords = [];

const typeLabels = {
  sale: "💰 Sale",
  purchase: "🛒 Purchase",
  stock_added: "📦 Stock added",
  stock_removed: "➖ Stock removed",
  adjustment: "✏️ Adjustment",
};

async function loadRecords() {
  const { data } = await supabase
    .from("inventory_transactions")
    .select("id,type,description,quantity_change,created_at,products(name)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  allRecords = data || [];
  render(allRecords);
}

function render(list) {
  const body = document.getElementById("recordsBody");
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="4" style="color:var(--stone);">No activity recorded yet.</td></tr>`;
    return;
  }
  body.innerHTML = list
    .map(
      (r) => `<tr>
        <td>${new Date(r.created_at).toLocaleString("en-NG")}</td>
        <td>${typeLabels[r.type] || r.type}</td>
        <td>${r.products?.name ? r.products.name + " — " : ""}${r.description || ""}</td>
        <td style="color:${r.quantity_change < 0 ? "var(--alert)" : "var(--verified)"};">${r.quantity_change > 0 ? "+" : ""}${r.quantity_change}</td>
      </tr>`
    )
    .join("");
}

function applyFilters() {
  const q = document.getElementById("recordSearch").value.trim().toLowerCase();
  const date = document.getElementById("recordDate").value;
  const type = document.getElementById("recordType").value;

  let list = allRecords;
  if (q) list = list.filter((r) => (r.description || "").toLowerCase().includes(q) || (r.products?.name || "").toLowerCase().includes(q));
  if (date) list = list.filter((r) => r.created_at.startsWith(date));
  if (type) list = list.filter((r) => r.type === type);
  render(list);
}

document.getElementById("recordSearch")?.addEventListener("input", applyFilters);
document.getElementById("recordDate")?.addEventListener("change", applyFilters);
document.getElementById("recordType")?.addEventListener("change", applyFilters);

document.getElementById("exportBtn")?.addEventListener("click", () => {
  const rows = [["Date", "Type", "Description", "Quantity change"]];
  allRecords.forEach((r) =>
    rows.push([new Date(r.created_at).toISOString(), r.type, `${r.products?.name || ""} ${r.description || ""}`.trim(), r.quantity_change])
  );
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "stockbook-record-book.csv";
  a.click();
  URL.revokeObjectURL(url);
});

if (business) loadRecords();
