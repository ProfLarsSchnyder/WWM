// WWM v3 Supabase configuration
// Fill these two public frontend values once for the deployment.
// Never put a service_role key in this file.

export const SUPABASE_URL = "";
export const SUPABASE_PUBLISHABLE_KEY = "";

export function resolveSupabaseConfig() {
  const direct = {
    url: String(SUPABASE_URL || "").trim().replace(/\/+$/, ""),
    key: String(SUPABASE_PUBLISHABLE_KEY || "").trim()
  };

  if (direct.url && direct.key) return direct;

  // Silent compatibility with the previous WWM cloud setup.
  // Nothing from this is shown in the learner UI.
  try {
    const legacy = JSON.parse(localStorage.getItem("wwm_school_cloud_v1") || "null");
    const url = String(legacy?.url || "").trim().replace(/\/+$/, "");
    const key = String(legacy?.publishableKey || legacy?.anonKey || "").trim();
    if (url && key) return { url, key };
  } catch {}

  return direct;
}
