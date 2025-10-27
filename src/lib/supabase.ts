import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://numxuofsgfsuzleynert.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51bXh1b2ZzZ2ZzdXpsZXluZXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MzY2MzMsImV4cCI6MjA3NzExMjYzM30.lUq-mhHH5A0TzXGby_h3j3JSH4C-2KOpLPIxpQWFg08"

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase environment variables are not set. Authentication will not work until you add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

