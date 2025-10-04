// Main page functionality
class MainPage {
    constructor() {
        this.categories = [];
        this.products = [];
        this.paymentMethods = [];
        this.userWallet = 0;
        this.siteSettings = {};
        this.init();
    }

    async init() {
        console.log('🚀 Initializing MainPage...');
        await this.waitForSupabase();
        await this.loadSiteSettings();
        await this.loadCategories();
        await this.loadProducts();
        await this.loadPaymentMethods();
        await this.loadWalletBalance();
        this.setupEventListeners();
        this.setupModal();
        this.setupWalletModal();
        console.log('✅ MainPage initialized successfully');
    }

    async waitForSupabase() {
        return new Promise((resolve) => {
            const checkSupabase = () => {
                if (typeof window.supabase !== 'undefined' && window.supabase) {
                    console.log('✅ Supabase ready for main page');
                    resolve();
                } else {
                    console.log('⏳ Waiting for Supabase...');
                    setTimeout(checkSupabase, 100);
                }
            };
            checkSupabase();
        });
    }

    async loadSiteSettings() {
        try {
            console.log('🔄 Loading site settings...');
            const { data: settings, error } = await window.supabase
                .from('site_settings')
                .select('*')
                .single();

            if (error) {
                console.error('❌ Error loading site settings:', error);
                this.applyDefaultSiteSettings();
                return;
            }

            if (settings) {
                this.siteSettings = settings;
                this.applySiteSettings(settings);
                console.log('✅ Site settings loaded');
            } else {
                this.applyDefaultSiteSettings();
            }
        } catch (error) {
            console.error('❌ Error loading site settings:', error);
            this.applyDefaultSiteSettings();
        }
    }

    applySiteSettings(settings) {
        // Update site content
        const siteTitle = document.getElementById('siteTitle');
        const siteName = document.getElementById('siteName');
        const footerName = document.getElementById('footerName');
        
        if (siteTitle) siteTitle.textContent = settings.site_name || 'Fire Diamond Topup';
        if (siteName) siteName.textContent = settings.site_name || 'Fire Diamond';
        if (footerName) footerName.textContent = settings.site_name || 'Fire Diamond Topup';
        
        // Store WhatsApp number for support
        this.siteSettings.whatsapp_number = settings.whatsapp_number || '1234567890';
    }

    applyDefaultSiteSettings() {
        const defaultSettings = {
            site_name: 'Fire Diamond Topup',
            hero_title: 'Fire Diamond Topup',
            hero_subtitle: 'Get your diamonds instantly with secure payment methods',
            banner_text: '🔥 Instant Diamond Delivery | 24/7 Support',
            whatsapp_number: '1234567890'
        };
        
        this.applySiteSettings(defaultSettings);
    }

    async loadCategories() {
        try {
            console.log('🔄 Loading categories...');
            const { data, error } = await window.supabase
                .from('categories')
                .select('*')
                .eq('is_active', true)
                .order('name');

            if (error) {
                console.error('❌ Error loading categories:', error);
                this.categories = [];
                this.renderCategories();
                return;
            }

            console.log('✅ Categories loaded:', data?.length || 0);
            this.categories = data || [];
            this.renderCategories();
        } catch (error) {
            console.error('❌ Error in loadCategories:', error);
            this.categories = [];
            this.renderCategories();
        }
    }

    async loadProducts() {
        try {
            console.log('🔄 Loading products...');
            const { data, error } = await window.supabase
                .from('products')
                .select(`*, categories(name)`)
                .eq('is_active', true)
                .order('price');

            if (error) {
                console.error('❌ Error loading products:', error);
                this.products = [];
                this.renderProducts();
                return;
            }

            console.log('✅ Products loaded:', data?.length || 0);
            this.products = data || [];
            this.renderProducts();
        } catch (error) {
            console.error('❌ Error in loadProducts:', error);
            this.products = [];
            this.renderProducts();
        }
    }

