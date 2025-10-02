// Admin panel functionality
class AdminPanel {
    constructor() {
        this.categories = [];
        this.products = [];
        this.orders = [];
        this.init();
    }

    async init() {
        await this.loadStats();
        await this.loadCategories();
        await this.loadProducts();
        await this.loadOrders();
        this.setupEventListeners();
        this.setupModals();
    }

    async loadStats() {
        // Total orders
        const { count: totalOrders } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true });

        // Pending orders
        const { count: pendingOrders } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        // Total products
        const { count: totalProducts } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        // Total users
        const { count: totalUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        document.getElementById('totalOrders').textContent = totalOrders || 0;
        document.getElementById('pendingOrders').textContent = pendingOrders || 0;
        document.getElementById('totalProducts').textContent = totalProducts || 0;
        document.getElementById('totalUsers').textContent = totalUsers || 0;
    }

    async loadCategories() {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading categories:', error);
            return;
        }

        this.categories = data;
        this.renderCategories();
    }

    async loadProducts() {
        const { data, error } = await supabase
            .from('products')
            .select(`
                *,
                categories (name)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading products:', error);
            return;
        }

        this.products = data;
        this.renderProducts();
        this.populateCategorySelect();
    }

    async loadOrders() {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                products (name, price),
                users (email, full_name)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading orders:', error);
            return;
        }

        this.orders = data;
        this.renderOrders();
    }

    renderCategories() {
        const tbody = document.querySelector('#categoriesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = this.categories.map(category => `
            <tr>
                <td>${category.name}</td>
                <td>${category.description || '-'}</td>
                <td>
                    <span class="status-badge ${category.is_active ? 'status-active' : 'status-inactive'}">
                        ${category.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="action-buttons">
                    <button class="btn-primary" onclick="adminPanel.editCategory('${category.id}')">
                        Edit
                    </button>
                    <button class="btn-danger" onclick="adminPanel.toggleCategoryStatus('${category.id}', ${!category.is_active})">
                        ${category.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderProducts() {
        const tbody = document.querySelector('#productsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = this.products.map(product => `
            <tr>
                <td>${product.name}</td>
                <td>${product.categories?.name || '-'}</td>
                <td>${product.diamonds_count}</td>
                <td>৳${product.price}</td>
                <td>
                    <span class="status-badge ${product.is_active ? 'status-active' : 'status-inactive'}">
                        ${product.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="action-buttons">
                    <button class="btn-primary" onclick="adminPanel.editProduct('${product.id}')">
                        Edit
                    </button>
                    <button class="btn-danger" onclick="adminPanel.toggleProductStatus('${product.id}', ${!product.is_active})">
                        ${product.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderOrders() {
        const tbody = document.querySelector('#ordersTable tbody');
        if (!tbody) return;

        tbody.innerHTML = this.orders.map(order => `
            <tr>
                <td>${order.id.substring(0, 8)}...</td>
                <td>${order.products?.name || '-'}</td>
                <td>${order.users?.email || '-'}</td>
                <td>৳${order.products?.price || '0'}</td>
                <td>${order.payment_method}</td>
                <td>
                    <span class="status-badge status-${order.status}">
                        ${order.status}
                    </span>
                </td>
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                <td class="action-buttons">
                    <button class="btn-success" onclick="adminPanel.updateOrderStatus('${order.id}', 'completed')">
                        Complete
                    </button>
                    <button class="btn-danger" onclick="adminPanel.updateOrderStatus('${order.id}', 'cancelled')">
                        Cancel
                    </button>
                </td>
            </tr>
        `).join('');
    }

    populateCategorySelect() {
        const select = document.getElementById('productCategory');
        if (!select) return;

        select.innerHTML = '<option value="">Select Category</option>' +
            this.categories
            .filter(cat => cat.is_active)
            .map(cat => `<option value="${cat.id}">${cat.name}</option>`)
            .join('');
    }

    setupEventListeners() {
        // Tab navigation
        const navItems = document.querySelectorAll('.nav-item');
        const tabContents = document.querySelectorAll('.tab-content');

        navItems.forEach(item => {
            if (item.getAttribute('href') && item.getAttribute('href').startsWith('#')) {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = item.getAttribute('href').substring(1);

                    // Update active nav item
                    navItems.forEach(nav => nav.classList.remove('active'));
                    item.classList.add('active');

                    // Update page title
                    document.getElementById('pageTitle').textContent =
                        target.charAt(0).toUpperCase() + target.slice(1);

                    // Show target tab
                    tabContents.forEach(tab => tab.classList.remove('active'));
                    document.getElementById(target).classList.add('active');
                });
            }
        });

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                auth.logout();
            });
        }
    }

    setupModals() {
        // Category modal
        this.categoryModal = document.getElementById('categoryModal');
        this.categoryForm = document.getElementById('categoryForm');

        this.categoryForm.addEventListener('submit', (e) => this.saveCategory(e));

        // Product modal
        this.productModal = document.getElementById('productModal');
        this.productForm = document.getElementById('productForm');

        this.productForm.addEventListener('submit', (e) => this.saveProduct(e));
    }

    // Category methods
    openCategoryModal(categoryId = null) {
        const title = document.getElementById('categoryModalTitle');
        const form = document.getElementById('categoryForm');

        if (categoryId) {
            title.textContent = 'Edit Category';
            const category = this.categories.find(c => c.id === categoryId);
            if (category) {
                document.getElementById('categoryId').value = category.id;
                document.getElementById('categoryName').value = category.name;
                document.getElementById('categoryDescription').value = category.description || '';
                document.getElementById('categoryStatus').value = category.is_active;
            }
        } else {
            title.textContent = 'Add Category';
            form.reset();
            document.getElementById('categoryId').value = '';
        }

        this.categoryModal.style.display = 'block';
    }

    closeCategoryModal() {
        this.categoryModal.style.display = 'none';
    }

    async saveCategory(e) {
        e.preventDefault();

        const categoryData = {
            name: document.getElementById('categoryName').value,
            description: document.getElementById('categoryDescription').value,
            is_active: document.getElementById('categoryStatus').value === 'true'
        };

        const categoryId = document.getElementById('categoryId').value;

        try {
            if (categoryId) {
                // Update existing category
                const { error } = await supabase
                    .from('categories')
                    .update(categoryData)
                    .eq('id', categoryId);

                if (error) throw error;
            } else {
                // Insert new category
                const { error } = await supabase
                    .from('categories')
                    .insert([categoryData]);

                if (error) throw error;
            }

            this.closeCategoryModal();
            await this.loadCategories();
            await this.loadProducts(); // Reload products to refresh category data
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Error saving category. Please try again.');
        }
    }

    async toggleCategoryStatus(categoryId, newStatus) {
        try {
            const { error } = await supabase
                .from('categories')
                .update({ is_active: newStatus })
                .eq('id', categoryId);

            if (error) throw error;

            await this.loadCategories();
            await this.loadProducts();
        } catch (error) {
            console.error('Error updating category status:', error);
            alert('Error updating category status.');
        }
    }

    // Product methods
    openProductModal(productId = null) {
        const title = document.getElementById('productModalTitle');
        const form = document.getElementById('productForm');

        if (productId) {
            title.textContent = 'Edit Product';
            const product = this.products.find(p => p.id === productId);
            if (product) {
                document.getElementById('productId').value = product.id;
                document.getElementById('productName').value = product.name;
                document.getElementById('productCategory').value = product.category_id;
                document.getElementById('productDescription').value = product.description || '';
                document.getElementById('productDiamonds').value = product.diamonds_count;
                document.getElementById('productPrice').value = product.price;
                document.getElementById('productStatus').value = product.is_active;
            }
        } else {
            title.textContent = 'Add Product';
            form.reset();
            document.getElementById('productId').value = '';
        }

        this.productModal.style.display = 'block';
    }

    closeProductModal() {
        this.productModal.style.display = 'none';
    }

    async saveProduct(e) {
        e.preventDefault();

        const productData = {
            name: document.getElementById('productName').value,
            category_id: document.getElementById('productCategory').value,
            description: document.getElementById('productDescription').value,
            diamonds_count: parseInt(document.getElementById('productDiamonds').value),
            price: parseFloat(document.getElementById('productPrice').value),
            is_active: document.getElementById('productStatus').value === 'true'
        };

        const productId = document.getElementById('productId').value;

        try {
            if (productId) {
                // Update existing product
                const { error } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', productId);

                if (error) throw error;
            } else {
                // Insert new product
                const { error } = await supabase
                    .from('products')
                    .insert([productData]);

                if (error) throw error;
            }

            this.closeProductModal();
            await this.loadProducts();
            await this.loadStats();
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Error saving product. Please try again.');
        }
    }

    async toggleProductStatus(productId, newStatus) {
        try {
            const { error } = await supabase
                .from('products')
                .update({ is_active: newStatus })
                .eq('id', productId);

            if (error) throw error;

            await this.loadProducts();
            await this.loadStats();
        } catch (error) {
            console.error('Error updating product status:', error);
            alert('Error updating product status.');
        }
    }

    // Order methods
    async updateOrderStatus(orderId, newStatus) {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;

            await this.loadOrders();
            await this.loadStats();
        } catch (error) {
            console.error('Error updating order status:', error);
            alert('Error updating order status.');
        }
    }
}

// Initialize admin panel
const adminPanel = new AdminPanel();