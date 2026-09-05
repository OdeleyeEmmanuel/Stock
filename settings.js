// ============================================================
// STOCKBOOK OS — settings
// ============================================================
import { supabase, getCurrentBusiness, deleteAccountPermanently } from "./supabase.js";
import { showToast } from "./utils.js";

const business = await getCurrentBusiness();
if (!business) {
  const main = document.querySelector(".main-content");
  if (main) main.innerHTML = '<div class="card" style="padding:32px; text-align:center; color:var(--stone);">Setting up your business profile — refresh in a moment. If this persists, sign out and back in.</div>';
}
const businessId = business?.id;

async function load() {
  if (!business) return;
  document.getElementById("setName").value = business.name || "";
  document.getElementById("setAddress").value = business.address || "";
  document.getElementById("setPhone").value = business.phone || "";
  document.getElementById("setEmail").value = business.email || "";

  const { data: settings } = await supabase
    .from("business_settings")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (settings) {
    document.getElementById("setCurrency").value = settings.currency || "NGN";
    document.getElementById("setTax").value = settings.tax_rate ?? 0;
    document.getElementById("setLowStock").value = settings.low_stock_threshold ?? 5;
    document.getElementById("setPayment").value = settings.default_payment_method || "cash";
    document.getElementById("setReceiptMsg").value = settings.receipt_message || "";
  }
}

document.getElementById("settingsForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  let logoUrl = business?.logo_url || null;
  const fileInput = document.getElementById("setLogo");
  if (fileInput.files[0]) {
    const file = fileInput.files[0];
    const path = `${businessId}/logo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage.from("business-logos").upload(path, file, { upsert: true });
    if (uploadError) {
      showToast("Logo upload failed: " + uploadError.message, "error");
    } else {
      logoUrl = supabase.storage.from("business-logos").getPublicUrl(path).data.publicUrl;
    }
  }

  const { error: bizError } = await supabase
    .from("businesses")
    .update({
      name: document.getElementById("setName").value.trim(),
      address: document.getElementById("setAddress").value.trim(),
      phone: document.getElementById("setPhone").value.trim(),
      email: document.getElementById("setEmail").value.trim(),
      logo_url: logoUrl,
    })
    .eq("id", businessId);

  const { error: settingsError } = await supabase
    .from("business_settings")
    .upsert({
      business_id: businessId,
      currency: document.getElementById("setCurrency").value.trim() || "NGN",
      tax_rate: Number(document.getElementById("setTax").value) || 0,
      low_stock_threshold: Number(document.getElementById("setLowStock").value) || 5,
      default_payment_method: document.getElementById("setPayment").value,
      receipt_message: document.getElementById("setReceiptMsg").value.trim(),
    }, { onConflict: "business_id" });

  if (bizError || settingsError) {
    showToast("Could not save settings: " + (bizError || settingsError).message, "error");
    return;
  }
  showToast("Settings saved", "success");
});

if (business) load();

// ---------- deactivate account (soft, reversible) ----------
document.getElementById("deactivateBtn")?.addEventListener("click", async () => {
  if (!business) return;
  const confirmed = confirm(
    "Deactivate your account? You'll be signed out and won't be able to use Stockbook OS until you sign back in to reactivate it. Nothing is deleted."
  );
  if (!confirmed) return;

  const { error } = await supabase.from("businesses").update({ is_active: false }).eq("id", businessId);
  if (error) {
    showToast("Could not deactivate account: " + error.message, "error");
    return;
  }
  await supabase.auth.signOut();
  window.location.href = "index.html";
});

// ---------- delete account permanently ----------
document.getElementById("deleteAccountBtn")?.addEventListener("click", async () => {
  const typed = prompt(
    `This permanently deletes your business, all inventory, sales, purchases, and your login — everything. This cannot be undone.\n\nType DELETE to confirm.`
  );
  if (typed !== "DELETE") {
    if (typed !== null) showToast("Account not deleted — confirmation text didn't match.", "warning");
    return;
  }

  const btn = document.getElementById("deleteAccountBtn");
  btn.disabled = true;
  btn.textContent = "Deleting…";

  const { error } = await deleteAccountPermanently();
  if (error) {
    showToast("Could not delete account: " + error, "error");
    btn.disabled = false;
    btn.textContent = "Delete permanently";
    return;
  }

  await supabase.auth.signOut();
  window.location.href = "index.html";
});
