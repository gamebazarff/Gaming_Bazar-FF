// Admin panel functionality
class AdminPanel {
    constructor() {
        this.categories = [];
        this.products = [];
        this.orders = [];
        this.pendingOrders = [];
        this.orderToDelete = null;
        this.init();
    }

    async init() {
        await this.waitForSupabase();
        await this.loadStats();
        await this.loadCategories();
        await this.loadProducts();
        await this.loadOrders();
        await this.loadPendingOrders();
        this.setupEventListeners();
        this.setupModals();
    }

    async waitForSupabase() {
        return new Promise((resolve) => {
            const checkSupabase = () => {
                if (typeof window.supabase !== 'undefined') {
                    console.log('Supabase ready for admin panel');
                    resolve();
                } else {
                    setTimeout(checkSupabase, 100);
                }
            };
            checkSupabase();
        });
    }

    async loadStats() {
        try {
            // Total orders
            const { count: totalOrders } = await window.supabase
                .from('orders')
                .select('*', { count: 'exact', head: true });

            // Pending orders
            const { count: pendingOrders } = await window.supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            // Completed orders
            const { count: completedOrders } = await window.supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'completed');

            // Total products
            const { count: totalProducts } = await window.supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);

            // Total users
            const { count: totalUsers } = await window.supabase
                .from('users')
                .select('*', { count: 'exact', head: true });

            // Total revenue (sum of completed orders)
            const { data: revenueData, error: revenueError } = await window.supabase
                .from('orders')
                .select(`
                    products (price)
                `)
                .eq('status', 'completed');

            let totalRevenue = 0;
            if (revenueData && !revenueError) {
                totalRevenue = revenueData.reduce((sum, order) => {
                    return sum + (parseFloat(order.products?.price) || 0);
                }, 0);
            }

