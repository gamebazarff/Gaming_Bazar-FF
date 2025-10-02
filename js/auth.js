// Authentication functions
class Auth {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('currentUser'));
        this.init();
    }

    async init() {
        await this.waitForSupabase();
        this.updateUI();
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
                .insert([userData])
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

    // Protect admin page
    if (window.location.pathname.includes('admin.html')) {
        if (!window.auth.isAuthenticated() || !window.auth.isAdmin()) {
            window.location.href = 'login.html';
        }
    }

    // Protect account page
    if (window.location.pathname.includes('account.html')) {
        if (!window.auth.isAuthenticated()) {
            window.location.href = 'login.html';
        }
    }
});
