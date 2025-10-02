// Admin panel functionality
class AdminPanel {
    constructor() {
        this.categories = [];
        this.products = [];
        this.orders = [];
        this.pendingOrders = [];
        this.users = [];
        this.selectedUsers = new Set();
        this.itemToDelete = null;
        this.deleteType = null; // 'category', 'product', 'order', 'user'
        this.init();
    }

    async init() {
        await this.waitForSupabase();
        await this.loadStats();
        await this.loadUsers();
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

            // Total categories
            const { count: totalCategories } = await window.supabase
                .from('categories')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);

            // Total users
            const { count: totalUsers } = await window.supabase
                .from('users')
                .select('*', { count: 'exact', head: true });

            // Active users
            const { count: activeUsers } = await window.supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);

            // Banned users
            const { count: bannedUsers } = await window.supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', false);

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
            document.getElementById('totalCategories').textContent = totalCategories || 0;
            document.getElementById('totalUsers').textContent = totalUsers || 0;
            document.getElementById('activeUsers').textContent = activeUsers || 0;
            document.getElementById('bannedUsers').textContent = bannedUsers || 0;
            document.getElementById('totalRevenue').textContent = `৳${totalRevenue.toFixed(2)}`;

        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async loadUsers() {
        try {
            const { data, error } = await window.supabase
                .from('users')
                .select(`
                    *,
                    orders (id)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading users:', error);
                return;
            }

            this.users = data || [];
            this.renderUsers();
        } catch (error) {
            console.error('Error in loadUsers:', error);
        }
    }

    async loadCategories() {
        try {
            const { data, error } = await window.supabase
                .from('categories')
                .select(`
                    *,
                    products (id)
                `)
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

    // User Management Methods
    renderUsers() {
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;

        const statusFilter = document.getElementById('userStatusFilter')?.value || 'all';
        const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
        
        let filteredUsers = this.users;

        // Apply status filter
        if (statusFilter !== 'all') {
            filteredUsers = filteredUsers.filter(user => 
                statusFilter === 'active' ? user.is_active : !user.is_active
            );
        }

        // Apply search filter
        if (searchTerm) {
            filteredUsers = filteredUsers.filter(user => 
                user.email.toLowerCase().includes(searchTerm) ||
                user.full_name?.toLowerCase().includes(searchTerm) ||
                user.mobile_number?.includes(searchTerm)
            );
        }

        if (filteredUsers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem;">No users found</td></tr>`;
            return;
        }

        tbody.innerHTML = filteredUsers.map(user => `
            <tr class="${user.is_active ? '' : 'banned-user'}">
                <td>
                    <input type="checkbox" class="user-checkbox" value="${user.id}" 
                           onchange="window.adminPanel.toggleUserSelection('${user.id}')"
                           ${user.email === 'admin123@gmail.com' ? 'disabled' : ''}>
                </td>
                <td><span class="id-cell">${user.id.substring(0, 8)}...</span></td>
                <td>${user.full_name || '-'}</td>
                <td>${user.email}</td>
                <td>${user.mobile_number || '-'}</td>
                <td>${user.orders?.length || 0}</td>
                <td>
                    <span class="status-badge ${user.is_active ? 'status-active' : 'status-banned'}">
                        ${user.is_active ? 'Active' : 'Banned'}
                    </span>
                </td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                <td class="action-buttons">
                    ${user.email !== 'admin123@gmail.com' ? `
                        <button class="btn-primary btn-sm" onclick="window.adminPanel.viewUserDetails('${user.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-success btn-sm" onclick="window.adminPanel.openResetPasswordModal('${user.id}')" title="Reset Password">
                            <i class="fas fa-key"></i>
                        </button>
                        ${user.is_active ? 
                            `<button class="btn-warning btn-sm" onclick="window.adminPanel.banUser('${user.id}')" title="Ban User">
                                <i class="fas fa-ban"></i>
                            </button>` :
                            `<button class="btn-success btn-sm" onclick="window.adminPanel.unbanUser('${user.id}')" title="Unban User">
                                <i class="fas fa-check"></i>
                            </button>`
                        }
                        <button class="btn-danger btn-sm" onclick="window.adminPanel.confirmDeleteUser('${user.id}')" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : `
                        <span class="admin-badge">Admin</span>
                    `}
                </td>
            </tr>
        `).join('');

        this.updateUserActionButtons();
    }

    toggleUserSelection(userId) {
        if (this.selectedUsers.has(userId)) {
            this.selectedUsers.delete(userId);
        } else {
            this.selectedUsers.add(userId);
        }
        this.updateUserActionButtons();
    }

    toggleSelectAllUsers() {
        const selectAll = document.getElementById('selectAllUsers');
        const checkboxes = document.querySelectorAll('.user-checkbox:not(:disabled)');
        
        if (selectAll.checked) {
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
                this.selectedUsers.add(checkbox.value);
            });
        } else {
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            this.selectedUsers.clear();
        }
        this.updateUserActionButtons();
    }

    updateUserActionButtons() {
        const banBtn = document.getElementById('banSelectedBtn');
        const unbanBtn = document.getElementById('unbanSelectedBtn');
        const deleteBtn = document.getElementById('deleteSelectedBtn');

        const hasSelection = this.selectedUsers.size > 0;

        if (hasSelection) {
            // Check if selected users are mostly active or banned
            const selectedUsersData = this.users.filter(user => this.selectedUsers.has(user.id));
            const activeCount = selectedUsersData.filter(user => user.is_active).length;
            const bannedCount = selectedUsersData.filter(user => !user.is_active).length;

            banBtn.style.display = activeCount > 0 ? 'flex' : 'none';
            unbanBtn.style.display = bannedCount > 0 ? 'flex' : 'none';
            deleteBtn.style.display = 'flex';
        } else {
            banBtn.style.display = 'none';
            unbanBtn.style.display = 'none';
            deleteBtn.style.display = 'none';
        }
    }

    filterUsers() {
        this.renderUsers();
    }

    searchUsers() {
        this.renderUsers();
    }

    async banUser(userId) {
        if (!confirm('Are you sure you want to ban this user? They will not be able to login.')) {
            return;
        }

        try {
            const { error } = await window.supabase
                .from('users')
                .update({ is_active: false })
                .eq('id', userId);

            if (error) throw error;

            await this.loadUsers();
            await this.loadStats();
            alert('User banned successfully!');
        } catch (error) {
            console.error('Error banning user:', error);
            alert('Error banning user.');
        }
    }

    async unbanUser(userId) {
        try {
            const { error } = await window.supabase
                .from('users')
                .update({ is_active: true })
                .eq('id', userId);

            if (error) throw error;

            await this.loadUsers();
            await this.loadStats();
            alert('User unbanned successfully!');
        } catch (error) {
            console.error('Error unbanning user:', error);
            alert('Error unbanning user.');
        }
    }

    async banSelectedUsers() {
        const selectedCount = this.selectedUsers.size;
        if (selectedCount === 0) return;

        if (!confirm(`Are you sure you want to ban ${selectedCount} user(s)? They will not be able to login.`)) {
            return;
        }

        try {
            const { error } = await window.supabase
                .from('users')
                .update({ is_active: false })
                .in('id', Array.from(this.selectedUsers));

            if (error) throw error;

            this.selectedUsers.clear();
            await this.loadUsers();
            await this.loadStats();
            alert(`${selectedCount} user(s) banned successfully!`);
        } catch (error) {
            console.error('Error banning users:', error);
            alert('Error banning users.');
        }
    }

    async unbanSelectedUsers() {
        const selectedCount = this.selectedUsers.size;
        if (selectedCount === 0) return;

        if (!confirm(`Are you sure you want to unban ${selectedCount} user(s)?`)) {
            return;
        }

        try {
            const { error } = await window.supabase
                .from('users')
                .update({ is_active: true })
                .in('id', Array.from(this.selectedUsers));

            if (error) throw error;

            this.selectedUsers.clear();
            await this.loadUsers();
            await this.loadStats();
            alert(`${selectedCount} user(s) unbanned successfully!`);
        } catch (error) {
            console.error('Error unbanning users:', error);
            alert('Error unbanning users.');
        }
    }

    openResetPasswordModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        document.getElementById('resetPasswordUserId').value = userId;
        document.getElementById('resetPasswordUserEmail').value = user.email;
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';

        this.generatePassword(); // Auto-generate a password

        document.getElementById('resetPasswordModal').style.display = 'block';
    }

    closeResetPasswordModal() {
        document.getElementById('resetPasswordModal').style.display = 'none';
    }

    generatePassword() {
        const length = 12;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let password = "";
        
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        
        document.getElementById('newPassword').value = password;
        document.getElementById('confirmPassword').value = password;
    }

    async resetUserPassword(e) {
        e.preventDefault();

        const userId = document.getElementById('resetPasswordUserId').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }

        if (newPassword.length < 6) {
            alert('Password must be at least 6 characters long!');
            return;
        }

        try {
            const { error } = await window.supabase
                .from('users')
                .update({ password: newPassword })
                .eq('id', userId);

            if (error) throw error;

            this.closeResetPasswordModal();
            alert('Password reset successfully! New password: ' + newPassword);
        } catch (error) {
            console.error('Error resetting password:', error);
            alert('Error resetting password.');
        }
    }

    viewUserDetails(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        const ordersCount = user.orders?.length || 0;
        const userSince = new Date(user.created_at).toLocaleDateString();
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never';

        alert(`User Details:\n\n` +
              `Name: ${user.full_name || 'N/A'}\n` +
              `Email: ${user.email}\n` +
              `Mobile: ${user.mobile_number || 'N/A'}\n` +
              `Status: ${user.is_active ? 'Active' : 'Banned'}\n` +
              `Total Orders: ${ordersCount}\n` +
              `Member Since: ${userSince}\n` +
              `Last Login: ${lastLogin}`);
    }

    // Continue with existing methods for categories, products, orders...
    // ... [Keep all the existing methods for categories, products, orders from previous code]

    // Add the reset password form event listener in setupModals
    setupModals() {
        // Existing modal setups...
        this.categoryModal = document.getElementById('categoryModal');
        this.categoryForm = document.getElementById('categoryForm');
        this.categoryForm.addEventListener('submit', (e) => this.saveCategory(e));

        this.productModal = document.getElementById('productModal');
        this.productForm = document.getElementById('productForm');
        this.productForm.addEventListener('submit', (e) => this.saveProduct(e));

        this.deleteModal = document.getElementById('deleteModal');
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.executeDelete());

        // Add reset password form
        this.resetPasswordModal = document.getElementById('resetPasswordModal');
        this.resetPasswordForm = document.getElementById('resetPasswordForm');
        this.resetPasswordForm.addEventListener('submit', (e) => this.resetUserPassword(e));
    }

    // Add user deletion methods
    confirmDeleteUser(userId) {
        this.itemToDelete = userId;
        this.deleteType = 'user';
        const user = this.users.find(u => u.id === userId);
        
        const deleteMessage = document.getElementById('deleteMessage');
        const deleteModalTitle = document.getElementById('deleteModalTitle');
        
        deleteModalTitle.textContent = 'Delete User';
        
        if (user) {
            const ordersCount = user.orders?.length || 0;
            let warning = '';
            
            if (ordersCount > 0) {
                warning = `<br><br><strong style="color: #e74c3c;">⚠️ WARNING: This user has ${ordersCount} order(s). Deleting the user will also remove these orders!</strong>`;
            }
            
            deleteMessage.innerHTML = `
                Are you sure you want to delete the user "<strong>${user.email}</strong>"?<br><br>
                <strong>User Details:</strong><br>
                - Name: ${user.full_name || 'N/A'}<br>
                - Email: ${user.email}<br>
                - Mobile: ${user.mobile_number || 'N/A'}<br>
                - Orders: ${ordersCount}<br>
                - Status: ${user.is_active ? 'Active' : 'Banned'}<br>
                ${warning}<br><br>
                This action cannot be undone.
            `;
        }
        
        this.deleteModal.style.display = 'block';
    }

    async deleteSelectedUsers() {
        const selectedCount = this.selectedUsers.size;
        if (selectedCount === 0) return;

        if (!confirm(`Are you sure you want to delete ${selectedCount} user(s)? This will also delete all their orders and cannot be undone.`)) {
            return;
        }

        try {
            // First delete user orders
            const { error: ordersError } = await window.supabase
                .from('orders')
                .delete()
                .in('user_id', Array.from(this.selectedUsers));

            if (ordersError) throw ordersError;

            // Then delete users
            const { error } = await window.supabase
                .from('users')
                .delete()
                .in('id', Array.from(this.selectedUsers));

            if (error) throw error;

            this.selectedUsers.clear();
            await this.loadUsers();
            await this.loadOrders();
            await this.loadPendingOrders();
            await this.loadStats();

            alert(`${selectedCount} user(s) deleted successfully!`);
        } catch (error) {
            console.error('Error deleting users:', error);
            alert('Error deleting users.');
        }
    }

    // Update the executeDelete method to handle users
    async executeDelete() {
        if (!this.itemToDelete || !this.deleteType) return;

        try {
            let error;

            switch (this.deleteType) {
                case 'category':
                    // First, delete products in this category
                    const { error: productsError } = await window.supabase
                        .from('products')
                        .delete()
                        .eq('category_id', this.itemToDelete);
                    
                    if (productsError) throw productsError;

                    // Then delete the category
                    ({ error } = await window.supabase
                        .from('categories')
                        .delete()
                        .eq('id', this.itemToDelete));
                    break;

                case 'product':
                    ({ error } = await window.supabase
                        .from('products')
                        .delete()
                        .eq('id', this.itemToDelete));
                    break;

                case 'order':
                    ({ error } = await window.supabase
                        .from('orders')
                        .delete()
                        .eq('id', this.itemToDelete));
                    break;

                case 'user':
                    // First delete user orders
                    const { error: userOrdersError } = await window.supabase
                        .from('orders')
                        .delete()
                        .eq('user_id', this.itemToDelete);
                    
                    if (userOrdersError) throw userOrdersError;

                    // Then delete user
                    ({ error } = await window.supabase
                        .from('users')
                        .delete()
                        .eq('id', this.itemToDelete));
                    break;
            }

            if (error) throw error;

            this.closeDeleteModal();
            
            // Reload all data
            await this.loadUsers();
            await this.loadCategories();
            await this.loadProducts();
            await this.loadOrders();
            await this.loadPendingOrders();
            await this.loadStats();

            alert(`${this.deleteType.charAt(0).toUpperCase() + this.deleteType.slice(1)} deleted successfully!`);
        } catch (error) {
            console.error(`Error deleting ${this.deleteType}:`, error);
            alert(`Error deleting ${this.deleteType}. Please try again.`);
        }
    }

    // ... [Keep all other existing methods unchanged]
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.adminPanel = new AdminPanel();
});
