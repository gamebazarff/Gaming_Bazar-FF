// Test payment methods function
window.testPaymentMethod = async function() {
    console.log('🧪 Testing payment methods...');
    
    try {
        // Test reading payment methods
        const { data: methods, error: readError } = await window.supabase
            .from('payment_methods')
            .select('*');
            
        if (readError) {
            console.error('❌ Error reading payment methods:', readError);
            return;
        }
        
        console.log('✅ Payment methods found:', methods);
        
        // Test creating a payment method
        const testMethod = {
            name: 'Test Method',
            payment_number: '01999999999',
            instructions: 'Test instructions',
            is_active: true
        };
        
        const { data: newMethod, error: createError } = await window.supabase
            .from('payment_methods')
            .insert([testMethod])
            .select()
            .single();
            
        if (createError) {
            console.error('❌ Error creating payment method:', createError);
        } else {
            console.log('✅ Payment method created:', newMethod);
            
            // Test deleting the test method
            const { error: deleteError } = await window.supabase
                .from('payment_methods')
                .delete()
                .eq('id', newMethod.id);
                
            if (deleteError) {
                console.error('❌ Error deleting test payment method:', deleteError);
            } else {
                console.log('✅ Test payment method deleted successfully');
            }
        }
        
    } catch (error) {
        console.error('❌ Payment method test failed:', error);
    }
};

// Test products function
window.testProducts = async function() {
    console.log('🧪 Testing products...');
    
    try {
        // Test reading products
        const { data: products, error } = await window.supabase
            .from('products')
            .select('*')
            .eq('is_active', true);
            
        if (error) {
            console.error('❌ Error reading products:', error);
            return;
        }
        
        console.log('✅ Products found:', products);
        
        if (products.length > 0) {
            // Test if we can use the first product
            const testProduct = products[0];
            console.log('First product ID:', testProduct.id);
            console.log('First product name:', testProduct.name);
            
            // Test creating an order with this product
            const currentUser = JSON.parse(localStorage.getItem('currentUser'));
            if (currentUser) {
                const testOrder = {
                    user_id: currentUser.id,
                    product_id: testProduct.id,
                    payment_method: 'Test',
                    payment_number: '0123456789',
                    transaction_id: 'TEST' + Date.now(),
                    game_id: 'TEST123',
                    status: 'pending'
                };
                
                console.log('Test order data:', testOrder);
            }
        }
        
    } catch (error) {
        console.error('❌ Products test failed:', error);
    }
};

// Test order placement
window.testOrderPlacement = async function() {
    console.log('🧪 Testing order placement...');
    
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        console.error('❌ No user logged in');
        alert('Please login first');
        return;
    }
    
    try {
        // Get first available product
        const { data: products } = await window.supabase
            .from('products')
            .select('*')
            .limit(1);
            
        if (!products || products.length === 0) {
            console.error('❌ No products available');
            alert('No products available');
            return;
        }
        
        const testOrderData = {
            user_id: currentUser.id,
            product_id: products[0].id,
            payment_method: 'Bkash', // Using string directly
            payment_number: '0123456789',
            transaction_id: 'TEST' + Date.now(),
            game_id: 'TEST123',
            status: 'pending'
        };
        
        console.log('Testing order with data:', testOrderData);
        
        const { data, error } = await window.supabase
            .from('orders')
            .insert([testOrderData])
            .select()
            .single();
            
        if (error) {
            console.error('❌ Test order failed:', error);
            alert('Test order failed: ' + error.message);
        } else {
            console.log('✅ Test order successful:', data);
            alert('Test order successful! Order ID: ' + data.id);
        }
    } catch (error) {
        console.error('❌ Test order error:', error);
        alert('Test order error: ' + error.message);
    }
};