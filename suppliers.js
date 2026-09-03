// ============================================================
// STOCKBOOK OS — suppliers
// ============================================================
import { supabase, getCurrentBusiness } from "./supabase.js";
import { showToast } from "./utils.js";

const business = await getCurrentBusiness();
if (!business) {
  const main = document.querySelector(".main-content");
  if (main) main.innerHTML = '<div class="card" style="padding:32px; text-align:center; color:var(--stone);">Setting up your business profile — refresh in a moment. If this persists, sign out and back in.</div>';
}
const businessId = business?.id;

async function loadSuppliers() {
  const { data } = await supabase
    .from("suppliers")
    .select("id,name,phone,address")
    .eq("business_id", businessId)
    .order("name");

  const body = document.getElementById("suppliersBody");
  body.innerHTML = (data && data.length)
    ? data.map((s) => `<tr><td>${s.name}</td><td>${s.phone || "—"}</td><td>${s.address || "—"}</td></tr>`).join("")
    : `<tr><td colspan="3" style="color:var(--stone);">No suppliers yet.</td></tr>`;
}

const modal = document.getElementById("supplierModal");
document.getElementById("openAddSupplier")?.addEventListener("click", () => { modal.style.display = "flex"; });
document.getElementById("closeSupplierModal")?.addEventListener("click", () => { modal.style.display = "none"; });
modal?.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });

document.getElementById("supplierForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { error } = await supabase.from("suppliers").insert({
    business_id: businessId,
    name: document.getElementById("sName").value.trim(),
    phone: document.getElementById("sPhone").value.trim(),
    email: document.getElementById("sEmail").value.trim(),
    address: document.getElementById("sAddress").value.trim(),
  });
  if (error) { showToast("Could not add supplier: " + error.message, "error"); return; }
  showToast("Supplier added", "success");
  modal.style.display = "none";
  e.target.reset();
  loadSuppliers();
});

if (business) loadSuppliers();
