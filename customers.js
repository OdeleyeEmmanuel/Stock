// ============================================================
// STOCKBOOK OS — customers
// ============================================================
import { supabase, getCurrentBusiness, formatNaira } from "./supabase.js";
import { showToast } from "./utils.js";

const business = await getCurrentBusiness();
if (!business) {
  const main = document.querySelector(".main-content");
  if (main) main.innerHTML = '<div class="card" style="padding:32px; text-align:center; color:var(--stone);">Setting up your business profile — refresh in a moment. If this persists, sign out and back in.</div>';
}
const businessId = business?.id;

async function loadCustomers() {
  const { data } = await supabase
    .from("customers")
    .select("id,name,phone,total_purchases,total_spent")
    .eq("business_id", businessId)
    .order("name");

  const body = document.getElementById("customersBody");
  body.innerHTML = (data && data.length)
    ? data.map((c) => `<tr><td>${c.name}</td><td>${c.phone || "—"}</td><td>${c.total_purchases}</td><td>${formatNaira(c.total_spent)}</td></tr>`).join("")
    : `<tr><td colspan="4" style="color:var(--stone);">No customers yet.</td></tr>`;
}

const modal = document.getElementById("customerModal");
document.getElementById("openAddCustomer")?.addEventListener("click", () => { modal.style.display = "flex"; });
document.getElementById("closeCustomerModal")?.addEventListener("click", () => { modal.style.display = "none"; });
modal?.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });

document.getElementById("customerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { error } = await supabase.from("customers").insert({
    business_id: businessId,
    name: document.getElementById("cName").value.trim(),
    phone: document.getElementById("cPhone").value.trim(),
    email: document.getElementById("cEmail").value.trim(),
  });
  if (error) { showToast("Could not add customer: " + error.message, "error"); return; }
  showToast("Customer added", "success");
  modal.style.display = "none";
  e.target.reset();
  loadCustomers();
});

if (business) loadCustomers();
