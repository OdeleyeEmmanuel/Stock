// ============================================================
// STOCKBOOK OS — dashboard data
// ============================================================
import { supabase, getCurrentBusiness, formatNaira } from "./supabase.js";
import { animateCount } from "./utils.js";

const business = await getCurrentBusiness();
if (!business) {
  document.querySelector(".main-content").innerHTML =
    '<div class="card" style="padding:32px; text-align:center; color:var(--stone);">Setting up your business profile — refresh in a moment. If this persists, sign out and back in.</div>';
}

const businessId = business?.id;

async function loadStats() {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, quantity, cost_price, selling_price, minimum_stock_level")
    .eq("business_id", businessId);

  const items = products || [];

  const inventoryCost = items.reduce((sum, p) => sum + p.quantity * p.cost_price, 0);
  const inventoryRevenuePotential = items.reduce((sum, p) => sum + p.quantity * p.selling_price, 0);
  const potentialProfit = inventoryRevenuePotential - inventoryCost;
  const lowStockItems = items.filter((p) => p.quantity <= p.minimum_stock_level && p.quantity > 0);
  const outOfStockItems = items.filter((p) => p.quantity === 0);

  const { data: sales } = await supabase
    .from("sales")
    .select("id, total, customer_name, receipt_number, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(6);

  const { data: purchases } = await supabase
    .from("purchases")
    .select("total")
    .eq("business_id", businessId);

  const totalSales = (sales || []).reduce((s, x) => s + Number(x.total || 0), 0);
  const totalPurchases = (purchases || []).reduce((s, x) => s + Number(x.total || 0), 0);

  // Stat cards
  animateCount(document.getElementById("statInventoryValue"), inventoryCost, { prefix: "₦" });
  document.getElementById("statTotalSales").textContent = formatNaira(totalSales);
  document.getElementById("statTotalPurchases").textContent = formatNaira(totalPurchases);
  document.getElementById("statProfit").textContent = formatNaira(potentialProfit);
  document.getElementById("statProductCount").textContent = items.length;
  document.getElementById("statLowStock").textContent = lowStockItems.length + outOfStockItems.length;

  // Recent sales table
  const salesBody = document.getElementById("recentSalesBody");
  if (sales && sales.length) {
    salesBody.innerHTML = sales
      .map(
        (s) => `<tr>
          <td>${s.customer_name || "Walk-in customer"}</td>
          <td>${s.receipt_number || "—"}</td>
          <td>${formatNaira(s.total)}</td>
          <td>${new Date(s.created_at).toLocaleDateString("en-NG")}</td>
        </tr>`
      )
      .join("");
  }

  // Low stock table
  const lowStockBody = document.getElementById("lowStockBody");
  const attention = [...outOfStockItems, ...lowStockItems];
  if (attention.length) {
    lowStockBody.innerHTML = attention
      .map((p) => {
        const badge =
          p.quantity === 0
            ? `<span class="badge badge-out">🔴 Out of stock</span>`
            : `<span class="badge badge-low">🟡 Running low</span>`;
        return `<tr><td>${p.name}</td><td>${p.quantity}</td><td>${badge}</td></tr>`;
      })
      .join("");
  }
}

if (business) loadStats();