            document.getElementById('totalOrders').textContent = totalOrders || 0;
            document.getElementById('pendingOrders').textContent = pendingOrders || 0;
            document.getElementById('completedOrders').textContent = completedOrders || 0;
            document.getElementById('totalProducts').textContent = totalProducts || 0;
            document.getElementById('totalUsers').textContent = totalUsers || 0;
            document.getElementById('totalRevenue').textContent = `৳${totalRevenue.toFixed(2)}`;

        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async loadCategories() {
        try {
            const { data, error } = await window.supabase
                .from('categories')
                .select('*')
                .order('created_at', { ascending: false });

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
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading products:', error);
                return;
            }

            this.products = data || [];
            this.renderProducts();
            this.populateCategorySelect();
        } catch (error) {
            console.error('Error in loadProducts:', error);
        }
    }

    async loadOrders() {
        try {
            const { data, error } = await window.supabase
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

            this.orders = data || [];
            this.renderOrders();
        } catch (error) {
            console.error('Error in loadOrders:', error);
        }
    }

    async loadPendingOrders() {
        try {
            const { data, error } = await window.supabase
                .from('orders')
                .select(`
                    *,
                    products (name, price),
                    users (email, full_name)
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading pending orders:', error);
                return;
            }

            this.pendingOrders = data || [];
            this.renderPendingOrders();
        } catch (error) {
            console.error('Error in loadPendingOrders:', error);
        }
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
                    <button class="btn-primary btn-sm" onclick="window.adminPanel.editCategory('${category.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-danger btn-sm" onclick="window.adminPanel.toggleCategoryStatus('${category.id}', ${!category.is_active})">
                        ${category.is_active ? '<i class="fas fa-eye-slash"></i> Deactivate' : '<i class="fas fa-eye"></i> Activate'}
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
                    <button class="btn-primary btn-sm" onclick="window.adminPanel.editProduct('${product.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-danger btn-sm" onclick="window.adminPanel.toggleProductStatus('${product.id}', ${!product.is_active})">
                        ${product.is_active ? '<i class="fas fa-eye-slash"></i> Deactivate' : '<i class="fas fa-eye"></i> Activate'}
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderOrders() {
        const tbody = document.querySelector('#ordersTable tbody');
        if (!tbody) return;

        const statusFilter = document.getElementById('orderStatusFilter')?.value || 'all';
        let filteredOrders = this.orders;

        if (statusFilter !== 'all') {
            filteredOrders = this.orders.filter(order => order.status === statusFilter);
        }

        if (filteredOrders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 2rem;">No orders found</td></tr>`;
            return;
        }

        tbody.innerHTML = filteredOrders.map(order => `
            <tr>
                <td><span class="id-cell">${order.id.substring(0, 8)}...</span></td>
                <td><span class="id-cell">${order.user_id?.substring(0, 8)}...</span></td>
                <td>${order.products?.name || '-'}</td>
                <td>${order.users?.email || '-'}</td>
                <td>৳${order.products?.price || '0'}</td>
                <td>${order.payment_method}</td>
                <td>${order.payment_number || '-'}</td>
                <td><span class="id-cell">${order.transaction_id || '-'}</span></td>
                <td>${order.game_id || '-'}</td>
                <td>
                    <span class="status-badge status-${order.status}">
                        ${order.status}
                    </span>
                </td>
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                <td class="action-buttons">
                    ${order.status === 'pending' ? `
                        <button class="btn-success btn-sm" onclick="window.adminPanel.updateOrderStatus('${order.id}', 'completed')" title="Complete Order">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="btn-danger btn-sm" onclick="window.adminPanel.confirmDeleteOrder('${order.id}')" title="Delete Order">
                        <i class="fas fa-trash"></i>
                    </button>
                    ${order.status === 'pending' ? `
                        <button class="btn-danger btn-sm" onclick="window.adminPanel.updateOrderStatus('${order.id}', 'cancelled')" title="Cancel Order">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    renderPendingOrders() {
        const tbody = document.querySelector('#pendingOrdersTable tbody');
        if (!tbody) return;

        if (this.pendingOrders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 2rem;">No pending orders</td></tr>`;
            return;
        }

        tbody.innerHTML = this.pendingOrders.map(order => `
            <tr>
                <td><span class="id-cell">${order.id.substring(0, 8)}...</span></td>
                <td><span class="id-cell">${order.user_id?.substring(0, 8)}...</span></td>
                <td>${order.products?.name || '-'}</td>
                <td>${order.users?.email || '-'}</td>
                <td>৳${order.products?.price || '0'}</td>
                <td>${order.payment_method}</td>
                <td>${order.payment_number || '-'}</td>
                <td><span class="id-cell">${order.transaction_id || '-'}</span></td>
                <td>${order.game_id || '-'}</td>
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                <td class="action-buttons">
                    <button class="btn-success btn-sm" onclick="window.adminPanel.updateOrderStatus('${order.id}', 'completed')" title="Complete Order">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-danger btn-sm" onclick="window.adminPanel.confirmDeleteOrder('${order.id}')" title="Delete Order">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-danger btn-sm" onclick="window.adminPanel.updateOrderStatus('${order.id}', 'cancelled')" title="Cancel Order">
                        <i class="fas fa-times"></i>
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
                        target.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    
                    // Show target tab
                    tabContents.forEach(tab => tab.classList.remove('active'));
                    document.getElementById(target).classList.add('active');

                    // Refresh data for specific tabs
                    if (target === 'pending-orders') {
                        this.loadPendingOrders();
                    } else if (target === 'orders') {
                        this.loadOrders();
                    } else if (target === 'dashboard') {
                        this.loadStats();
                    }
                });
            }
        });

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.auth) {
                    window.auth.logout();
                } else {
                    window.location.href = 'login.html';
                }
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

        // Delete modal
        this.deleteModal = document.getElementById('deleteModal');
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.deleteOrder());
    }

    // Filter orders by status
    filterOrders() {
        this.renderOrders();
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
                const { error } = await window.supabase
                    .from('categories')
                    .update(categoryData)
                    .eq('id', categoryId);
                
                if (error) throw error;
            } else {
                // Insert new category
                const { error } = await window.supabase
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
            const { error } = await window.supabase
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

    editCategory(categoryId) {
        this.openCategoryModal(categoryId);
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
                const { error } = await window.supabase
                    .from('products')
                    .update(productData)
                    .eq('id', productId);
                
                if (error) throw error;
            } else {
                // Insert new product
                const { error } = await window.supabase
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
            const { error } = await window.supabase
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

    editProduct(productId) {
        this.openProductModal(productId);
    }

    // Order methods
    async updateOrderStatus(orderId, newStatus) {
        try {
            const { error } = await window.supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;

            // Reload all order-related data
            await this.loadOrders();
            await this.loadPendingOrders();
            await this.loadStats();

            alert(`Order ${newStatus} successfully!`);
        } catch (error) {
            console.error('Error updating order status:', error);
            alert('Error updating order status.');
        }
    }

    // Delete order methods
    confirmDeleteOrder(orderId) {
        this.orderToDelete = orderId;
        const order = this.orders.find(o => o.id === orderId) || this.pendingOrders.find(o => o.id === orderId);
        
        const deleteMessage = document.getElementById('deleteMessage');
        if (order) {
            deleteMessage.innerHTML = `
                Are you sure you want to delete this order?<br><br>
                <strong>Order Details:</strong><br>
                - Product: ${order.products?.name || 'N/A'}<br>
                - User: ${order.users?.email || 'N/A'}<br>
                - Amount: ৳${order.products?.price || '0'}<br>
                - Status: ${order.status}<br><br>
                This action cannot be undone.
            `;
        } else {
            deleteMessage.textContent = 'Are you sure you want to delete this order? This action cannot be undone.';
        }
        
        this.deleteModal.style.display = 'block';
    }

    closeDeleteModal() {
        this.deleteModal.style.display = 'none';
        this.orderToDelete = null;
    }

    async deleteOrder() {
        if (!this.orderToDelete) return;

        try {
            const { error } = await window.supabase
                .from('orders')
                .delete()
                .eq('id', this.orderToDelete);

            if (error) throw error;

            this.closeDeleteModal();
            
            // Reload all order-related data
            await this.loadOrders();
            await this.loadPendingOrders();
            await this.loadStats();

            alert('Order deleted successfully!');
        } catch (error) {
            console.error('Error deleting order:', error);
            alert('Error deleting order.');
        }
    }

    // Bulk operations
    async completeAllPending() {
        if (!confirm('Are you sure you want to mark ALL pending orders as completed?')) {
            return;
        }

        try {
            const { error } = await window.supabase
                .from('orders')
                .update({ status: 'completed' })
                .eq('status', 'pending');

            if (error) throw error;

            await this.loadOrders();
            await this.loadPendingOrders();
            await this.loadStats();

            alert('All pending orders marked as completed!');
        } catch (error) {
            console.error('Error completing all orders:', error);
            alert('Error completing all orders.');
        }
    }

    async cancelAllPending() {
        if (!confirm('Are you sure you want to cancel ALL pending orders?')) {
            return;
        }

        try {
            const { error } = await window.supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('status', 'pending');

            if (error) throw error;

            await this.loadOrders();
            await this.loadPendingOrders();
            await this.loadStats();

            alert('All pending orders cancelled!');
        } catch (error) {
            console.error('Error cancelling all orders:', error);
            alert('Error cancelling all orders.');
        }
    }

    async deleteCompletedOrders() {
        if (!confirm('Are you sure you want to delete ALL completed orders? This will free up storage space but cannot be undone.')) {
            return;
        }

        try {
            const { error } = await window.supabase
                .from('orders')
                .delete()
                .eq('status', 'completed');

            if (error) throw error;

            await this.loadOrders();
            await this.loadPendingOrders();
            await this.loadStats();

            alert('All completed orders deleted successfully! Storage space freed.');
        } catch (error) {
            console.error('Error deleting completed orders:', error);
            alert('Error deleting completed orders.');
        }
    }
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.adminPanel = new AdminPanel();
});
