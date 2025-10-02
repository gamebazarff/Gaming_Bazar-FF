
// Debug script to check Supabase loading
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== FIRE DIAMOND DEBUG ===');
    console.log('DOM loaded successfully');
    console.log('Current page:', window.location.pathname);
    
    // Check Supabase loading
    const checkSupabase = setInterval(() => {
        if (typeof supabase !== 'undefined' && typeof window.supabase !== 'undefined') {
            console.log('✅ Supabase loaded successfully');
            console.log('Supabase URL:', window.supabase?.supabaseUrl);
            clearInterval(checkSupabase);
        } else {
            console.log('⏳ Waiting for Supabase to load...');
        }
    }, 500);

    // Timeout after 10 seconds
    setTimeout(() => {
        clearInterval(checkSupabase);
        if (typeof supabase === 'undefined' || typeof window.supabase === 'undefined') {
            console.error('❌ Supabase failed to load after 10 seconds');
        }
    }, 10000);

    // Check if user is logged in
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser) {
        console.log('👤 User logged in:', currentUser.email);
    } else {
        console.log('🔒 No user logged in');
    }
});
