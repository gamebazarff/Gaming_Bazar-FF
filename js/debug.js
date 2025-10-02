// Enhanced debug script
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
            
            // Test database connection
            testDatabaseConnection();
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
        console.log('User ID:', currentUser.id);
    } else {
        console.log('🔒 No user logged in');
    }
});

async function testDatabaseConnection() {
    try {
        console.log('🧪 Testing database connection...');
        
        // Test products table
        const { data: products, error: productsError } = await window.supabase
            .from('products')
            .select('*')
            .limit(1);
            
        if (productsError) {
            console.error('❌ Products table error:', productsError);
        } else {
            console.log('✅ Products table accessible. Count:', products?.length || 0);
        }
        
        // Test orders table
        const { data: orders, error: ordersError } = await window.supabase
            .from('orders')
            .select('*')
            .limit(1);
            
        if (ordersError) {
            console.error('❌ Orders table error:', ordersError);
            
            if (ordersError.code === '42501') {
                console.error('🔒 RLS Policy blocking access. Run: ALTER TABLE orders DISABLE ROW LEVEL SECURITY;');
            }
        } else {
            console.log('✅ Orders table accessible. Count:', orders?.length || 0);
        }
        
        // Test users table
        const { data: users, error: usersError } = await window.supabase
            .from('users')
            .select('*')
            .limit(1);
            
        if (usersError) {
            console.error('❌ Users table error:', usersError);
        } else {
            console.log('✅ Users table accessible. Count:', users?.length || 0);
        }
        
    } catch (error) {
        console.error('❌ Database test failed:', error);
    }
}

// Add this function to test order placement
window.testOrder = async function() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        alert('Please login first');
        return;
    }
    
    // Get first available product
    const { data: products } = await window.supabase
        .from('products')
        .select('*')
        .limit(1);
        
    if (!products || products.length === 0) {
        alert('No products available');
        return;
    }
    
    const testOrderData = {
        user_id: currentUser.id,
        product_id: products[0].id,
        payment_method: 'bkash',
        payment_number: '0123456789',
        transaction_id: 'TEST' + Date.now(),
        game_id: 'TEST123',
        status: 'pending'
    };
    
    console.log('Testing order with data:', testOrderData);
    
    try {
        const { data, error } = await window.supabase
            .from('orders')
            .insert([testOrderData])
            .select()
            .single();
            
        if (error) {
            console.error('Test order failed:', error);
            alert('Test order failed: ' + error.message);
        } else {
            console.log('Test order successful:', data);
            alert('Test order successful! Order ID: ' + data.id);
        }
    } catch (error) {
        console.error('Test order error:', error);
        alert('Test order error: ' + error.message);
    }
};
