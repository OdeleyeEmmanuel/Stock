// ============================================================
// STOCKBOOK OS — Supabase connection
// ============================================================
// Fill these in once your project is live. You can find both
// values in Supabase Dashboard → Project Settings → API.
//
//   SUPABASE_URL      → "Project URL"
//   SUPABASE_ANON_KEY  → "anon / public" key (safe for frontend use)
//
// Never put your service_role key in this file or anywhere in
// the frontend — it bypasses Row Level Security entirely.
// ============================================================

const SUPABASE_URL = "https://nzykxczqvveozwywtcwj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56eWt4Y3pxdnZlb3p3eXd0Y3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMDg1ODUsImV4cCI6MjA3MDc4NDU4NX0.gpvaYELr4Ztdzr1I2y31mATus5YWpl2KJZ6LJ19_EkU";

export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);

// ------------------------------------------------------------
// Shared helpers used across modules
// ------------------------------------------------------------

/** Formats a number as Nigerian Naira, e.g. formatNaira(55000) -> "₦55,000" */
export function formatNaira(amount) {
  const value = Number(amount) || 0;
  return "₦" + value.toLocaleString("en-NG", { maximumFractionDigits: 2 });
}

/** Returns the current authenticated user, or null. */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

/** Returns the business row owned by the current user. */
export async function getCurrentBusiness() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .single();
  if (error) {
    console.error("getCurrentBusiness:", error.message);
    return null;
  }
  return data;
}

/** Redirects to the welcome screen if no session exists. Call at top of protected pages. */
export async function requireAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  return session;
}
