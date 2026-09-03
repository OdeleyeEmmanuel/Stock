// ============================================================
// STOCKBOOK OS — analytics (dependency-free canvas charts)
// ============================================================
import { supabase, getCurrentBusiness } from "./supabase.js";

const business = await getCurrentBusiness();
if (!business) {
  const main = document.querySelector(".main-content");
  if (main) main.innerHTML = '<div class="card" style="padding:32px; text-align:center; color:var(--stone);">Setting up your business profile — refresh in a moment. If this persists, sign out and back in.</div>';
}
const businessId = business?.id;

function drawLineChart(canvas, series, { colors, labels } = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.parentElement.clientWidth;
  const h = canvas.height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const padding = 28;
  const allValues = series.flat();
  const max = Math.max(1, ...allValues);
  const stepX = (w - padding * 2) / (series[0].length - 1 || 1);

  // gridlines
  ctx.strokeStyle = "#DEDACE";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = padding + ((h - padding * 2) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(w - padding, y);
    ctx.stroke();
  }

  series.forEach((values, sIdx) => {
    ctx.strokeStyle = colors[sIdx];
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = padding + i * stepX;
      const y = h - padding - (v / max) * (h - padding * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // soft fill
    ctx.lineTo(padding + (values.length - 1) * stepX, h - padding);
    ctx.lineTo(padding, h - padding);
    ctx.closePath();
    ctx.fillStyle = colors[sIdx] + "14";
    ctx.fill();
  });
}

function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function run() {
  const days = lastNDays(14);
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const [{ data: sales }, { data: purchases }, { data: products }] = await Promise.all([
    supabase.from("sales").select("total,created_at").eq("business_id", businessId).gte("created_at", since.toISOString()),
    supabase.from("purchases").select("total,created_at").eq("business_id", businessId).gte("created_at", since.toISOString()),
    supabase.from("products").select("quantity,cost_price,created_at").eq("business_id", businessId),
  ]);

  const salesByDay = days.map((d) => (sales || []).filter((s) => s.created_at.startsWith(d)).reduce((s, x) => s + Number(x.total), 0));
  const purchasesByDay = days.map((d) => (purchases || []).filter((p) => p.created_at.startsWith(d)).reduce((s, x) => s + Number(x.total), 0));

  drawLineChart(document.getElementById("trendChart"), [salesByDay, purchasesByDay], {
    colors: ["#1C7C54", "#B8862E"],
  });

  // Inventory growth: cumulative cost value of products added, by day added
  const items = products || [];
  const invByDay = days.map((d) =>
    items.filter((p) => p.created_at.startsWith(d)).reduce((s, p) => s + p.quantity * p.cost_price, 0)
  );
  let running = 0;
  const cumulative = invByDay.map((v) => (running += v));

  drawLineChart(document.getElementById("inventoryChart"), [cumulative], { colors: ["#1C7C54"] });
}

if (business) run();
window.addEventListener("resize", run);
