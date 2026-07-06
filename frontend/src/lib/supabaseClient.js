// frontend/src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase environment variables are missing! Make sure frontend/.env is configured.")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
