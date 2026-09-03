// ============================================================
// STOCKBOOK OS — business estimator
// ============================================================
import { supabase, getCurrentBusiness, formatNaira } from "./supabase.js";
import { animateCount } from "./utils.js";

const business = await getCurrentBusiness();
if (!business) {
  const main = document.querySelector(".main-content");
  if (main) main.innerHTML = '<div class="card" style="padding:32px; text-align:center; color:var(--stone);">Setting up your business profile — refresh in a moment. If this persists, sign out and back in.</div>';
}
const businessId = business?.id;

async function run() {
  const { data: products } = await supabase
    .from("products")
    .select("id,name,quantity,cost_price,selling_price,minimum_stock_level")
    .eq("business_id", businessId);

  const items = products || [];
  const cost = items.reduce((s, p) => s + p.quantity * p.cost_price, 0);
  const revenue = items.reduce((s, p) => s + p.quantity * p.selling_price, 0);
  const profit = revenue - cost;
  const totalItemsInStock = items.reduce((s, p) => s + Number(p.quantity), 0);
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  animateCount(document.getElementById("estCost"), cost, { prefix: "₦" });
  animateCount(document.getElementById("estRevenue"), revenue, { prefix: "₦" });
  animateCount(document.getElementById("estProfit"), profit, { prefix: "₦" });
  document.getElementById("estProducts").textContent = items.length;
  document.getElementById("estItems").textContent = totalItemsInStock.toLocaleString("en-NG");
  document.getElementById("estMargin").textContent = margin.toFixed(1) + "%";
  document.getElementById("marginBar").style.width = Math.max(0, Math.min(100, margin)) + "%";

  // ---------- dynamic insights from real data ----------
  const insights = [];
  const lowStock = items.filter((p) => p.quantity > 0 && p.quantity <= p.minimum_stock_level);
  const outOfStock = items.filter((p) => p.quantity === 0);

  lowStock.slice(0, 2).forEach((p) => insights.push({ icon: "🟡", text: `${p.name} is running low, at ${p.quantity} ${items.find(i=>i.id===p.id)?.unit||"units"} left.` }));
  outOfStock.slice(0, 2).forEach((p) => insights.push({ icon: "🔴", text: `${p.name} is out of stock.` }));

  if (profit > 0) insights.push({ icon: "💰", text: `Potential profit from current inventory is ${formatNaira(profit)}.` });

  const { data: recentSales } = await supabase
    .from("sales")
    .select("total,created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (recentSales && recentSales.length >= 2) {
    const now = Date.now();
    const last7 = recentSales.filter((s) => now - new Date(s.created_at).getTime() < 7 * 86400000).reduce((s, x) => s + Number(x.total), 0);
    const prior7 = recentSales.filter((s) => {
      const age = now - new Date(s.created_at).getTime();
      return age >= 7 * 86400000 && age < 14 * 86400000;
    }).reduce((s, x) => s + Number(x.total), 0);
    if (prior7 > 0) {
      const change = ((last7 - prior7) / prior7) * 100;
      insights.push({
        icon: change >= 0 ? "📈" : "📉",
        text: `Sales this week are ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(0)}% compared to last week.`,
      });
    }
  }

  const { data: bestSeller } = await supabase
    .from("sale_items")
    .select("product_name, quantity, sales!inner(business_id)")
    .eq("sales.business_id", businessId)
    .limit(500);

  if (bestSeller && bestSeller.length) {
    const totals = {};
    bestSeller.forEach((i) => { totals[i.product_name] = (totals[i.product_name] || 0) + Number(i.quantity); });
    const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    if (top) insights.push({ icon: "🏆", text: `Your best-selling product overall is ${top[0]}.` });
  }

  const list = document.getElementById("insightsList");
  list.innerHTML = insights.length
    ? insights.map((i) => `<div style="display:flex; gap:10px; align-items:flex-start; font-size:0.9rem;"><span>${i.icon}</span><span>${i.text}</span></div>`).join("")
    : `<p style="font-size:0.88rem;">Insights will appear here as you record sales and manage inventory.</p>`;
}

if (business) run();
