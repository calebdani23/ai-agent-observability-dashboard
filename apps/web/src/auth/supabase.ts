import { createClient } from "@supabase/supabase-js";
import { SUPABASE_AUTH_CONFIGURED, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../api/config";

export const supabase = SUPABASE_AUTH_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
