// Supabase configuration - REPLACE WITH YOUR ACTUAL CREDENTIALS
const SUPABASE_URL = 'https://jlpezrugqtoexcnpkopq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpscGV6cnVncXRvZXhjbnBrb3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMjI1MDIsImV4cCI6MjA3NDg5ODUwMn0.84biwEi11p72-mb_pq_IPl4dDZBx-MYFm3-fHNTQJjw';

console.log('Initializing Supabase with URL:', SUPABASE_URL);

// Wait for Supabase to load
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Initialize Supabase
        if (typeof supabase !== 'undefined') {
            window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase initialized successfully');
            
            // Test connection
            window.supabase.from('users').select('count', { count: 'exact', head: true })
                .then(({ count, error }) => {
                    if (error) {
                        console.error('Supabase connection error:', error);
                    } else {
                        console.log('Supabase connected successfully. Total users:', count);
                    }
                });
        } else {
            console.error('Supabase CDN not loaded');
        }
    } catch (error) {
        console.error('Error initializing Supabase:', error);
    }
});
