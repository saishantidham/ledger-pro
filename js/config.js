// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://mxvaohzxqitktwzqwuix.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14dmFvaHp4cWl0a3R3enF3dWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NTQ5NzksImV4cCI6MjA5ODEzMDk3OX0.rHrKNXNuLJjkbQsLHitVtLylk7Aey3A3_mPFuqLhZus';

// The CDN loads a global 'supabase' object.
// We create our instance and assign it to a unique constant: supabaseClient
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
