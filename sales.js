// ============================================================
// STOCKBOOK OS — sales / point of sale
// ============================================================
import { supabase, getCurrentBusiness, formatNaira } from "./supabase.js";
import { showToast, flashSuccess } from "./utils.js";

const business = await getCurrentBusiness();
if (!business) {
  const main = document.querySelector(".main-content");
  if (main) main.innerHTML = '<div class="card" style="padding:32px; text-align:center; color:var(--stone);">Setting up your business profile — refresh in a moment. If this persists, sign out and back in.</div>';
}
const businessId = business?.id;

let products = [];
let customers = [];
const cart = []; // { product_id, name, price, qty, available }

async function loadData() {
  const [{ data: p }, { data: c }] = await Promise.all([
    supabase.from("products").select("id,name,selling_price,cost_price,quantity").eq("business_id", businessId).order("name"),
    supabase.from("customers").select("id,name").eq("business_id", businessId).order("name"),
  ]);
  products = p || [];
  customers = c || [];

  const sel = document.getElementById("customerSelect");
  sel.innerHTML =
    `<option value="">Walk-in customer</option>` +
    customers.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");

  renderProductResults(products);
}

function renderProductResults(list) {
  const container = document.getElementById("posResults");
  if (!list.length) {
    container.innerHTML = `<p style="font-size:0.85rem;">No products found.</p>`;
    return;
  }
  container.innerHTML = list
    .map(
      (p) => `<div class="card" style="padding:12px 14px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.9rem; font-weight:600;">${p.name}</div>
          <div style="font-size:0.78rem; color:var(--stone);">${formatNaira(p.selling_price)} · ${p.quantity} in stock</div>
        </div>
        <button class="btn btn-secondary" data-add="${p.id}" style="padding:6px 14px; font-size:0.8rem;" ${p.quantity <= 0 ? "disabled" : ""}>
          ${p.quantity <= 0 ? "Out of stock" : "Add"}
        </button>
      </div>`
    )
    .join("");

  container.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(btn.dataset.add));
  });
}

document.getElementById("posSearch")?.addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  renderProductResults(q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products);
});

function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  const existing = cart.find((i) => i.product_id === productId);
  if (existing) {
    if (existing.qty + 1 > product.quantity) {
      showToast(`Only ${product.quantity} of ${product.name} in stock`, "warning");
      return;
    }
    existing.qty += 1;
  } else {
    cart.push({ product_id: product.id, name: product.name, price: product.selling_price, cost: product.cost_price || 0, qty: 1, available: product.quantity });
  }
  renderCart();
}

function renderCart() {
  const container = document.getElementById("cartItems");
  if (!cart.length) {
    container.innerHTML = `<p style="font-size:0.85rem;">No items yet — search and add products.</p>`;
  } else {
    container.innerHTML = cart
      .map(
        (item, idx) => `<div style="display:flex; justify-content:space-between; align-items:center; font-size:0.88rem; gap:8px;">
          <span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.name}</span>
          <span style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
            <button data-dec="${idx}" class="btn btn-secondary" style="padding:2px 9px; font-size:0.8rem;">−</button>
            <input type="text" inputmode="decimal" data-qty-input="${idx}" value="${item.qty}"
              style="width:64px; padding:5px 6px; text-align:center; font-size:0.85rem;" />
            <button data-inc="${idx}" class="btn btn-secondary" style="padding:2px 9px; font-size:0.8rem;">+</button>
            <span style="min-width:76px; text-align:right;">${formatNaira(item.price * item.qty)}</span>
          </span>
        </div>`
      )
      .join("");

    container.querySelectorAll("[data-inc]").forEach((btn) => btn.addEventListener("click", () => changeQty(+btn.dataset.inc, 1)));
    container.querySelectorAll("[data-dec]").forEach((btn) => btn.addEventListener("click", () => changeQty(+btn.dataset.dec, -1)));
    container.querySelectorAll("[data-qty-input]").forEach((input) => {
      input.addEventListener("change", () => setQty(+input.dataset.qtyInput, Number(input.value)));
      input.addEventListener("click", (e) => e.target.select());
    });
  }
  updateTotals();
}

