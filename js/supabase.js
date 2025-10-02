// Supabase configuration
const SUPABASE_URL = 'https://jlpezrugqtoexcnpkopq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpscGV6cnVncXRvZXhjbnBrb3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMjI1MDIsImV4cCI6MjA3NDg5ODUwMn0.84biwEi11p72-mb_pq_IPl4dDZBx-MYFm3-fHNTQJjw';

// Initialize Supabase

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
