import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gwsddiwbkdssbcyhpgpk.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3c2RkaXdia2Rzc2JjeWhwZ3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNjQ0ODYsImV4cCI6MjEwNzc0MDQ4Nn0.prgvPu_h4hiE42MlRounLxYV5C8iSqobFh3wfuKxu9A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
