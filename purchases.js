// ============================================================
// STOCKBOOK OS — purchases
// ============================================================
import { supabase, getCurrentBusiness, formatNaira } from "./supabase.js";
import { showToast } from "./utils.js";

const business = await getCurrentBusiness();
if (!business) {
  const main = document.querySelector(".main-content");
  if (main) main.innerHTML = '<div class="card" style="padding:32px; text-align:center; color:var(--stone);">Setting up your business profile — refresh in a moment. If this persists, sign out and back in.</div>';
}
const businessId = business?.id;

let products = [];
let suppliers = [];
const purchaseCart = [];

async function loadData() {
  const [{ data: p }, { data: s }, { data: purchases }] = await Promise.all([
    supabase.from("products").select("id,name").eq("business_id", businessId).order("name"),
    supabase.from("suppliers").select("id,name").eq("business_id", businessId).order("name"),
    supabase.from("purchases").select("id,total,created_at,suppliers(name)").eq("business_id", businessId).order("created_at", { ascending: false }).limit(10),
  ]);
  products = p || [];
  suppliers = s || [];

  document.getElementById("purSupplier").innerHTML =
    `<option value="">No supplier</option>` + suppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
  document.getElementById("purProduct").innerHTML = products.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");

  const body = document.getElementById("purchasesBody");
  body.innerHTML = (purchases || []).length
    ? purchases.map((pu) => `<tr><td>${pu.suppliers?.name || "—"}</td><td>${formatNaira(pu.total)}</td><td>${new Date(pu.created_at).toLocaleDateString("en-NG")}</td></tr>`).join("")
    : `<tr><td colspan="3" style="color:var(--stone);">No purchases recorded yet.</td></tr>`;
}

function renderPurchaseCart() {
  const container = document.getElementById("purchaseCartItems");
  container.innerHTML = purchaseCart
    .map((i, idx) => `<div style="display:flex; justify-content:space-between;">
      <span>${i.name} × ${i.quantity}</span>
      <span>${formatNaira(i.quantity * i.cost_price)} <button data-remove="${idx}" class="btn btn-secondary" style="padding:2px 8px; font-size:0.75rem; margin-left:6px;">✕</button></span>
    </div>`)
    .join("");
  container.querySelectorAll("[data-remove]").forEach((btn) =>
    btn.addEventListener("click", () => { purchaseCart.splice(+btn.dataset.remove, 1); renderPurchaseCart(); })
  );
  const total = purchaseCart.reduce((s, i) => s + i.quantity * i.cost_price, 0);
  document.getElementById("purchaseTotal").textContent = formatNaira(total);
}

document.getElementById("addPurchaseItemBtn")?.addEventListener("click", () => {
  const productId = document.getElementById("purProduct").value;
  const product = products.find((p) => p.id === productId);
  const qty = Number(document.getElementById("purQty").value);
  const cost = Number(document.getElementById("purCost").value);
  if (!product || !qty || !cost) {
    showToast("Fill in product, quantity, and cost price", "warning");
    return;
  }
  purchaseCart.push({ product_id: product.id, name: product.name, quantity: qty, cost_price: cost });
  document.getElementById("purQty").value = "";
  document.getElementById("purCost").value = "";
  renderPurchaseCart();
});

document.getElementById("completePurchaseBtn")?.addEventListener("click", async () => {
  if (!purchaseCart.length) {
    showToast("Add at least one item to the purchase", "warning");
    return;
  }
  const supplierId = document.getElementById("purSupplier").value || null;
  const total = purchaseCart.reduce((s, i) => s + i.quantity * i.cost_price, 0);
  const notes = document.getElementById("purNotes").value.trim();

  const { data: purchase, error } = await supabase
    .from("purchases")
    .insert({ business_id: businessId, supplier_id: supplierId, total, notes })
    .select()
    .single();

  if (error) { showToast("Purchase failed: " + error.message, "error"); return; }

  for (const item of purchaseCart) {
    await supabase.from("purchase_items").insert({
      purchase_id: purchase.id,
      product_id: item.product_id,
      product_name: item.name,
      quantity: item.quantity,
      cost_price: item.cost_price,
      line_total: item.quantity * item.cost_price,
    });
  }

  showToast("Purchase recorded — stock updated", "success");
  purchaseCart.length = 0;
  renderPurchaseCart();
  document.getElementById("purNotes").value = "";
  loadData();
});

if (business) loadData();
