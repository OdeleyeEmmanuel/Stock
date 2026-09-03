// ============================================================
// STOCKBOOK OS — inventory management
// ============================================================
import { supabase, getCurrentBusiness, formatNaira } from "./supabase.js";
import { showToast } from "./utils.js";

const business = await getCurrentBusiness();
if (!business) {
  const main = document.querySelector(".main-content");
  if (main) main.innerHTML = '<div class="card" style="padding:32px; text-align:center; color:var(--stone);">Setting up your business profile — refresh in a moment. If this persists, sign out and back in.</div>';
}
const businessId = business?.id;
let allProducts = [];

function statusBadge(p) {
  if (p.quantity <= 0) return `<span class="badge badge-out">🔴 Out of stock</span>`;
  if (p.quantity <= p.minimum_stock_level) return `<span class="badge badge-low">🟡 Running low</span>`;
  return `<span class="badge badge-healthy">🟢 Healthy stock</span>`;
}

function renderRows(list) {
  const body = document.getElementById("productsBody");
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="7" style="color:var(--stone);">No products yet. Add your first product to get started.</td></tr>`;
    return;
  }
  body.innerHTML = list
    .map((p) => {
      const costValue = p.quantity * p.cost_price;
      const sellValue = p.quantity * p.selling_price;
      return `<tr>
        <td>${p.name}</td>
        <td>${p.category_name || "—"}</td>
        <td>${p.quantity} ${p.unit || ""}</td>
        <td>${formatNaira(costValue)}</td>
        <td>${formatNaira(sellValue)}</td>
        <td>${statusBadge(p)}</td>
        <td><button class="btn btn-secondary" data-edit="${p.id}" style="padding:6px 12px; font-size:0.8rem;">Edit</button></td>
      </tr>`;
    })
    .join("");

  body.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openModal(list.find((p) => p.id === btn.dataset.edit)));
  });
}

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,description,quantity,unit,cost_price,selling_price,minimum_stock_level,category_id,categories(name)")
    .eq("business_id", businessId)
    .order("name");

  if (error) {
    showToast("Could not load inventory: " + error.message, "error");
    return;
  }

  allProducts = (data || []).map((p) => ({ ...p, category_name: p.categories?.name }));
  renderRows(allProducts);

  // Populate category filter dropdown + merge real categories into the picker datalist
  const categories = [...new Set(allProducts.map((p) => p.category_name).filter(Boolean))];
  const select = document.getElementById("categoryFilter");
  select.innerHTML =
    `<option value="">All categories</option>` +
    categories.map((c) => `<option value="${c}">${c}</option>`).join("");

  const datalist = document.getElementById("categoryOptions");
  if (datalist) {
    const existingValues = new Set([...datalist.options].map((o) => o.value));
    categories.forEach((c) => {
      if (!existingValues.has(c)) {
        const opt = document.createElement("option");
        opt.value = c;
        datalist.appendChild(opt);
      }
    });
  }
}

function applyFilters() {
  const q = document.getElementById("productSearch").value.trim().toLowerCase();
  const cat = document.getElementById("categoryFilter").value;
  let list = allProducts;
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
  if (cat) list = list.filter((p) => p.category_name === cat);
  renderRows(list);
}
document.getElementById("productSearch")?.addEventListener("input", applyFilters);
document.getElementById("categoryFilter")?.addEventListener("change", applyFilters);

// ---------- modal ----------
const modal = document.getElementById("productModal");
function openModal(product = null) {
  document.getElementById("productModalTitle").textContent = product ? "Edit product" : "Add product";
  document.getElementById("pId").value = product?.id || "";
  document.getElementById("pName").value = product?.name || "";
  document.getElementById("pCategory").value = product?.category_name || "";
  document.getElementById("pDescription").value = product?.description || "";
  document.getElementById("pQuantity").value = product?.quantity ?? "";
  document.getElementById("pUnit").value = product?.unit || "pcs";
  document.getElementById("pCostPrice").value = product?.cost_price ?? "";
  document.getElementById("pSellingPrice").value = product?.selling_price ?? "";
  document.getElementById("pMinStock").value = product?.minimum_stock_level ?? 5;
  modal.style.display = "flex";
}
function closeModal() { modal.style.display = "none"; }

document.getElementById("openAddProduct")?.addEventListener("click", () => openModal());
document.getElementById("closeProductModal")?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

if (new URLSearchParams(location.search).get("action") === "add") openModal();

async function resolveCategoryId(name) {
  if (!name) return null;
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("business_id", businessId)
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await supabase
    .from("categories")
    .insert({ business_id: businessId, name })
    .select()
    .single();
  return created?.id || null;
}

document.getElementById("productForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("pId").value;
  const categoryId = await resolveCategoryId(document.getElementById("pCategory").value.trim());

  const payload = {
    business_id: businessId,
    category_id: categoryId,
    name: document.getElementById("pName").value.trim(),
    description: document.getElementById("pDescription").value.trim(),
    quantity: Number(document.getElementById("pQuantity").value),
    unit: document.getElementById("pUnit").value.trim() || "pcs",
    cost_price: Number(document.getElementById("pCostPrice").value),
    selling_price: Number(document.getElementById("pSellingPrice").value),
    minimum_stock_level: Number(document.getElementById("pMinStock").value),
  };

  const query = id
    ? supabase.from("products").update(payload).eq("id", id)
    : supabase.from("products").insert(payload);

  const { error } = await query;
  if (error) {
    showToast("Could not save product: " + error.message, "error");
    return;
  }

  showToast(id ? "Product updated" : "Product added", "success");
  closeModal();
  loadProducts();
});

if (business) loadProducts();
