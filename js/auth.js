// Authentication functions
class Auth {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('currentUser'));
        this.init();
    }

    async init() {
        await this.waitForSupabase();
        this.updateUI();
        this.protectPages();
    }

    async waitForSupabase() {
        return new Promise((resolve) => {
            const checkSupabase = () => {
                if (typeof window.supabase !== 'undefined') {
                    console.log('Supabase is ready');
                    resolve();
                } else {
                    console.log('Waiting for Supabase...');
                    setTimeout(checkSupabase, 100);
                }
            };
            checkSupabase();
        });
    }

    async login(email, password) {
        try {
            if (typeof window.supabase === 'undefined') {
                throw new Error('Database connection not available. Please refresh the page.');
            }

            const { data: users, error } = await window.supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .eq('password', password)
                .single();

            if (error || !users) {
                throw new Error('Invalid email or password');
            }

            // Check if user is active
            if (!users.is_active) {
                throw new Error('Your account has been suspended. Please contact support.');
            }

            this.currentUser = users;
            localStorage.setItem('currentUser', JSON.stringify(users));
            this.updateUI();
            
            // Redirect based on user
            if (email === 'admin123@gmail.com') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'account.html';
            }
            
            return true;
        } catch (error) {
            alert(error.message);
            return false;
        }
    }

    async register(userData) {
        try {
            if (typeof window.supabase === 'undefined') {
                throw new Error('Database connection not available. Please refresh the page.');
            }

            // Check if user already exists
            const { data: existingUser } = await window.supabase
                .from('users')
                .select('email')
                .eq('email', userData.email)
                .single();

            if (existingUser) {
                throw new Error('User already exists with this email');
            }

            // Insert new user
            const { data, error } = await window.supabase
                .from('users')
                .insert([{
                    ...userData,
                    is_active: true,
                    wallet_balance: 0
                }])
                .select()
                .single();

            if (error) throw error;

            this.currentUser = data;
            localStorage.setItem('currentUser', JSON.stringify(data));
            this.updateUI();
            
            window.location.href = 'account.html';
            return true;
        } catch (error) {
            alert(error.message);
            return false;
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.updateUI();
        window.location.href = 'index.html';
    }

    updateUI() {
        const loginBtn = document.getElementById('loginBtn');
        const accountBtn = document.getElementById('accountBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (this.currentUser) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (accountBtn) accountBtn.style.display = 'block';
            if (logoutBtn) logoutBtn.style.display = 'block';
        } else {
            if (loginBtn) loginBtn.style.display = 'block';
            if (accountBtn) accountBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'none';
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    isAdmin() {
        return this.currentUser && this.currentUser.email === 'admin123@gmail.com';
    }

    protectPages() {
        const currentPage = window.location.pathname;

        // Protect admin page - only admin can access
        if (currentPage.includes('admin.html')) {
            if (!this.isAuthenticated() || !this.isAdmin()) {
                window.location.href = 'login.html';
                return;
            }
        }

        // Protect account page - only authenticated users can access
        if (currentPage.includes('account.html')) {
            if (!this.isAuthenticated()) {
                window.location.href = 'login.html';
                return;
            }
        }

        // Redirect admin from home page to admin panel
        if (currentPage.includes('index.html') || currentPage === '/') {
            if (this.isAuthenticated() && this.isAdmin()) {
                // Admin will see home page but can navigate to admin panel via account page
                console.log('Admin user on home page');
            }
        }
    }

    // Check if user should be redirected from login page
    checkAutoRedirect() {
        if (this.isAuthenticated()) {
            if (this.isAdmin()) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'account.html';
            }
        }
    }
}

// Initialize auth when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.auth = new Auth();

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            await window.auth.login(email, password);
        });
    }

    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const userData = {
                full_name: document.getElementById('registerName').value,
                email: document.getElementById('registerEmail').value,
                mobile_number: document.getElementById('registerMobile').value,
                password: document.getElementById('registerPassword').value
            };
            await window.auth.register(userData);
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.auth.logout();
        });
    }

    // Check for auto-redirect on login page
    if (window.location.pathname.includes('login.html')) {
        window.auth.checkAutoRedirect();
    }
});