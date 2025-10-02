// Main page functionality
class MainPage {
    constructor() {
        this.categories = [];
        this.products = [];
        this.init();
    }

    async init() {
        await this.waitForSupabase();
        await this.loadCategories();
        await this.loadProducts();
        this.setupEventListeners();
        this.setupModal();
    }

    async waitForSupabase() {
        return new Promise((resolve) => {
            const checkSupabase = () => {
                if (typeof window.supabase !== 'undefined') {
                    console.log('Supabase ready for main page');
                    resolve();
                } else {
                    setTimeout(checkSupabase, 100);
                }
            };
            checkSupabase();
        });
    }

    async loadCategories() {
        try {
            const { data, error } = await window.supabase
                .from('categories')
                .select('*')
                .eq('is_active', true);

            if (error) {
                console.error('Error loading categories:', error);
                return;
            }

            this.categories = data || [];
            this.renderCategories();
        } catch (error) {
            console.error('Error in loadCategories:', error);
        }
    }

    async loadProducts() {
        try {
            const { data, error } = await window.supabase
                .from('products')
                .select(`
                    *,
                    categories (name)
                `)
                .eq('is_active', true);

            if (error) {
                console.error('Error loading products:', error);
                return;
            }

            this.products = data || [];
            this.renderProducts();
        } catch (error) {
            console.error('Error in loadProducts:', error);
        }
    }

    renderCategories() {
        const filterContainer = document.querySelector('.category-filter');
        if (!filterContainer) return;

        // Clear existing buttons (except "All")
        const allBtn = filterContainer.querySelector('[data-category="all"]');
        filterContainer.innerHTML = '';
        if (allBtn) filterContainer.appendChild(allBtn);

        this.categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.textContent = category.name;
            button.setAttribute('data-category', category.id);
            button.addEventListener('click', (e) => this.filterProducts(category.id, e));
            filterContainer.appendChild(button);
        });
    }

    renderProducts(categoryId = 'all') {
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) return;

        const filteredProducts = categoryId === 'all' 
            ? this.products 
            : this.products.filter(product => product.category_id === categoryId);

        if (filteredProducts.length === 0) {
            productsGrid.innerHTML = '<p class="no-products">No products found in this category.</p>';
            return;
        }

        productsGrid.innerHTML = filteredProducts.map(product => `
            <div class="product-card" data-product-id="${product.id}">
                <h3>${product.name}</h3>
                <p class="diamonds">${product.diamonds_count} Diamonds</p>
                <p class="price">৳${product.price}</p>
                <p class="description">${product.description || ''}</p>
                <button class="buy-btn" onclick="window.mainPage.openProductModal('${product.id}')">
                    Buy Now
                </button>
            </div>
        `).join('');
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
        this.closeBtn = this.modal.querySelector('.close');
        this.paymentForm = document.getElementById('paymentForm');

        this.closeBtn.addEventListener('click', () => this.closeModal());
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        this.paymentForm.addEventListener('submit', (e) => this.submitOrder(e));
    }

    openProductModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        document.getElementById('modalProductName').textContent = product.name;
        document.getElementById('modalProductDesc').textContent = product.description || '';
        document.getElementById('modalProductPrice').textContent = product.price;
        document.getElementById('modalProductDiamonds').textContent = product.diamonds_count;
        document.getElementById('selectedProductId').value = productId;

        this.modal.style.display = 'block';
    }

    closeModal() {
        this.modal.style.display = 'none';
        this.paymentForm.reset();
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

        // Validate form
        if (!paymentMethod || !paymentNumber || !transactionId || !gameId) {
            alert('Please fill all required fields');
            return;
        }

        const orderData = {
            user_id: currentUser.id,
            product_id: productId,
            payment_method: paymentMethod,
            payment_number: paymentNumber,
            transaction_id: transactionId,
            game_id: gameId,
            status: 'pending'
        };

        console.log('Submitting order:', orderData);

        try {
            // Show loading state
            const submitBtn = document.querySelector('.submit-btn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Placing Order...';
            submitBtn.disabled = true;

            const { data, error } = await window.supabase
                .from('orders')
                .insert([orderData])
                .select()
                .single();

            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;

            if (error) {
                console.error('Order error details:', error);
                
                if (error.code === '42501') {
                    throw new Error('Order failed due to security policy. Please contact administrator.');
                }
                
                if (error.message.includes('row-level security')) {
                    throw new Error('Order blocked by security policy. Please run the SQL commands to fix RLS.');
                }
                
                if (error.message.includes('foreign key constraint')) {
                    throw new Error('Invalid product selected. Please try again.');
                }
                
                throw new Error('Order failed: ' + error.message);
            }

            if (!data) {
                throw new Error('No order data returned from server');
            }

            alert('Order placed successfully! We will process it shortly.');
            this.closeModal();
            
            // Redirect to account page to see the order
            window.location.href = 'account.html';
            
        } catch (error) {
            console.error('Error placing order:', error);
            alert('Error: ' + error.message);
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
            anchor.addEventListener('click', function (e) {
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
    }
}

// Initialize main page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.mainPage = new MainPage();
});
