// ============================================================
// STOCKBOOK OS — receipts
// ============================================================
import { supabase, getCurrentBusiness, formatNaira } from "./supabase.js";
import { showToast } from "./utils.js";

const business = await getCurrentBusiness();
if (!business) {
  const main = document.querySelector(".main-content");
  if (main) main.innerHTML = '<div class="card" style="padding:32px; text-align:center; color:var(--stone);">Setting up your business profile — refresh in a moment. If this persists, sign out and back in.</div>';
}
const businessId = business?.id;
let currentSale = null;

async function loadReceipts() {
  const { data } = await supabase
    .from("sales")
    .select("id,receipt_number,customer_name,total,created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);

  const body = document.getElementById("receiptsBody");
  if (!data || !data.length) {
    body.innerHTML = `<tr><td colspan="4" style="color:var(--stone);">No receipts yet.</td></tr>`;
    return;
  }
  body.innerHTML = data
    .map((s) => `<tr data-sale="${s.id}" style="cursor:pointer;"><td>${s.receipt_number}</td><td>${s.customer_name || "Walk-in"}</td><td>${formatNaira(s.total)}</td><td>${new Date(s.created_at).toLocaleDateString("en-NG")}</td></tr>`)
    .join("");
  body.querySelectorAll("tr[data-sale]").forEach((row) => row.addEventListener("click", () => showReceipt(row.dataset.sale)));

  const preselect = new URLSearchParams(location.search).get("sale");
  if (preselect) showReceipt(preselect);
}

async function showReceipt(saleId) {
  const [{ data: sale }, { data: items }] = await Promise.all([
    supabase.from("sales").select("*").eq("id", saleId).single(),
    supabase.from("sale_items").select("*").eq("sale_id", saleId),
  ]);
  if (!sale) return;
  currentSale = sale;

  document.getElementById("receiptDetailContent").innerHTML = `
    <div class="biz-name">${business?.name || "Your business"}</div>
    <div class="meta">
      ${business?.address ? business.address + "<br>" : ""}
      ${business?.phone || ""} ${business?.email ? " · " + business.email : ""}
    </div>
    <div class="meta">Receipt ${sale.receipt_number} · ${new Date(sale.created_at).toLocaleString("en-NG")}</div>
    <div style="font-size:0.85rem; margin-bottom:6px;">Customer: ${sale.customer_name || "Walk-in customer"}</div>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
      <tbody>
        ${(items || []).map((i) => `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>${formatNaira(i.unit_price)}</td><td>${formatNaira(i.line_total)}</td></tr>`).join("")}
      </tbody>
    </table>
    <div class="receipt-total-row"><span>Subtotal</span><span>${formatNaira(sale.subtotal)}</span></div>
    <div class="receipt-total-row"><span>Discount</span><span>${formatNaira(sale.discount)}</span></div>
    <div class="receipt-total-row grand"><span>Grand total</span><span>${formatNaira(sale.total)}</span></div>
    <div class="receipt-total-row" style="margin-top:8px;"><span>Payment method</span><span>${sale.payment_method || "Cash"}</span></div>
    <div class="receipt-thankyou">Thank you for your patronage!</div>
  `;
}

document.getElementById("printReceiptBtn")?.addEventListener("click", () => {
  if (!currentSale) { showToast("Select a receipt first", "warning"); return; }
  window.print();
});

document.getElementById("shareReceiptBtn")?.addEventListener("click", async () => {
  if (!currentSale) { showToast("Select a receipt first", "warning"); return; }
  const text = `Receipt ${currentSale.receipt_number} — ${formatNaira(currentSale.total)} from ${business?.name || "Stockbook OS"}`;
  if (navigator.share) {
    try { await navigator.share({ title: "Receipt", text }); } catch {}
  } else {
    await navigator.clipboard.writeText(text);
    showToast("Receipt summary copied", "success");
  }
});

if (business) loadReceipts();
