class AdminPanel {
    constructor() {
        this.categories = [];
        this.products = [];
        this.orders = [];
        this.pendingOrders = [];
        this.users = [];
        this.paymentMethods = [];
        this.walletRechargeRequests = [];
        this.selectedUsers = new Set();
        this.itemToDelete = null;
        this.deleteType = null;
        this.siteSettings = {};
        this.init();
    }

    async init() {
        await this.waitForSupabase();
        this.setupEventListeners();
        await this.loadAllData();
    }

    async waitForSupabase() {
        return new Promise((resolve) => {
            const check = () => {
                if (typeof window.supabase !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    setupEventListeners() {
        this.setupNavigation();
        this.setupButtonListeners();
        this.setupModalListeners();
        this.setupFilterListeners();
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            if (item.getAttribute('href')?.startsWith('#')) {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = item.getAttribute('href').substring(1);
                    this.switchTab(target);
                });
            }
        });

        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            if (window.auth) window.auth.logout();
            else window.location.href = 'login.html';
        });
    }

    setupButtonListeners() {
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.openCategoryModal());
        document.getElementById('addProductBtn').addEventListener('click', () => this.openProductModal());
        document.getElementById('addPaymentMethodBtn').addEventListener('click', () => this.openPaymentMethodModal());
        document.getElementById('cleanInactiveCategoriesBtn').addEventListener('click', () => this.deleteInactiveCategories());
        document.getElementById('cleanInactiveProductsBtn').addEventListener('click', () => this.deleteInactiveProducts());
        document.getElementById('cleanCompletedOrdersBtn').addEventListener('click', () => this.deleteCompletedOrders());
        document.getElementById('completeAllPendingBtn').addEventListener('click', () => this.completeAllPending());
        document.getElementById('cancelAllPendingBtn').addEventListener('click', () => this.cancelAllPending());
        document.getElementById('banSelectedBtn').addEventListener('click', () => this.banSelectedUsers());
        document.getElementById('unbanSelectedBtn').addEventListener('click', () => this.unbanSelectedUsers());
        document.getElementById('deleteSelectedBtn').addEventListener('click', () => this.deleteSelectedUsers());
        document.getElementById('selectAllUsers').addEventListener('change', (e) => this.toggleSelectAllUsers(e));
        document.getElementById('generatePasswordBtn').addEventListener('click', () => this.generatePassword());
        
        // Site settings form
        document.getElementById('siteSettingsForm').addEventListener('submit', (e) => this.saveSiteSettings(e));

        // Recharge filter
        document.getElementById('rechargeStatusFilter').addEventListener('change', () => this.renderWalletRechargeRequests());
    }

    setupModalListeners() {
        document.getElementById('categoryForm').addEventListener('submit', (e) => this.saveCategory(e));
        document.getElementById('productForm').addEventListener('submit', (e) => this.saveProduct(e));
        document.getElementById('paymentMethodForm').addEventListener('submit', (e) => this.savePaymentMethod(e));
        document.getElementById('resetPasswordForm').addEventListener('submit', (e) => this.resetUserPassword(e));
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.executeDelete());
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('cancelResetPasswordBtn').addEventListener('click', () => this.closeResetPasswordModal());

        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    setupFilterListeners() {
        document.getElementById('userStatusFilter').addEventListener('change', () => this.renderUsers());
        document.getElementById('userSearch').addEventListener('input', () => this.renderUsers());
        document.getElementById('orderStatusFilter').addEventListener('change', () => this.renderOrders());
    }

    async loadAllData() {
        await Promise.all([
            this.loadStats(),
            this.loadUsers(),
            this.loadCategories(),
            this.loadProducts(),
            this.loadPaymentMethods(),
            this.loadOrders(),
            this.loadPendingOrders(),
            this.loadWalletRechargeRequests(),
            this.loadSiteSettings()
        ]);
    }

    async loadStats() {
        try {
            const [
                totalOrders,
                pendingOrders,
                completedOrders,
                totalProducts,
                totalCategories,
                totalUsers,
                activeUsers,
                bannedUsers,
                pendingRecharge,
                revenueData
            ] = await Promise.all([
                this.countRecords('orders'),
                this.countRecords('orders', 'status', 'pending'),
                this.countRecords('orders', 'status', 'completed'),
                this.countRecords('products', 'is_active', true),
                this.countRecords('categories', 'is_active', true),
                this.countRecords('users'),
                this.countRecords('users', 'is_active', true),
                this.countRecords('users', 'is_active', false),
                this.countRecords('wallet_recharge_requests', 'status', 'pending'),
                window.supabase.from('orders').select('products (price)').eq('status', 'completed')
            ]);

            let totalRevenue = 0;
            if (revenueData.data) {
                totalRevenue = revenueData.data.reduce((sum, order) => {
                    return sum + (parseFloat(order.products?.price) || 0);
                }, 0);
            }

            const stats = {
                'totalOrders': totalOrders,
                'pendingOrders': pendingOrders,
                'completedOrders': completedOrders,
                'totalProducts': totalProducts,
                'totalCategories': totalCategories,
                'totalUsers': totalUsers,
                'activeUsers': activeUsers,
                'bannedUsers': bannedUsers,
                'pendingRecharge': pendingRecharge,
                'totalRevenue': '$' + totalRevenue.toFixed(2)
            };

            for (const [id, value] of Object.entries(stats)) {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async countRecords(table, column, value) {
        const query = value ?
            window.supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, value) :
            window.supabase.from(table).select('*', { count: 'exact', head: true });

        const { count, error } = await query;
        return error ? 0 : (count || 0);
    }

    async loadUsers() {
        try {
            const { data, error } = await window.supabase
                .from('users')
                .select('*, orders (id)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.users = data || [];
            this.renderUsers();
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    async loadCategories() {
        try {
            const { data, error } = await window.supabase
                .from('categories')
                .select('*, products (id)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.categories = data || [];
            this.renderCategories();
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    async loadProducts() {
        try {
            const { data, error } = await window.supabase
                .from('products')
                .select('*, categories (name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.products = data || [];
            this.renderProducts();
            this.populateCategorySelect();
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    async loadPaymentMethods() {
        try {
            const { data, error } = await window.supabase
                .from('payment_methods')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.paymentMethods = data || [];
            this.renderPaymentMethods();
        } catch (error) {
            console.error('Error loading payment methods:', error);
        }
    }

    async loadOrders() {
        try {
            const { data, error } = await window.supabase
                .from('orders')
                .select('*, products (name, price), users (email, full_name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.orders = data || [];
            this.renderOrders();
        } catch (error) {
            console.error('Error loading orders:', error);
        }
    }

    async loadPendingOrders() {
        try {
            const { data, error } = await window.supabase
                .from('orders')
                .select('*, products (name, price), users (email, full_name)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.pendingOrders = data || [];
            this.renderPendingOrders();
        } catch (error) {
            console.error('Error loading pending orders:', error);
        }
    }

    // Load wallet recharge requests
    async loadWalletRechargeRequests() {
        try {
            const { data, error } = await window.supabase
                .from('wallet_recharge_requests')
                .select('*, users(email, full_name, mobile_number, wallet_balance)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.walletRechargeRequests = data || [];
            this.renderWalletRechargeRequests();
        } catch (error) {
            console.error('Error loading recharge requests:', error);
        }
    }

   // Site Settings management - Updated version
async loadSiteSettings() {
    try {
        const { data, error } = await window.supabase
            .from('site_settings')
            .select('*')
            .single();

        if (error) {
            console.error('Error loading site settings:', error);
            
            // If no settings found, create default
            if (error.code === 'PGRST116') {
                await this.createDefaultSiteSettings();
                return this.loadSiteSettings(); // Reload after creation
            }
            return;
        }

        if (data) {
            this.siteSettings = data;
            this.populateSiteSettingsForm(data);
        }
    } catch (error) {
        console.error('Error loading site settings:', error);
    }
}

// Populate site settings form
populateSiteSettingsForm(settings) {
    document.getElementById('siteNameSetting').value = settings.site_name || '';
    document.getElementById('heroTitleSetting').value = settings.hero_title || '';
    document.getElementById('heroSubtitleSetting').value = settings.hero_subtitle || '';
    document.getElementById('bannerTextSetting').value = settings.banner_text || '';
    document.getElementById('whatsappNumberSetting').value = settings.whatsapp_number || '';
}

// Create default site settings
async createDefaultSiteSettings() {
    try {
        const defaultSettings = {
            site_name: 'Fire Diamond Topup',
            hero_title: 'Fire Diamond Topup',
            hero_subtitle: 'Get your diamonds instantly with secure payment methods',
            banner_text: '🔥 Instant Diamond Delivery | 24/7 Support',
            whatsapp_number: '1234567890'
        };
        
        const { error } = await window.supabase
            .from('site_settings')
            .insert([defaultSettings]);
            
        if (error) {
            console.error('Error creating default site settings:', error);
        } else {
            console.log('Default site settings created successfully');
        }
    } catch (error) {
        console.error('Error in createDefaultSiteSettings:', error);
    }
}

// Save site settings
async saveSiteSettings(e) {
    e.preventDefault();
    
    const settingsData = {
        site_name: document.getElementById('siteNameSetting').value.trim(),
        hero_title: document.getElementById('heroTitleSetting').value.trim(),
        hero_subtitle: document.getElementById('heroSubtitleSetting').value.trim(),
        banner_text: document.getElementById('bannerTextSetting').value.trim(),
        whatsapp_number: document.getElementById('whatsappNumberSetting').value.trim()
    };

    // Validation
    if (!settingsData.site_name || !settingsData.hero_title || !settingsData.whatsapp_number) {
        alert('Please fill all required fields: Site Name, Hero Title, and WhatsApp Number');
        return;
    }

    try {
        // Check if settings already exist
        const { data: existingSettings } = await window.supabase
            .from('site_settings')
            .select('id')
            .single();

        let result;
        if (existingSettings) {
            // Update existing settings
            result = await window.supabase
                .from('site_settings')
                .update(settingsData)
                .eq('id', existingSettings.id);
        } else {
            // Insert new settings
            result = await window.supabase
                .from('site_settings')
                .insert([settingsData]);
        }

        if (result.error) throw result.error;

        alert('Site settings saved successfully!');
        
        // Reload settings to ensure we have the latest data
        await this.loadSiteSettings();
        
    } catch (error) {
        console.error('Error saving site settings:', error);
        alert('Error saving site settings: ' + error.message);
    }
}

    renderUsers() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        const statusFilter = document.getElementById('userStatusFilter').value;
        const searchTerm = document.getElementById('userSearch').value.toLowerCase();

        let filteredUsers = this.users.filter(user => {
            const statusMatch = statusFilter === 'all' ||
                (statusFilter === 'active' && user.is_active) ||
                (statusFilter === 'banned' && !user.is_active);

            const searchMatch = !searchTerm ||
                user.email.toLowerCase().includes(searchTerm) ||
                user.full_name?.toLowerCase().includes(searchTerm) ||
                user.mobile_number?.includes(searchTerm);

            return statusMatch && searchMatch;
        });

        if (filteredUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">No users found</td></tr>';
            return;
        }

        tbody.innerHTML = filteredUsers.map(user => `
            <tr class="${user.is_active ? '' : 'banned-user'}">
                <td>
                    <input type="checkbox" class="user-checkbox" value="${user.id}" 
                           ${user.email === 'admin123@gmail.com' ? 'disabled' : ''}>
                </td>
                <td><span class="id-cell">${user.id.substring(0, 8)}...</span></td>
                <td>${user.full_name || '-'}</td>
                <td>${user.email}</td>
                <td>${user.mobile_number || '-'}</td>
                <td>$${user.wallet_balance || '0'}</td>
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
                        <button class="btn-primary btn-sm view-user" data-id="${user.id}" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-success btn-sm reset-password" data-id="${user.id}" title="Reset Password">
                            <i class="fas fa-key"></i>
                        </button>
                        ${user.is_active ? 
                            `<button class="btn-warning btn-sm ban-user" data-id="${user.id}" title="Ban User">
                                <i class="fas fa-ban"></i>
                            </button>` :
                            `<button class="btn-success btn-sm unban-user" data-id="${user.id}" title="Unban User">
                                <i class="fas fa-check"></i>
                            </button>`
                        }
                        <button class="btn-danger btn-sm delete-user" data-id="${user.id}" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : '<span class="admin-badge">Admin</span>'}
                </td>
            </tr>
        `).join('');

        this.setupUserActionListeners();
        this.updateUserActionButtons();
    }

    // Render wallet recharge requests
    renderWalletRechargeRequests() {
        const tbody = document.getElementById('rechargeRequestsTableBody');
        if (!tbody) return;

        const statusFilter = document.getElementById('rechargeStatusFilter').value;
        const filteredRequests = statusFilter === 'all' ? 
            this.walletRechargeRequests : 
            this.walletRechargeRequests.filter(req => req.status === statusFilter);

        if (filteredRequests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No recharge requests found</td></tr>';
            return;
        }

        tbody.innerHTML = filteredRequests.map(request => `
            <tr class="${request.status === 'pending' ? 'highlight-row' : ''}">
                <td><span class="id-cell">${request.id.substring(0, 8)}...</span></td>
                <td>
                    <strong>${request.users?.full_name || 'N/A'}</strong><br>
                    <small>${request.users?.email}</small><br>
                    <small>Balance: $${request.users?.wallet_balance || '0'}</small>
                </td>
                <td>$${request.amount}</td>
                <td>${request.payment_method}</td>
                <td><span class="id-cell">${request.transaction_id}</span></td>
                <td>${request.payment_number || 'N/A'}</td>
                <td>${new Date(request.created_at).toLocaleDateString()}</td>
                <td>
                    <span class="status-badge status-${request.status}">
                        ${request.status}
                    </span>
                </td>
                <td class="action-buttons">
                    ${request.status === 'pending' ? `
                        <button class="btn-success btn-sm approve-recharge" data-id="${request.id}">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="btn-danger btn-sm reject-recharge" data-id="${request.id}">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : ''}
                    <button class="btn-primary btn-sm view-recharge" data-id="${request.id}">
                        <i class="fas fa-eye"></i> Details
                    </button>
                </td>
            </tr>
        `).join('');

        this.setupRechargeActionListeners();
    }

    // Setup recharge action listeners
    setupRechargeActionListeners() {
        document.querySelectorAll('.approve-recharge').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const requestId = e.target.closest('button').dataset.id;
                this.approveRechargeRequest(requestId);
            });
        });

        document.querySelectorAll('.reject-recharge').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const requestId = e.target.closest('button').dataset.id;
                this.rejectRechargeRequest(requestId);
            });
        });

        document.querySelectorAll('.view-recharge').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const requestId = e.target.closest('button').dataset.id;
                this.viewRechargeDetails(requestId);
            });
        });
    }

    // Approve recharge request
    async approveRechargeRequest(requestId) {
        if (!confirm('Are you sure you want to approve this recharge request?')) return;

        try {
            const request = this.walletRechargeRequests.find(req => req.id === requestId);
            if (!request) throw new Error('Request not found');

            // Update recharge request status
            const { error: updateError } = await window.supabase
                .from('wallet_recharge_requests')
                .update({ 
                    status: 'approved',
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (updateError) throw updateError;

            // Update user wallet balance
            const { data: user, error: userError } = await window.supabase
                .from('users')
                .select('wallet_balance')
                .eq('id', request.user_id)
                .single();

            if (userError) throw userError;

            const newBalance = (user.wallet_balance || 0) + parseFloat(request.amount);

            const { error: walletError } = await window.supabase
                .from('users')
                .update({ wallet_balance: newBalance })
                .eq('id', request.user_id);

            if (walletError) throw walletError;

            // Create wallet transaction record
            const { error: transactionError } = await window.supabase
                .from('wallet_transactions')
                .insert([{
                    user_id: request.user_id,
                    amount: request.amount,
                    type: 'topup',
                    payment_method: request.payment_method,
                    transaction_id: request.transaction_id,
                    recharge_request_id: requestId,
                    status: 'completed',
                    description: `Wallet recharge approved - ${request.payment_method}`
                }]);

            if (transactionError) throw transactionError;

            alert('Recharge request approved successfully!');
            await this.loadWalletRechargeRequests();
            await this.loadStats();
            await this.loadUsers();

        } catch (error) {
            console.error('Error approving recharge request:', error);
            alert('Error: ' + error.message);
        }
    }

    // Reject recharge request
    async rejectRechargeRequest(requestId) {
        const reason = prompt('Please enter reason for rejection:');
        if (reason === null) return;

        try {
            const { error } = await window.supabase
                .from('wallet_recharge_requests')
                .update({ 
                    status: 'rejected',
                    admin_notes: reason,
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (error) throw error;

            alert('Recharge request rejected!');
            await this.loadWalletRechargeRequests();

        } catch (error) {
            console.error('Error rejecting recharge request:', error);
            alert('Error: ' + error.message);
        }
    }

    // View recharge details
    async viewRechargeDetails(requestId) {
        const request = this.walletRechargeRequests.find(req => req.id === requestId);
        if (!request) return;

        const modal = document.getElementById('rechargeDetailsModal');
        const content = document.getElementById('rechargeDetailsContent');
        const actions = document.getElementById('rechargeDetailsActions');

        content.innerHTML = `
            <div class="recharge-details">
                <div class="detail-item">
                    <label>User:</label>
                    <span>${request.users?.full_name || 'N/A'} (${request.users?.email})</span>
                </div>
                <div class="detail-item">
                    <label>Current Balance:</label>
                    <span>$${request.users?.wallet_balance || '0'}</span>
                </div>
                <div class="detail-item">
                    <label>Recharge Amount:</label>
                    <span>$${request.amount}</span>
                </div>
                <div class="detail-item">
                    <label>Payment Method:</label>
                    <span>${request.payment_method}</span>
                </div>
                <div class="detail-item">
                    <label>Payment Number:</label>
                    <span>${request.payment_number || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <label>Transaction ID:</label>
                    <span>${request.transaction_id}</span>
                </div>
                <div class="detail-item">
                    <label>Status:</label>
                    <span class="status-badge status-${request.status}">${request.status}</span>
                </div>
                <div class="detail-item">
                    <label>Request Date:</label>
                    <span>${new Date(request.created_at).toLocaleString()}</span>
                </div>
                ${request.admin_notes ? `
                <div class="detail-item">
                    <label>Admin Notes:</label>
                    <span>${request.admin_notes}</span>
                </div>
                ` : ''}
            </div>
        `;

        actions.innerHTML = '';
        if (request.status === 'pending') {
            actions.innerHTML = `
                <button class="btn-success" onclick="window.adminPanel.approveRechargeRequest('${requestId}')">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn-danger" onclick="window.adminPanel.rejectRechargeRequest('${requestId}')">
                    <i class="fas fa-times"></i> Reject
                </button>
            `;
        }

        modal.style.display = 'block';
    }

    setupUserActionListeners() {
        document.querySelectorAll('.view-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('button').dataset.id;
                this.viewUserDetails(userId);
            });
        });

        document.querySelectorAll('.reset-password').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('button').dataset.id;
                this.openResetPasswordModal(userId);
            });
        });

        document.querySelectorAll('.ban-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('button').dataset.id;
                this.banUser(userId);
            });
        });

        document.querySelectorAll('.unban-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('button').dataset.id;
                this.unbanUser(userId);
            });
        });

        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('button').dataset.id;
                this.confirmDeleteUser(userId);
            });
        });

        document.querySelectorAll('.user-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const userId = e.target.value;
                this.toggleUserSelection(userId, e.target.checked);
            });
        });
    }

    toggleUserSelection(userId, isSelected) {
        if (isSelected) {
            this.selectedUsers.add(userId);
        } else {
            this.selectedUsers.delete(userId);
        }
        this.updateUserActionButtons();
    }

    toggleSelectAllUsers(e) {
        const checkboxes = document.querySelectorAll('.user-checkbox:not(:disabled)');
        checkboxes.forEach(checkbox => {
            checkbox.checked = e.target.checked;
            this.toggleUserSelection(checkbox.value, e.target.checked);
        });
    }

    updateUserActionButtons() {
        const hasSelection = this.selectedUsers.size > 0;
        const banBtn = document.getElementById('banSelectedBtn');
        const unbanBtn = document.getElementById('unbanSelectedBtn');
        const deleteBtn = document.getElementById('deleteSelectedBtn');

        if (hasSelection) {
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

    switchTab(tabName) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        
        document.querySelector(`[href="#${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
        document.getElementById('pageTitle').textContent = this.formatTabName(tabName);

        if (tabName === 'dashboard') this.loadStats();
        else if (tabName === 'users') this.loadUsers();
        else if (tabName === 'categories') this.loadCategories();
        else if (tabName === 'products') this.loadProducts();
        else if (tabName === 'payment-methods') this.loadPaymentMethods();
        else if (tabName === 'orders') this.loadOrders();
        else if (tabName === 'pending-orders') this.loadPendingOrders();
        else if (tabName === 'wallet-recharge') this.loadWalletRechargeRequests();
        else if (tabName === 'site-settings') this.loadSiteSettings();
    }

    formatTabName(tabName) {
        return tabName.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    openCategoryModal(categoryId = null) {
        const modal = document.getElementById('categoryModal');
        const title = document.getElementById('categoryModalTitle');
        
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
            document.getElementById('categoryForm').reset();
            document.getElementById('categoryId').value = '';
        }
        
        modal.style.display = 'block';
    }

    openProductModal(productId = null) {
        const modal = document.getElementById('productModal');
        const title = document.getElementById('productModalTitle');
        
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
            document.getElementById('productForm').reset();
            document.getElementById('productId').value = '';
        }
        
        modal.style.display = 'block';
    }

    openPaymentMethodModal(methodId = null) {
        console.log('Opening payment method modal with ID:', methodId);
        
        const modal = document.getElementById('paymentMethodModal');
        const title = document.getElementById('paymentMethodModalTitle');
        
        if (methodId) {
            title.textContent = 'Edit Payment Method';
            const method = this.paymentMethods.find(m => m.id === methodId);
            console.log('Found payment method:', method);
            
            if (method) {
                document.getElementById('paymentMethodId').value = method.id;
                document.getElementById('paymentMethodName').value = method.name;
                document.getElementById('paymentMethodNumber').value = method.payment_number;
                document.getElementById('paymentMethodInstructions').value = method.instructions || '';
                document.getElementById('paymentMethodStatus').value = method.is_active;
            }
        } else {
            title.textContent = 'Add Payment Method';
            document.getElementById('paymentMethodForm').reset();
            document.getElementById('paymentMethodId').value = '';
        }
        
        modal.style.display = 'block';
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

    renderCategories() {
        const tbody = document.getElementById('categoriesTableBody');
        if (!tbody) return;

        if (this.categories.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No categories found</td></tr>';
            return;
        }

        tbody.innerHTML = this.categories.map(category => `
            <tr>
                <td>
                    <i class="fas fa-folder" style="font-size: 1.5rem; color: #667eea;"></i>
                </td>
                <td><strong>${category.name}</strong></td>
                <td>${category.description || '-'}</td>
                <td>${category.products?.length || 0}</td>
                <td>
                    <span class="status-badge ${category.is_active ? 'status-active' : 'status-inactive'}">
                        ${category.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${new Date(category.created_at).toLocaleDateString()}</td>
                <td class="action-buttons">
                    <button class="btn-primary btn-sm edit-category" data-id="${category.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger btn-sm delete-category" data-id="${category.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="${category.is_active ? 'btn-danger' : 'btn-success'} btn-sm toggle-category" data-id="${category.id}">
                        ${category.is_active ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>'}
                    </button>
                </td>
            </tr>
        `).join('');

        this.setupCategoryActionListeners();
    }

    setupCategoryActionListeners() {
        document.querySelectorAll('.edit-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const categoryId = e.target.closest('button').dataset.id;
                this.openCategoryModal(categoryId);
            });
        });

        document.querySelectorAll('.delete-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const categoryId = e.target.closest('button').dataset.id;
                this.confirmDeleteCategory(categoryId);
            });
        });

        document.querySelectorAll('.toggle-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const categoryId = e.target.closest('button').dataset.id;
                const category = this.categories.find(c => c.id === categoryId);
                if (category) {
                    this.toggleCategoryStatus(categoryId, !category.is_active);
                }
            });
        });
    }

    renderProducts() {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;

        if (this.products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No products found</td></tr>';
            return;
        }

        tbody.innerHTML = this.products.map(product => `
            <tr>
                <td><strong>${product.name}</strong></td>
                <td>${product.categories?.name || '-'}</td>
                <td>${product.diamonds_count}</td>
                <td>$${product.price}</td>
                <td>
                    <span class="status-badge ${product.is_active ? 'status-active' : 'status-inactive'}">
                        ${product.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${new Date(product.created_at).toLocaleDateString()}</td>
                <td class="action-buttons">
                    <button class="btn-primary btn-sm edit-product" data-id="${product.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger btn-sm delete-product" data-id="${product.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="${product.is_active ? 'btn-danger' : 'btn-success'} btn-sm toggle-product" data-id="${product.id}">
                        ${product.is_active ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>'}
                    </button>
                </td>
            </tr>
        `).join('');

        this.setupProductActionListeners();
    }

    setupProductActionListeners() {
        document.querySelectorAll('.edit-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.closest('button').dataset.id;
                this.openProductModal(productId);
            });
        });

        document.querySelectorAll('.delete-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.closest('button').dataset.id;
                this.confirmDeleteProduct(productId);
            });
        });

        document.querySelectorAll('.toggle-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.closest('button').dataset.id;
                const product = this.products.find(p => p.id === productId);
                if (product) {
                    this.toggleProductStatus(productId, !product.is_active);
                }
            });
        });
    }

    renderPaymentMethods() {
        const tbody = document.getElementById('paymentMethodsTableBody');
        if (!tbody) return;

        if (this.paymentMethods.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No payment methods found</td></tr>';
            return;
        }

        tbody.innerHTML = this.paymentMethods.map(method => `
            <tr>
                <td><strong>${method.name}</strong></td>
                <td>${method.payment_number}</td>
                <td style="white-space: pre-line;">${method.instructions || '-'}</td>
                <td>
                    <span class="status-badge ${method.is_active ? 'status-active' : 'status-inactive'}">
                        ${method.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${new Date(method.created_at).toLocaleDateString()}</td>
                <td class="action-buttons">
                    <button class="btn-primary btn-sm edit-payment-method" data-id="${method.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger btn-sm delete-payment-method" data-id="${method.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="${method.is_active ? 'btn-danger' : 'btn-success'} btn-sm toggle-payment-method" data-id="${method.id}">
                        ${method.is_active ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>'}
                    </button>
                </td>
            </tr>
        `).join('');

        // CRITICAL FIX: Call the action listeners setup after rendering
        this.setupPaymentMethodActionListeners();
    }

    setupPaymentMethodActionListeners() {
        console.log('Setting up payment method action listeners');
        
        // Edit payment method
        document.querySelectorAll('.edit-payment-method').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const methodId = e.target.closest('button').dataset.id;
                console.log('Editing payment method:', methodId);
                this.openPaymentMethodModal(methodId);
            });
        });

        // Delete payment method
        document.querySelectorAll('.delete-payment-method').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const methodId = e.target.closest('button').dataset.id;
                console.log('Deleting payment method:', methodId);
                this.confirmDeletePaymentMethod(methodId);
            });
        });

        // Toggle payment method status
        document.querySelectorAll('.toggle-payment-method').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const methodId = e.target.closest('button').dataset.id;
                const method = this.paymentMethods.find(m => m.id === methodId);
                if (method) {
                    console.log('Toggling payment method status:', methodId);
                    this.togglePaymentMethodStatus(methodId, !method.is_active);
                }
            });
        });
    }

    renderOrders() {
        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;

        const statusFilter = document.getElementById('orderStatusFilter').value;
        const filteredOrders = statusFilter === 'all' ? 
            this.orders : this.orders.filter(order => order.status === statusFilter);

        if (filteredOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" class="text-center">No orders found</td></tr>';
            return;
        }

        tbody.innerHTML = filteredOrders.map(order => this.createOrderRow(order)).join('');
        this.setupOrderActionListeners('#ordersTableBody');
    }

    renderPendingOrders() {
        const tbody = document.getElementById('pendingOrdersTableBody');
        if (!tbody) return;

        if (this.pendingOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">No pending orders</td></tr>';
            return;
        }

        tbody.innerHTML = this.pendingOrders.map(order => this.createOrderRow(order, true)).join('');
        this.setupOrderActionListeners('#pendingOrdersTableBody');
    }

    createOrderRow(order, isPending = false) {
        return `
            <tr>
                <td><span class="id-cell">${order.id.substring(0, 8)}...</span></td>
                <td><span class="id-cell">${order.user_id?.substring(0, 8)}...</span></td>
                <td>${order.products?.name || '-'}</td>
                <td>${order.users?.email || '-'}</td>
                <td>$${order.products?.price || '0'}</td>
                <td>${order.payment_method || '-'}</td>
                <td>${order.payment_number || '-'}</td>
                <td><span class="id-cell">${order.transaction_id || '-'}</span></td>
                <td>${order.game_id || '-'}</td>
                ${!isPending ? `
                    <td>
                        <span class="status-badge status-${order.status}">
                            ${order.status}
                        </span>
                    </td>
                ` : ''}
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                <td class="action-buttons">
                    ${order.status === 'pending' ? `
                        <button class="btn-success btn-sm complete-order" data-id="${order.id}">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="btn-danger btn-sm delete-order" data-id="${order.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                    ${order.status === 'pending' ? `
                        <button class="btn-danger btn-sm cancel-order" data-id="${order.id}">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }

    setupOrderActionListeners(selector) {
        const tbody = document.querySelector(selector);
        if (!tbody) return;

        tbody.querySelectorAll('.complete-order').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.target.closest('button').dataset.id;
                this.updateOrderStatus(orderId, 'completed');
            });
        });

        tbody.querySelectorAll('.cancel-order').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.target.closest('button').dataset.id;
                this.updateOrderStatus(orderId, 'cancelled');
            });
        });

        tbody.querySelectorAll('.delete-order').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.target.closest('button').dataset.id;
                this.confirmDeleteOrder(orderId);
            });
        });
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
                await window.supabase.from('categories').update(categoryData).eq('id', categoryId);
            } else {
                await window.supabase.from('categories').insert([categoryData]);
            }

            document.getElementById('categoryModal').style.display = 'none';
            await this.loadCategories();
            await this.loadStats();
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Error saving category.');
        }
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
                await window.supabase.from('products').update(productData).eq('id', productId);
            } else {
                await window.supabase.from('products').insert([productData]);
            }

            document.getElementById('productModal').style.display = 'none';
            await this.loadProducts();
            await this.loadStats();
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Error saving product.');
        }
    }

    async savePaymentMethod(e) {
        e.preventDefault();
        
        console.log('Saving payment method...');
        
        const methodData = {
            name: document.getElementById('paymentMethodName').value,
            payment_number: document.getElementById('paymentMethodNumber').value,
            instructions: document.getElementById('paymentMethodInstructions').value,
            is_active: document.getElementById('paymentMethodStatus').value === 'true'
        };

        const methodId = document.getElementById('paymentMethodId').value;

        console.log('Method data:', methodData);
        console.log('Method ID:', methodId);

        try {
            let result;
            if (methodId) {
                console.log('Updating existing payment method...');
                result = await window.supabase.from('payment_methods').update(methodData).eq('id', methodId);
            } else {
                console.log('Creating new payment method...');
                result = await window.supabase.from('payment_methods').insert([methodData]);
            }

            console.log('Supabase result:', result);

            if (result.error) {
                console.error('Supabase error details:', result.error);
                throw new Error(`Database error: ${result.error.message} (Code: ${result.error.code})`);
            }

            if (!result.data && !result.error) {
                throw new Error('No response from database');
            }

            document.getElementById('paymentMethodModal').style.display = 'none';
            await this.loadPaymentMethods();
            alert('Payment method saved successfully!');
            
        } catch (error) {
            console.error('Error saving payment method:', error);
            alert('Error saving payment method: ' + error.message);
        }
    }

    async toggleCategoryStatus(categoryId, newStatus) {
        try {
            await window.supabase.from('categories').update({ is_active: newStatus }).eq('id', categoryId);
            await this.loadCategories();
            await this.loadStats();
        } catch (error) {
            console.error('Error updating category status:', error);
            alert('Error updating category status.');
        }
    }

    async toggleProductStatus(productId, newStatus) {
        try {
            await window.supabase.from('products').update({ is_active: newStatus }).eq('id', productId);
            await this.loadProducts();
            await this.loadStats();
        } catch (error) {
            console.error('Error updating product status:', error);
            alert('Error updating product status.');
        }
    }

    async togglePaymentMethodStatus(methodId, newStatus) {
        try {
            await window.supabase.from('payment_methods').update({ is_active: newStatus }).eq('id', methodId);
            await this.loadPaymentMethods();
        } catch (error) {
            console.error('Error updating payment method status:', error);
            alert('Error updating payment method status.');
        }
    }

    async updateOrderStatus(orderId, newStatus) {
        try {
            await window.supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
            await this.loadOrders();
            await this.loadPendingOrders();
            await this.loadStats();
            alert(`Order ${newStatus} successfully!`);
        } catch (error) {
            console.error('Error updating order status:', error);
            alert('Error updating order status.');
        }
    }

    async banUser(userId) {
        if (!confirm('Are you sure you want to ban this user?')) return;
        await this.updateUserStatus(userId, false);
    }

    async unbanUser(userId) {
        await this.updateUserStatus(userId, true);
    }

    async updateUserStatus(userId, isActive) {
        try {
            await window.supabase.from('users').update({ is_active: isActive }).eq('id', userId);
            await this.loadUsers();
            await this.loadStats();
            alert(`User ${isActive ? 'unbanned' : 'banned'} successfully!`);
        } catch (error) {
            console.error('Error updating user status:', error);
            alert('Error updating user status.');
        }
    }

    async banSelectedUsers() {
        const selectedCount = this.selectedUsers.size;
        if (selectedCount === 0 || !confirm(`Ban ${selectedCount} user(s)?`)) return;

        try {
            await window.supabase.from('users').update({ is_active: false }).in('id', Array.from(this.selectedUsers));
            this.selectedUsers.clear();
            await this.loadUsers();
            await this.loadStats();
            alert(`${selectedCount} user(s) banned!`);
        } catch (error) {
            console.error('Error banning users:', error);
            alert('Error banning users.');
        }
    }

    async unbanSelectedUsers() {
        const selectedCount = this.selectedUsers.size;
        if (selectedCount === 0 || !confirm(`Unban ${selectedCount} user(s)?`)) return;

        try {
            await window.supabase.from('users').update({ is_active: true }).in('id', Array.from(this.selectedUsers));
            this.selectedUsers.clear();
            await this.loadUsers();
            await this.loadStats();
            alert(`${selectedCount} user(s) unbanned!`);
        } catch (error) {
            console.error('Error unbanning users:', error);
            alert('Error unbanning users.');
        }
    }

    viewUserDetails(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        const ordersCount = user.orders?.length || 0;
        alert(`User Details:\n\nName: ${user.full_name || 'N/A'}\nEmail: ${user.email}\nMobile: ${user.mobile_number || 'N/A'}\nWallet Balance: $${user.wallet_balance || '0'}\nStatus: ${user.is_active ? 'Active' : 'Banned'}\nOrders: ${ordersCount}`);
    }

    openResetPasswordModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        document.getElementById('resetPasswordUserId').value = userId;
        document.getElementById('resetPasswordUserEmail').value = user.email;
        this.generatePassword();
        document.getElementById('resetPasswordModal').style.display = 'block';
    }

    closeResetPasswordModal() {
        document.getElementById('resetPasswordModal').style.display = 'none';
    }

    generatePassword() {
        const length = 12;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
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

        try {
            await window.supabase.from('users').update({ password: newPassword }).eq('id', userId);
            this.closeResetPasswordModal();
            alert('Password reset successfully!');
        } catch (error) {
            console.error('Error resetting password:', error);
            alert('Error resetting password.');
        }
    }

    confirmDeleteCategory(categoryId) {
        this.itemToDelete = categoryId;
        this.deleteType = 'category';
        const category = this.categories.find(c => c.id === categoryId);
        
        if (category) {
            const productCount = category.products?.length || 0;
            let warning = '';
            
            if (productCount > 0) {
                warning = `WARNING: This category has ${productCount} product(s). Deleting it will also remove these products!`;
            }
            
            document.getElementById('deleteModalTitle').textContent = 'Delete Category';
            document.getElementById('deleteMessage').innerHTML = `
                Are you sure you want to delete the category "<strong>${category.name}</strong>"?<br><br>
                ${warning ? `<div class="warning-text">${warning}</div><br>` : ''}
                This action cannot be undone.
            `;
        }
        
        document.getElementById('deleteModal').style.display = 'block';
    }

    confirmDeleteProduct(productId) {
        this.itemToDelete = productId;
        this.deleteType = 'product';
        const product = this.products.find(p => p.id === productId);
        
        if (product) {
            document.getElementById('deleteModalTitle').textContent = 'Delete Product';
            document.getElementById('deleteMessage').innerHTML = `
                Are you sure you want to delete the product "<strong>${product.name}</strong>"?<br><br>
                This action cannot be undone.
            `;
        }
        
        document.getElementById('deleteModal').style.display = 'block';
    }

    confirmDeletePaymentMethod(methodId) {
        this.itemToDelete = methodId;
        this.deleteType = 'payment-method';
        const method = this.paymentMethods.find(m => m.id === methodId);
        
        if (method) {
            document.getElementById('deleteModalTitle').textContent = 'Delete Payment Method';
            document.getElementById('deleteMessage').innerHTML = `
                Are you sure you want to delete the payment method "<strong>${method.name}</strong>"?<br><br>
                This action cannot be undone.
            `;
        }
        
        document.getElementById('deleteModal').style.display = 'block';
    }

    confirmDeleteOrder(orderId) {
        this.itemToDelete = orderId;
        this.deleteType = 'order';
        const order = this.orders.find(o => o.id === orderId) || this.pendingOrders.find(o => o.id === orderId);
        
        if (order) {
            document.getElementById('deleteModalTitle').textContent = 'Delete Order';
            document.getElementById('deleteMessage').innerHTML = `
                Are you sure you want to delete this order?<br><br>
                Product: ${order.products?.name || 'N/A'}<br>
                User: ${order.users?.email || 'N/A'}<br>
                Amount: $${order.products?.price || '0'}<br><br>
                This action cannot be undone.
            `;
        }
        
        document.getElementById('deleteModal').style.display = 'block';
    }

    confirmDeleteUser(userId) {
        this.itemToDelete = userId;
        this.deleteType = 'user';
        const user = this.users.find(u => u.id === userId);
        
        if (user) {
            const ordersCount = user.orders?.length || 0;
            let warning = '';
            
            if (ordersCount > 0) {
                warning = `WARNING: This user has ${ordersCount} order(s). Deleting the user will also remove these orders!`;
            }
            
            document.getElementById('deleteModalTitle').textContent = 'Delete User';
            document.getElementById('deleteMessage').innerHTML = `
                Are you sure you want to delete the user "<strong>${user.email}</strong>"?<br><br>
                ${warning ? `<div class="warning-text">${warning}</div><br>` : ''}
                This action cannot be undone.
            `;
        }
        
        document.getElementById('deleteModal').style.display = 'block';
    }

    closeDeleteModal() {
        document.getElementById('deleteModal').style.display = 'none';
        this.itemToDelete = null;
        this.deleteType = null;
    }

    async executeDelete() {
        if (!this.itemToDelete || !this.deleteType) return;

        try {
            let error;

            switch (this.deleteType) {
                case 'category':
                    await window.supabase.from('products').delete().eq('category_id', this.itemToDelete);
                    ({ error } = await window.supabase.from('categories').delete().eq('id', this.itemToDelete));
                    break;

                case 'product':
                    ({ error } = await window.supabase.from('products').delete().eq('id', this.itemToDelete));
                    break;

                case 'payment-method':
                    ({ error } = await window.supabase.from('payment_methods').delete().eq('id', this.itemToDelete));
                    break;

                case 'order':
                    ({ error } = await window.supabase.from('orders').delete().eq('id', this.itemToDelete));
                    break;

                case 'user':
                    await window.supabase.from('orders').delete().eq('user_id', this.itemToDelete);
                    ({ error } = await window.supabase.from('users').delete().eq('id', this.itemToDelete));
                    break;
            }

            if (error) throw error;

            this.closeDeleteModal();
            await this.loadAllData();
            alert(`${this.deleteType.charAt(0).toUpperCase() + this.deleteType.slice(1)} deleted successfully!`);
        } catch (error) {
            console.error(`Error deleting ${this.deleteType}:`, error);
            alert(`Error deleting ${this.deleteType}.`);
        }
    }

    async deleteSelectedUsers() {
        const selectedCount = this.selectedUsers.size;
        if (selectedCount === 0 || !confirm(`Delete ${selectedCount} user(s)? This will also delete all their orders!`)) return;

        try {
            await window.supabase.from('orders').delete().in('user_id', Array.from(this.selectedUsers));
            await window.supabase.from('users').delete().in('id', Array.from(this.selectedUsers));
            
            this.selectedUsers.clear();
            await this.loadAllData();
            alert(`${selectedCount} user(s) deleted!`);
        } catch (error) {
            console.error('Error deleting users:', error);
            alert('Error deleting users.');
        }
    }

    async deleteInactiveCategories() {
        if (!confirm('Delete ALL inactive categories? This will also delete all products in those categories!')) return;

        try {
            const { data: inactiveCategories } = await window.supabase.from('categories').select('id').eq('is_active', false);
            
            if (!inactiveCategories || inactiveCategories.length === 0) {
                alert('No inactive categories found.');
                return;
            }

            const categoryIds = inactiveCategories.map(cat => cat.id);
            await window.supabase.from('products').delete().in('category_id', categoryIds);
            await window.supabase.from('categories').delete().in('id', categoryIds);
            
            await this.loadAllData();
            alert(`${inactiveCategories.length} inactive categories deleted!`);
        } catch (error) {
            console.error('Error deleting inactive categories:', error);
            alert('Error deleting inactive categories.');
        }
    }

    async deleteInactiveProducts() {
        if (!confirm('Delete ALL inactive products?')) return;

        try {
            await window.supabase.from('products').delete().eq('is_active', false);
            await this.loadAllData();
            alert('Inactive products deleted!');
        } catch (error) {
            console.error('Error deleting inactive products:', error);
            alert('Error deleting inactive products.');
        }
    }

    async deleteCompletedOrders() {
        if (!confirm('Delete ALL completed orders?')) return;

        try {
            await window.supabase.from('orders').delete().eq('status', 'completed');
            await this.loadAllData();
            alert('Completed orders deleted!');
        } catch (error) {
            console.error('Error deleting completed orders:', error);
            alert('Error deleting completed orders.');
        }
    }

    async completeAllPending() {
        if (!confirm('Mark ALL pending orders as completed?')) return;

        try {
            await window.supabase.from('orders').update({ status: 'completed' }).eq('status', 'pending');
            await this.loadAllData();
            alert('All pending orders completed!');
        } catch (error) {
            console.error('Error completing orders:', error);
            alert('Error completing orders.');
        }
    }

    async cancelAllPending() {
        if (!confirm('Cancel ALL pending orders?')) return;

        try {
            await window.supabase.from('orders').update({ status: 'cancelled' }).eq('status', 'pending');
            await this.loadAllData();
            alert('All pending orders cancelled!');
        } catch (error) {
            console.error('Error cancelling orders:', error);
            alert('Error cancelling orders.');
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    window.adminPanel = new AdminPanel();
});