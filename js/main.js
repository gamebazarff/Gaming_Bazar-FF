// Main page functionality
class MainPage {
    constructor() {
        this.categories = [];
        this.products = [];
        this.paymentMethods = [];
        this.userWallet = 0;
        this.siteSettings = {};
        this.isSubmitting = false; // Single flag for all submissions
        this.walletModalInitialized = false; // Track if wallet modal is initialized
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
        this.checkUserAccess();
        this.loadAccountData(); // Load account data if on account page
        console.log('✅ MainPage initialized successfully');
    }

    // Load account specific data
    async loadAccountData() {
        if (window.location.pathname.includes('account.html')) {
            console.log('📊 Loading account page data...');
            await this.loadUserProfile();
            await this.loadUserOrders();
            await this.loadTransactions();
            await this.loadRechargeRequests();
        }
    }

    async loadUserProfile() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) return;

        try {
            // Update wallet balance
            const { data, error } = await window.supabase
                .from('users')
                .select('wallet_balance')
                .eq('id', currentUser.id)
                .single();

            if (!error && data) {
                this.userWallet = data.wallet_balance || 0;
                this.updateWalletDisplay();
            }

            // Update profile information in account page
            if (document.getElementById('userName')) {
                document.getElementById('userName').textContent = currentUser.full_name;
                document.getElementById('userEmail').textContent = currentUser.email;
                document.getElementById('profileName').textContent = currentUser.full_name;
                document.getElementById('profileEmail').textContent = currentUser.email;
                document.getElementById('profileMobile').textContent = currentUser.mobile_number;
                document.getElementById('profileSince').textContent = new Date(currentUser.created_at).toLocaleDateString();
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    async loadUserOrders() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) return;

        try {
            const { data: orders, error } = await window.supabase
                .from('orders')
                .select('*, products (name, diamonds_count, price)')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading orders:', error);
                return;
            }

            const ordersList = document.getElementById('ordersList');
            if (!ordersList) return;

            if (!orders || orders.length === 0) {
                ordersList.innerHTML = '<p>কোন অর্ডার পাওয়া যায়নি।</p>';
                return;
            }

            ordersList.innerHTML = orders.map(order => `
                <div class="order-card">
                    <div class="order-header">
                        <h3>${order.products.name}</h3>
                        <span class="order-status ${order.status}">${order.status}</span>
                    </div>
                    <div class="order-details">
                        <p><strong>ডায়মন্ড:</strong> ${order.products.diamonds_count}</p>
                        <p><strong>মূল্য:</strong> ৳${order.products.price}</p>
                        <p><strong>পেমেন্ট পদ্ধতি:</strong> ${order.payment_method}</p>
                        <p><strong>পেমেন্ট নম্বর:</strong> ${order.payment_number}</p>
                        <p><strong>ট্রান্সজেকশন আইডি:</strong> ${order.transaction_id}</p>
                        <p><strong>গেম আইডি:</strong> ${order.game_id}</p>
                        <p><strong>তারিখ:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading user orders:', error);
        }
    }

    async loadTransactions() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) return;

        try {
            const { data: transactions, error } = await window.supabase
                .from('wallet_transactions')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading transactions:', error);
                return;
            }

            const transactionsList = document.getElementById('transactionsList');
            if (!transactionsList) return;

            if (!transactions || transactions.length === 0) {
                transactionsList.innerHTML = '<p>কোন লেনদেন পাওয়া যায়নি।</p>';
                return;
            }

            transactionsList.innerHTML = transactions.map(transaction => {
                let transactionType = 'অজানা';
                let amountClass = '';
                let amountDisplay = transaction.amount;

                if (transaction.type === 'topup' || transaction.amount > 0) {
                    transactionType = 'টপআপ';
                    amountClass = 'text-success';
                    amountDisplay = `+৳${Math.abs(transaction.amount)}`;
                } else if (transaction.type === 'purchase' || transaction.amount < 0) {
                    transactionType = 'ক্রয়';
                    amountClass = 'text-danger';
                    amountDisplay = `-৳${Math.abs(transaction.amount)}`;
                } else {
                    amountDisplay = `৳${Math.abs(transaction.amount)}`;
                }

                return `
                    <div class="order-card">
                        <div class="order-header">
                            <h3>${transactionType}</h3>
                            <span class="order-status ${transaction.status}">${transaction.status}</span>
                        </div>
                        <div class="order-details">
                            <p><strong>পরিমাণ:</strong> <span class="${amountClass}" style="font-weight: bold;">${amountDisplay}</span></p>
                            <p><strong>ধরন:</strong> ${transaction.type || 'N/A'}</p>
                            <p><strong>পেমেন্ট পদ্ধতি:</strong> ${transaction.payment_method || 'N/A'}</p>
                            ${transaction.transaction_id ? `<p><strong>লেনদেন আইডি:</strong> ${transaction.transaction_id}</p>` : ''}
                            ${transaction.description ? `<p><strong>বিবরণ:</strong> ${transaction.description}</p>` : ''}
                            <p><strong>তারিখ:</strong> ${new Date(transaction.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    }

    async loadRechargeRequests() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) return;

        try {
            const { data: rechargeRequests, error } = await window.supabase
                .from('wallet_recharge_requests')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading recharge requests:', error);
                return;
            }

            const rechargeList = document.getElementById('rechargeRequestsList');
            if (!rechargeList) return;

            if (!rechargeRequests || rechargeRequests.length === 0) {
                rechargeList.innerHTML = '<p>কোন রিচার্জ রিকোয়েস্ট পাওয়া যায়নি।</p>';
                return;
            }

            rechargeList.innerHTML = rechargeRequests.map(request => `
                <div class="order-card">
                    <div class="order-header">
                        <h3>ওয়ালেট রিচার্জ - ৳${request.amount}</h3>
                        <span class="order-status ${request.status}">${request.status}</span>
                    </div>
                    <div class="order-details">
                        <p><strong>পেমেন্ট পদ্ধতি:</strong> ${request.payment_method}</p>
                        <p><strong>পেমেন্ট নম্বর:</strong> ${request.payment_number || 'N/A'}</p>
                        <p><strong>লেনদেন আইডি:</strong> ${request.transaction_id}</p>
                        <p><strong>তারিখ:</strong> ${new Date(request.created_at).toLocaleDateString()}</p>
                        ${request.admin_notes ? `<p><strong>এডমিন নোট:</strong> ${request.admin_notes}</p>` : ''}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading recharge requests:', error);
        }
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
        console.log('🎨 Applying site settings:', settings);

        // Update site content
        const siteTitle = document.getElementById('siteTitle');
        const siteName = document.getElementById('siteName');
        const footerName = document.getElementById('footerName');
        const bannerText = document.getElementById('bannerText');
        const topBanner = document.getElementById('topBanner');

        if (siteTitle) {
            siteTitle.textContent = settings.site_name || 'ফায়ার ডায়মন্ড টপআপ';
            console.log('✅ Site title updated:', settings.site_name);
        }

        if (siteName) {
            siteName.textContent = settings.site_name || 'ফায়ার ডায়মন্ড';
            console.log('✅ Site name updated:', settings.site_name);
        }

        if (footerName) {
            footerName.textContent = settings.site_name || 'ফায়ার ডায়মন্ড টপআপ';
            console.log('✅ Footer name updated:', settings.site_name);
        }

        // Banner text and visibility
        if (bannerText && topBanner) {
            if (settings.banner_text && settings.banner_text.trim() !== '') {
                bannerText.textContent = settings.banner_text;
                topBanner.style.display = 'block';
                console.log('✅ Banner updated:', settings.banner_text);
            } else {
                topBanner.style.display = 'none';
                console.log('✅ Banner hidden');
            }
        }

        // Store WhatsApp number for support
        this.siteSettings.whatsapp_number = settings.whatsapp_number || '1234567890';
        console.log('✅ WhatsApp number stored:', this.siteSettings.whatsapp_number);
    }

    applyDefaultSiteSettings() {
        const defaultSettings = {
            site_name: 'ফায়ার ডায়মন্ড টপআপ',
            banner_text: '🔥 তাৎক্ষণিক ডায়মন্ড ডেলিভারী | ২৪/৭ সাপোর্ট',
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
                    <h3>কোন পণ্য পাওয়া যায়নি</h3>
                    <p>এই ক্যাটাগরিতে কোন পণ্য নেই।</p>
                </div>
            `;
            return;
        }

        productsGrid.innerHTML = filteredProducts.map(product => {
            const categoryName = product.categories?.name || 'সাধারণ';
            const description = product.description || 'সুরক্ষিত পেমেন্টের সাথে তাৎক্ষণিক ডায়মন্ড ডেলিভারি পান।';

            return `
                <div class="product-card" data-product-id="${product.id}">
                    <div class="product-category-badge">
                        ${categoryName}
                    </div>
                    <h3>${product.name}</h3>
                    <p class="diamonds">${product.diamonds_count} ডায়মন্ড</p>
                    <p class="price">৳${product.price}</p>
                    <p class="description">${description}</p>
                    <button class="buy-btn" onclick="window.mainPage.openProductModal('${product.id}')">
                        <i class="fas fa-shopping-cart"></i> এখনই কিনুন
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

        paymentMethodSelect.innerHTML = '<option value="">পদ্ধতি নির্বাচন করুন</option>' +
            '<option value="wallet">ওয়ালেট ব্যালেন্স (৳' + this.userWallet.toFixed(2) + ')</option>' +
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

        topupPaymentSelect.innerHTML = '<option value="">পদ্ধতি নির্বাচন করুন</option>' +
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
        // Prevent multiple initialization
        if (this.walletModalInitialized) {
            console.log('ℹ️ Wallet modal already initialized');
            return;
        }

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
            // Remove any existing event listeners first
            const newForm = this.walletTopupForm.cloneNode(true);
            this.walletTopupForm.parentNode.replaceChild(newForm, this.walletTopupForm);
            this.walletTopupForm = newForm;

            // Add single event listener
            this.walletTopupForm.addEventListener('submit', (e) => this.submitWalletTopup(e));
        }

        this.walletModalInitialized = true;
        console.log('✅ Wallet modal setup complete');
    }

    openProductModal(productId) {
        console.log('🔄 Opening product modal for ID:', productId);

        const product = this.products.find(p => p.id === productId);
        if (!product) {
            console.error('❌ Product not found:', productId);
            alert('পণ্যটি পাওয়া যায়নি। দয়া করে আবার চেষ্টা করুন।');
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
        if (modalProductPrice) modalProductPrice.textContent = '৳' + product.price;
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
            alert('ওয়ালেটে টাকা যোগ করতে অনুগ্রহ করে লগইন করুন');
            window.location.href = 'login.html';
            return;
        }

        // Ensure wallet modal is setup
        if (!this.walletModalInitialized) {
            this.setupWalletModal();
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
            console.log('✅ Wallet modal opened');
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
            alert('অর্ডার দিতে অনুগ্রহ করে লগইন করুন');
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
            alert('অনুগ্রহ করে সব প্রয়োজনীয় তথ্য প্রদান করুন');
            return;
        }

        const product = this.products.find(p => p.id === productId);
        if (!product) {
            alert('পণ্যটি পাওয়া যায়নি');
            return;
        }

        // Check wallet balance if paying with wallet
        if (paymentMethod === 'wallet') {
            if (this.userWallet < product.price) {
                alert('অপর্যাপ্ত ওয়ালেট ব্যালেন্স। দয়া করে আপনার ওয়ালেটে টাকা যোগ করুন।');
                this.closeModal();
                this.openWalletModal();
                return;
            }
        } else {
            if (!paymentNumber || !transactionId) {
                alert('অনুগ্রহ করে সব পেমেন্ট বিবরণ প্রদান করুন');
                return;
            }
        }

        let paymentMethodName = 'ওয়ালেট';
        if (paymentMethod !== 'wallet') {
            const selectedMethod = this.paymentMethods.find(m => m.id === paymentMethod);
            if (!selectedMethod) {
                alert('অবৈধ পেমেন্ট পদ্ধতি নির্বাচন করা হয়েছে');
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
            submitBtn.textContent = 'অর্ডার দেওয়া হচ্ছে...';
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
                    `ক্রয়: ${product.name}`
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
                throw new Error('অর্ডার ব্যর্থ: ' + error.message);
            }

            if (!data) {
                throw new Error('সার্ভার থেকে কোন অর্ডার ডেটা পাওয়া যায়নি');
            }

            console.log('✅ Order placed successfully:', data);
            alert('অর্ডার সফলভাবে দেওয়া হয়েছে! আমরা শীঘ্রই এটি প্রক্রিয়া করব।');
            this.closeModal();

            // Redirect to account page to see the order
            window.location.href = 'account.html';

        } catch (error) {
            console.error('❌ Error placing order:', error);
            alert('ত্রুটি: ' + error.message);

            // Reset button
            const submitBtn = document.querySelector('#paymentForm .submit-btn');
            submitBtn.textContent = 'অর্ডার সাবমিট করুন';
            submitBtn.disabled = false;
        }
    }

    async submitWalletTopup(e) {
        e.preventDefault();

        // Prevent multiple submissions
        if (this.isSubmitting) {
            console.log('⏳ Already submitting, please wait...');
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) {
            alert('টাকা যোগ করতে অনুগ্রহ করে লগইন করুন');
            window.location.href = 'login.html';
            return;
        }

        const amount = parseFloat(document.getElementById('topupAmount').value);
        const paymentMethodId = document.getElementById('topupPaymentMethod').value;
        const paymentNumber = document.getElementById('topupPaymentNumber').value;
        const transactionId = document.getElementById('topupTransactionId').value;

        // Validation
        if (!amount || amount <= 0) {
            alert('অনুগ্রহ করে একটি বৈধ পরিমাণ লিখুন');
            return;
        }

        if (!paymentMethodId) {
            alert('অনুগ্রহ করে একটি পেমেন্ট পদ্ধতি নির্বাচন করুন');
            return;
        }

        if (!transactionId) {
            alert('অনুগ্রহ করে লেনদেন আইডি লিখুন');
            return;
        }

        // Get payment method details
        const selectedMethod = this.paymentMethods.find(m => m.id === paymentMethodId);
        if (!selectedMethod) {
            alert('অবৈধ পেমেন্ট পদ্ধতি নির্বাচন করা হয়েছে');
            return;
        }

        // Set submitting flag
        this.isSubmitting = true;

        try {
            const submitBtn = document.querySelector('#walletTopupForm .submit-btn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'সাবমিট করা হচ্ছে...';
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
                throw new Error('রিচার্জ রিকোয়েস্ট জমা দিতে ব্যর্থ: ' + error.message);
            }

            if (!data) {
                throw new Error('সার্ভার থেকে কোন ডেটা পাওয়া যায়নি');
            }

            console.log('Recharge request submitted successfully:', data);

            alert('রিচার্জ রিকোয়েস্ট সফলভাবে জমা দেওয়া হয়েছে! আমরা শীঘ্রই এটি প্রক্রিয়া করব।');
            this.closeWalletModal();

            // Reload recharge requests if on account page
            if (window.location.pathname.includes('account.html')) {
                await this.loadRechargeRequests();
            }

        } catch (error) {
            console.error('Error submitting recharge request:', error);
            alert('ত্রুটি: ' + error.message);
        } finally {
            // Reset submitting flag and button state
            this.isSubmitting = false;
            const submitBtn = document.querySelector('#walletTopupForm .submit-btn');
            if (submitBtn) {
                submitBtn.textContent = 'টাকা যোগ করুন';
                submitBtn.disabled = false;
            }
        }
    }

    // Check user access and redirect if needed
    checkUserAccess() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));

        // If admin is logged in, they can stay on home page but can't access without login
        if (currentUser && currentUser.email === 'admin123@gmail.com') {
            console.log('Admin user accessing home page');
            // Admin can stay on home page, no redirect needed
        }

        // Regular users can access home page normally
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
        const message = 'Hello! I need help with Free Fire Diamond Topup.';
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