    async loadPaymentMethods() {
        try {
            console.log('🔄 Loading payment methods...');
            const { data, error } = await window.supabase
                .from('payment_methods')
                .select('*')
                .eq('is_active', true)
                .order('name');

            if (error) {
                console.error('❌ Error loading payment methods:', error);
                this.paymentMethods = [];
                return;
            }

            console.log('✅ Payment methods loaded:', data?.length || 0);
            this.paymentMethods = data || [];
            this.renderPaymentMethods();
            this.renderTopupPaymentMethods();
        } catch (error) {
            console.error('❌ Error in loadPaymentMethods:', error);
            this.paymentMethods = [];
        }
    }

    async loadWalletBalance() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) return;

        try {
            const { data, error } = await window.supabase
                .from('users')
                .select('wallet_balance')
                .eq('id', currentUser.id)
                .single();

            if (!error && data) {
                this.userWallet = data.wallet_balance || 0;
                this.updateWalletDisplay();
            }
        } catch (error) {
            console.error('Error loading wallet balance:', error);
        }
    }

    updateWalletDisplay() {
        const balanceElements = document.querySelectorAll('#availableBalance, #currentWalletBalance, #userWalletBalance, #walletBalance');
        balanceElements.forEach(element => {
            if (element) element.textContent = this.userWallet.toFixed(2);
        });
    }

    renderCategories() {
        const filterContainer = document.getElementById('categoryFilter');
        if (!filterContainer) {
            console.log('❌ Category filter container not found');
            return;
        }

        // Clear existing buttons (except "All")
        const allBtn = filterContainer.querySelector('[data-category="all"]');
        filterContainer.innerHTML = '';
        if (allBtn) filterContainer.appendChild(allBtn);

        if (this.categories.length === 0) {
            console.log('ℹ️ No categories to render');
            return;
        }

        this.categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.textContent = category.name;
            button.setAttribute('data-category', category.id);
            button.addEventListener('click', (e) => this.filterProducts(category.id, e));
            filterContainer.appendChild(button);
        });

        console.log('✅ Categories rendered:', this.categories.length);
    }

    renderProducts(categoryId = 'all') {
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) {
            console.log('❌ Products grid container not found');
            return;
        }

        console.log('🔄 Rendering products for category:', categoryId);
        
        const filteredProducts = categoryId === 'all' ?
            this.products :
            this.products.filter(product => product.category_id === categoryId);

        console.log('📦 Filtered products:', filteredProducts.length);

        if (filteredProducts.length === 0) {
            productsGrid.innerHTML = `
                <div class="no-products" style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #666;">
                    <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3>No products found</h3>
                    <p>No products available in this category.</p>
                </div>
            `;
            return;
        }

        productsGrid.innerHTML = filteredProducts.map(product => {
            const categoryName = product.categories?.name || 'General';
            const description = product.description || 'Get instant diamond delivery with secure payment.';
            
            return `
                <div class="product-card" data-product-id="${product.id}">
                    <div class="product-category-badge">
                        ${categoryName}
                    </div>
                    <h3>${product.name}</h3>
                    <p class="diamonds">${product.diamonds_count} Diamonds</p>
                    <p class="price">$${product.price}</p>
                    <p class="description">${description}</p>
                    <button class="buy-btn" onclick="window.mainPage.openProductModal('${product.id}')">
                        <i class="fas fa-shopping-cart"></i> Buy Now
                    </button>
                </div>
            `;
        }).join('');

        console.log('✅ Products rendered successfully');
    }

    renderPaymentMethods() {
        const paymentMethodSelect = document.getElementById('paymentMethod');
        if (!paymentMethodSelect || !this.paymentMethods) {
            console.log('❌ Payment method select not found');
            return;
        }

        paymentMethodSelect.innerHTML = '<option value="">Select Method</option>' +
            '<option value="wallet">Wallet Balance ($' + this.userWallet.toFixed(2) + ')</option>' +
            this.paymentMethods.map(method =>
                `<option value="${method.id}">${method.name}</option>`
            ).join('');

        // Add event listener for payment method selection
        paymentMethodSelect.addEventListener('change', (e) => {
            this.handlePaymentMethodChange(e.target.value);
        });

        console.log('✅ Payment methods rendered');
    }

    renderTopupPaymentMethods() {
        const topupPaymentSelect = document.getElementById('topupPaymentMethod');
        if (!topupPaymentSelect || !this.paymentMethods) {
            console.log('❌ Topup payment method select not found');
            return;
        }

        topupPaymentSelect.innerHTML = '<option value="">Select Method</option>' +
            this.paymentMethods.map(method =>
                `<option value="${method.id}">${method.name}</option>`
            ).join('');

        // Add event listener for topup payment method selection
        topupPaymentSelect.addEventListener('change', (e) => {
            this.handleTopupPaymentMethodChange(e.target.value);
        });

        console.log('✅ Topup payment methods rendered');
    }

    handlePaymentMethodChange(methodId) {
        const paymentInfo = document.getElementById('paymentInfo');
        const walletInfo = document.getElementById('walletBalanceInfo');
        const manualPaymentFields = document.getElementById('manualPaymentFields');
        const manualTransactionField = document.getElementById('manualTransactionField');

        if (!paymentInfo || !walletInfo) return;

        if (methodId === 'wallet') {
            paymentInfo.style.display = 'none';
            walletInfo.style.display = 'block';
            if (manualPaymentFields) manualPaymentFields.style.display = 'none';
            if (manualTransactionField) manualTransactionField.style.display = 'none';
        } else if (methodId) {
            const method = this.paymentMethods.find(m => m.id === methodId);
            if (method) {
                const paymentNumberDisplay = document.getElementById('paymentNumberDisplay');
                const paymentInstructions = document.getElementById('paymentInstructions');
                
                if (paymentNumberDisplay) paymentNumberDisplay.textContent = method.payment_number;
                if (paymentInstructions) {
                    const formattedInstructions = method.instructions?.replace(/\n/g, '<br>') || '';
                    paymentInstructions.innerHTML = formattedInstructions;
                }
                
                paymentInfo.style.display = 'block';
                walletInfo.style.display = 'none';
                if (manualPaymentFields) manualPaymentFields.style.display = 'block';
                if (manualTransactionField) manualTransactionField.style.display = 'block';
            }
        } else {
            paymentInfo.style.display = 'none';
            walletInfo.style.display = 'none';
            if (manualPaymentFields) manualPaymentFields.style.display = 'none';
            if (manualTransactionField) manualTransactionField.style.display = 'none';
        }
    }

    handleTopupPaymentMethodChange(methodId) {
        const paymentInfo = document.getElementById('topupPaymentInfo');
        if (!paymentInfo) return;

        if (!methodId) {
            paymentInfo.style.display = 'none';
            return;
        }

        const method = this.paymentMethods.find(m => m.id === methodId);
        if (method) {
            const topupPaymentNumberDisplay = document.getElementById('topupPaymentNumberDisplay');
            const topupPaymentInstructions = document.getElementById('topupPaymentInstructions');
            
            if (topupPaymentNumberDisplay) topupPaymentNumberDisplay.textContent = method.payment_number;
            if (topupPaymentInstructions) {
                const formattedInstructions = method.instructions?.replace(/\n/g, '<br>') || '';
                topupPaymentInstructions.innerHTML = formattedInstructions;
            }
            paymentInfo.style.display = 'block';
        }
    }

    filterProducts(categoryId, event) {
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        this.renderProducts(categoryId);
    }

    setupModal() {
        this.modal = document.getElementById('productModal');
        if (!this.modal) {
            console.log('❌ Product modal not found');
            return;
        }

        this.closeBtn = this.modal.querySelector('.close');
        this.paymentForm = document.getElementById('paymentForm');

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }

        window.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        if (this.paymentForm) {
            this.paymentForm.addEventListener('submit', (e) => this.submitOrder(e));
        }

        console.log('✅ Product modal setup complete');
    }

    setupWalletModal() {
        this.walletModal = document.getElementById('walletModal');
        if (!this.walletModal) {
            console.log('❌ Wallet modal not found');
            return;
        }

        this.walletCloseBtn = this.walletModal.querySelector('.close');
        this.walletTopupForm = document.getElementById('walletTopupForm');

        if (this.walletCloseBtn) {
            this.walletCloseBtn.addEventListener('click', () => this.closeWalletModal());
        }

        window.addEventListener('click', (e) => {
            if (e.target === this.walletModal) this.closeWalletModal();
        });

        if (this.walletTopupForm) {
            this.walletTopupForm.addEventListener('submit', (e) => this.submitWalletTopup(e));
        }

        console.log('✅ Wallet modal setup complete');
    }

    openProductModal(productId) {
        console.log('🔄 Opening product modal for ID:', productId);
        
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            console.error('❌ Product not found:', productId);
            alert('Product not found. Please try again.');
            return;
        }

        console.log('✅ Found product:', product.name);

        // Update modal content
        const modalProductName = document.getElementById('modalProductName');
        const modalProductDesc = document.getElementById('modalProductDesc');
        const modalProductPrice = document.getElementById('modalProductPrice');
        const modalProductDiamonds = document.getElementById('modalProductDiamonds');
        const selectedProductId = document.getElementById('selectedProductId');

        if (modalProductName) modalProductName.textContent = product.name;
        if (modalProductDesc) modalProductDesc.textContent = product.description || '';
        if (modalProductPrice) modalProductPrice.textContent = product.price;
        if (modalProductDiamonds) modalProductDiamonds.textContent = product.diamonds_count;
        if (selectedProductId) selectedProductId.value = productId;

        // Update wallet balance display
        const availableBalance = document.getElementById('availableBalance');
        if (availableBalance) availableBalance.textContent = this.userWallet.toFixed(2);

        // Reset payment info
        const paymentInfo = document.getElementById('paymentInfo');
        const walletBalanceInfo = document.getElementById('walletBalanceInfo');
        const manualPaymentFields = document.getElementById('manualPaymentFields');
        const manualTransactionField = document.getElementById('manualTransactionField');
        const paymentMethod = document.getElementById('paymentMethod');

        if (paymentInfo) paymentInfo.style.display = 'none';
        if (walletBalanceInfo) walletBalanceInfo.style.display = 'none';
        if (manualPaymentFields) manualPaymentFields.style.display = 'none';
        if (manualTransactionField) manualTransactionField.style.display = 'none';
        if (paymentMethod) paymentMethod.selectedIndex = 0;

        if (this.modal) {
            this.modal.style.display = 'block';
            console.log('✅ Product modal opened');
        }
    }

    openWalletModal() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) {
            alert('Please login to add money to wallet');
            window.location.href = 'login.html';
            return;
        }

        const currentWalletBalance = document.getElementById('currentWalletBalance');
        const topupPaymentInfo = document.getElementById('topupPaymentInfo');
        const topupPaymentMethod = document.getElementById('topupPaymentMethod');

        if (currentWalletBalance) currentWalletBalance.textContent = this.userWallet.toFixed(2);
        if (topupPaymentInfo) topupPaymentInfo.style.display = 'none';
        if (topupPaymentMethod) topupPaymentMethod.selectedIndex = 0;
        
        if (this.walletTopupForm) this.walletTopupForm.reset();
        
        if (this.walletModal) {
            this.walletModal.style.display = 'block';
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
        if (this.paymentForm) {
            this.paymentForm.reset();
        }
        
        const paymentInfo = document.getElementById('paymentInfo');
        const walletBalanceInfo = document.getElementById('walletBalanceInfo');
        const manualPaymentFields = document.getElementById('manualPaymentFields');
        const manualTransactionField = document.getElementById('manualTransactionField');

        if (paymentInfo) paymentInfo.style.display = 'none';
        if (walletBalanceInfo) walletBalanceInfo.style.display = 'none';
        if (manualPaymentFields) manualPaymentFields.style.display = 'none';
        if (manualTransactionField) manualTransactionField.style.display = 'none';
    }

    closeWalletModal() {
        if (this.walletModal) {
            this.walletModal.style.display = 'none';
        }
        if (this.walletTopupForm) {
            this.walletTopupForm.reset();
        }
        
        const topupPaymentInfo = document.getElementById('topupPaymentInfo');
        if (topupPaymentInfo) topupPaymentInfo.style.display = 'none';
    }

    // Simplified wallet transaction function
    async createWalletTransaction(userId, amount, type, description = '') {
        try {
            const transactionData = {
                user_id: userId,
                amount: amount,
                type: type,
                description: description,
                status: 'completed',
                created_at: new Date().toISOString()
            };

            // Only include payment_method for purchases
            if (type === 'purchase') {
                transactionData.payment_method = 'Wallet';
            }

            console.log('Creating wallet transaction:', transactionData);

            const { error } = await window.supabase
                .from('wallet_transactions')
                .insert([transactionData]);

            if (error) {
                console.error('Error creating wallet transaction:', error);
                // Don't throw error for transaction recording - it shouldn't block the main order
                console.warn('Wallet transaction recording failed, but order will continue');
            }

            return true;
        } catch (error) {
            console.error('Exception in createWalletTransaction:', error);
            // Don't throw error - continue with order
            return false;
        }
    }

    async submitOrder(e) {
        e.preventDefault();

        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) {
            alert('Please login to place an order');
            window.location.href = 'login.html';
            return;
        }

        // Get form values
        const productId = document.getElementById('selectedProductId').value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        const paymentNumber = document.getElementById('paymentNumber').value;
        const transactionId = document.getElementById('transactionId').value;
        const gameId = document.getElementById('gameId').value;

        console.log('🔄 Order submission started...');
        console.log('Product ID:', productId);
        console.log('Payment Method:', paymentMethod);

        // Validate form
        if (!paymentMethod || !gameId) {
            alert('Please fill all required fields');
            return;
        }

        const product = this.products.find(p => p.id === productId);
        if (!product) {
            alert('Product not found');
            return;
        }

        // Check wallet balance if paying with wallet
        if (paymentMethod === 'wallet') {
            if (this.userWallet < product.price) {
                alert('Insufficient wallet balance. Please add money to your wallet.');
                this.closeModal();
                this.openWalletModal();
                return;
            }
        } else {
            if (!paymentNumber || !transactionId) {
                alert('Please fill all payment details');
                return;
            }
        }

        let paymentMethodName = 'Wallet';
        if (paymentMethod !== 'wallet') {
            const selectedMethod = this.paymentMethods.find(m => m.id === paymentMethod);
            if (!selectedMethod) {
                alert('Invalid payment method selected');
                return;
            }
            paymentMethodName = selectedMethod.name;
        }

        const orderData = {
            user_id: currentUser.id,
            product_id: productId,
            payment_method: paymentMethodName,
            payment_number: paymentMethod === 'wallet' ? '' : paymentNumber,
            transaction_id: paymentMethod === 'wallet' ? '' : transactionId,
            game_id: gameId,
            status: 'pending'
        };

        console.log('Order data to submit:', orderData);

        try {
            // Show loading state
            const submitBtn = document.querySelector('#paymentForm .submit-btn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Placing Order...';
            submitBtn.disabled = true;

            // If paying with wallet, deduct balance
            if (paymentMethod === 'wallet') {
                const newBalance = this.userWallet - product.price;
                
                // Update wallet balance
                const { error: walletError } = await window.supabase
                    .from('users')
                    .update({ wallet_balance: newBalance })
                    .eq('id', currentUser.id);

                if (walletError) throw walletError;

                // Record wallet transaction (won't block order if it fails)
                await this.createWalletTransaction(
                    currentUser.id, 
                    -product.price, 
                    'purchase', 
                    `Purchase: ${product.name}`
                );

                this.userWallet = newBalance;
                this.updateWalletDisplay();
            }

            // Create order
            const { data, error } = await window.supabase
                .from('orders')
                .insert([orderData])
                .select()
                .single();

            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;

            if (error) {
                console.error('❌ Order error details:', error);
                throw new Error('Order failed: ' + error.message);
            }

            if (!data) {
                throw new Error('No order data returned from server');
            }

            console.log('✅ Order placed successfully:', data);
            alert('Order placed successfully! We will process it shortly.');
            this.closeModal();

            // Redirect to account page to see the order
            window.location.href = 'account.html';

        } catch (error) {
            console.error('❌ Error placing order:', error);
            alert('Error: ' + error.message);
            
            // Reset button
            const submitBtn = document.querySelector('#paymentForm .submit-btn');
            submitBtn.textContent = 'Submit Order';
            submitBtn.disabled = false;
        }
    }

    async submitWalletTopup(e) {
        e.preventDefault();

        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) {
            alert('Please login to add money');
            window.location.href = 'login.html';
            return;
        }

        const amount = parseFloat(document.getElementById('topupAmount').value);
        const paymentMethodId = document.getElementById('topupPaymentMethod').value;
        const paymentNumber = document.getElementById('topupPaymentNumber').value;
        const transactionId = document.getElementById('topupTransactionId').value;

        // Validation
        if (!amount || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        if (!paymentMethodId) {
            alert('Please select a payment method');
            return;
        }

        if (!transactionId) {
            alert('Please enter transaction ID');
            return;
        }

        // Get payment method details
        const selectedMethod = this.paymentMethods.find(m => m.id === paymentMethodId);
        if (!selectedMethod) {
            alert('Invalid payment method selected');
            return;
        }

        try {
            const submitBtn = document.querySelector('#walletTopupForm .submit-btn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Submitting...';
            submitBtn.disabled = true;

            // Create wallet recharge request
            const rechargeData = {
                user_id: currentUser.id,
                amount: amount,
                payment_method: selectedMethod.name,
                payment_number: paymentNumber,
                transaction_id: transactionId,
                status: 'pending'
            };

            console.log('Submitting recharge request:', rechargeData);

            const { data, error } = await window.supabase
                .from('wallet_recharge_requests')
                .insert([rechargeData])
                .select()
                .single();

            if (error) {
                console.error('Supabase error:', error);
                throw new Error('Failed to submit recharge request: ' + error.message);
            }

            submitBtn.textContent = originalText;
            submitBtn.disabled = false;

            if (!data) {
                throw new Error('No data returned from server');
            }

            console.log('Recharge request submitted successfully:', data);
            
            alert('Recharge request submitted successfully! We will process it shortly.');
            this.closeWalletModal();
            
        } catch (error) {
            console.error('Error submitting recharge request:', error);
            alert('Error: ' + error.message);
            
            const submitBtn = document.querySelector('#walletTopupForm .submit-btn');
            submitBtn.textContent = 'Add Money';
            submitBtn.disabled = false;
        }
    }

    setupEventListeners() {
        // Mobile menu toggle
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');

        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                const isVisible = navMenu.style.display === 'flex';
                navMenu.style.display = isVisible ? 'none' : 'flex';
            });
        }

        // Smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });

        // Bottom navigation active state
        const bottomNavItems = document.querySelectorAll('.bottom-nav .nav-item');
        bottomNavItems.forEach(item => {
            item.addEventListener('click', function() {
                bottomNavItems.forEach(nav => nav.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // Initialize products with "All" category
        const allBtn = document.querySelector('[data-category="all"]');
        if (allBtn) {
            allBtn.addEventListener('click', (e) => this.filterProducts('all', e));
        }

        console.log('✅ Event listeners setup complete');
    }

    openWhatsApp() {
        const phoneNumber = this.siteSettings.whatsapp_number || '1234567890';
        const message = 'Hello! I need help with Fire Diamond Topup.';
        window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
    }
}

// Initialize main page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM Content Loaded - Initializing MainPage');
    window.mainPage = new MainPage();
});

// Fallback initialization
window.addEventListener('load', function() {
    if (!window.mainPage) {
        console.log('🔄 Fallback initialization');
        window.mainPage = new MainPage();
    }
});