function changeQty(idx, delta) {
  const item = cart[idx];
  const newQty = Math.round((item.qty + delta) * 100) / 100;
  applyQty(idx, newQty);
}

/** Set a cart line to an exact quantity typed by the user — supports decimals (kg, litres, etc). */
function setQty(idx, newQty) {
  applyQty(idx, newQty);
}

function applyQty(idx, newQty) {
  const item = cart[idx];
  if (!newQty || newQty <= 0 || Number.isNaN(newQty)) { cart.splice(idx, 1); renderCart(); return; }
  if (newQty > item.available) {
    showToast(`Only ${item.available} of ${item.name} in stock`, "warning");
    renderCart(); // revert the input back to the last valid value
    return;
  }
  item.qty = newQty;
  renderCart();
}

function updateTotals() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const rawProfit = cart.reduce((s, i) => s + (i.price - i.cost) * i.qty, 0);
  const discount = Number(document.getElementById("discountInput").value) || 0;
  const total = Math.max(subtotal - discount, 0);
  const paid = Number(document.getElementById("amountPaidInput").value) || 0;
  const balance = paid - total;
  const estimatedProfit = rawProfit - discount;

  document.getElementById("cartSubtotal").textContent = formatNaira(subtotal);
  document.getElementById("cartDiscount").textContent = formatNaira(discount);
  document.getElementById("cartTotal").textContent = formatNaira(total);
  document.getElementById("cartBalance").textContent = formatNaira(balance);
  const profitEl = document.getElementById("cartProfit");
  if (profitEl) {
    profitEl.textContent = formatNaira(estimatedProfit);
    profitEl.style.color = estimatedProfit >= 0 ? "var(--verified)" : "var(--alert)";
  }
}

document.getElementById("discountInput")?.addEventListener("input", updateTotals);
document.getElementById("amountPaidInput")?.addEventListener("input", updateTotals);

document.getElementById("completeSaleBtn")?.addEventListener("click", async () => {
  if (!cart.length) {
    showToast("Add at least one product to the cart", "warning");
    return;
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = Number(document.getElementById("discountInput").value) || 0;
  const total = Math.max(subtotal - discount, 0);
  const paid = Number(document.getElementById("amountPaidInput").value) || 0;
  const customerId = document.getElementById("customerSelect").value || null;
  const customerName = customerId
    ? customers.find((c) => c.id === customerId)?.name
    : "Walk-in customer";

  const btn = document.getElementById("completeSaleBtn");
  btn.disabled = true;
  btn.textContent = "Processing…";

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      customer_name: customerName,
      subtotal,
      discount,
      total,
      amount_paid: paid,
      balance: paid - total,
    })
    .select()
    .single();

  if (saleError) {
    showToast("Sale failed: " + saleError.message, "error");
    btn.disabled = false;
    btn.textContent = "Complete sale";
    return;
  }

  // Insert sale items one at a time so an oversell on any single item
  // is caught by the DB trigger without abandoning already-valid items silently.
  let itemError = null;
  for (const item of cart) {
    const { error } = await supabase.from("sale_items").insert({
      sale_id: sale.id,
      product_id: item.product_id,
      product_name: item.name,
      quantity: item.qty,
      unit_price: item.price,
      line_total: item.price * item.qty,
    });
    if (error) { itemError = error; break; }
  }

  if (itemError) {
    showToast("Sale item failed: " + itemError.message, "error");
    btn.disabled = false;
    btn.textContent = "Complete sale";
    return;
  }

  showToast(`Sale complete — receipt ${sale.receipt_number}`, "success");
  flashSuccess();
  cart.length = 0;
  document.getElementById("discountInput").value = 0;
  document.getElementById("amountPaidInput").value = "";
  renderCart();
  loadData();

  setTimeout(() => { window.location.href = `receipts.html?sale=${sale.id}`; }, 900);
});

if (business) loadData();
