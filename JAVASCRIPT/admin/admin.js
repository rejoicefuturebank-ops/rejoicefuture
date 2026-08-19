// ============================================
// ADMIN APPLICATION - MAIN MODULE (FIXED)
// ============================================

const AdminApp = {
    adminData: null,
    currentSection: 'admin-dashboard',

    async init() {
        console.log('🔧 Admin App initializing...');
        
        // Always setup navigation and form handlers first
        this.setupNavigation();
        this.setupLoginForm(); // ← This was missing!
        
        // Check if already authenticated
        this.adminData = JSON.parse(localStorage.getItem('admin_data'));
        
        if (this.adminData && this.adminData.token) {
            console.log('✅ Admin already authenticated');
            this.hideLogin();
            this.updateAdminInfo();
            await this.loadDashboard();
        } else {
            console.log('📝 Showing login form');
            this.showLogin();
        }
        
        console.log('✅ Admin App initialized');
    },

    showLogin() {
        const loginView = document.getElementById('adminLoginView');
        const dashboardView = document.getElementById('adminDashboardView');
        
        if (loginView) loginView.style.display = 'flex';
        if (dashboardView) dashboardView.style.display = 'none';
    },

    hideLogin() {
        const loginView = document.getElementById('adminLoginView');
        const dashboardView = document.getElementById('adminDashboardView');
        
        if (loginView) loginView.style.display = 'none';
        if (dashboardView) dashboardView.style.display = 'flex';
    },

    updateAdminInfo() {
        if (!this.adminData?.admin) return;

        const admin = this.adminData.admin;
        const nameEl = document.getElementById('adminName');
        const roleEl = document.getElementById('adminRole');

        if (nameEl) {
            nameEl.textContent = `${admin.first_name} ${admin.last_name}`;
        }
        if (roleEl) {
            roleEl.textContent = admin.role || 'Admin';
        }
    },

    setupNavigation() {
        // Navigation clicks
        document.querySelectorAll('.admin-nav .nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                if (section) this.switchSection(section);
            });
        });

        // Logout button
        const logoutBtn = document.getElementById('adminLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }
    },

    setupLoginForm() {
        console.log('🔧 Setting up login form...');
        
        const loginForm = document.getElementById('adminLoginForm');
        if (!loginForm) {
            console.error('❌ Login form not found!');
            return;
        }

        // Remove any existing listeners to prevent duplicates
        loginForm.removeEventListener('submit', this.handleLogin);
        
        // Attach the submit handler
        loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        
        console.log('✅ Login form event listener attached');
    },

    async handleLogin(e) {
        e.preventDefault();
        console.log('🔐 Login form submitted');
        
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        const errorDiv = document.getElementById('adminLoginError');
        const submitBtn = e.target.querySelector('button[type="submit"]');

        console.log('Attempting login for:', email);

        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';
        if (errorDiv) errorDiv.style.display = 'none';

        try {
            const response = await API.adminLogin(email, password);
            console.log('Login response:', response);

            if (response.token && response.admin) {
                // Store admin data
                localStorage.setItem('admin_token', response.token);
                localStorage.setItem('admin_data', JSON.stringify(response));
                
                this.adminData = response;
                Utils.showToast(`Welcome back, ${response.admin.first_name}!`, 'success');
                
                setTimeout(() => {
                    this.hideLogin();
                    this.updateAdminInfo();
                    this.loadDashboard();
                }, 500);
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('Admin login error:', error);
            if (errorDiv) {
                errorDiv.textContent = error.message || 'Invalid credentials';
                errorDiv.style.display = 'block';
            }
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    },

    logout() {
        if (!confirm('Are you sure you want to logout?')) return;
        
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_data');
        this.adminData = null;
        this.showLogin();
        Utils.showToast('Logged out successfully', 'info');
    },

    switchSection(section) {
        console.log('Switching to section:', section);
        
        // Update nav active state
        document.querySelectorAll('.admin-nav .nav-item').forEach(n => n.classList.remove('active'));
        const activeNav = document.querySelector(`[data-section="${section}"]`);
        if (activeNav) activeNav.classList.add('active');

        // Show/hide sections
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        const targetSection = document.getElementById(`admin-section-${section.replace('admin-', '')}`);
        if (targetSection) targetSection.classList.add('active');

        this.currentSection = section;

        // Initialize section-specific modules
        this.initializeSection(section);
    },

    initializeSection(section) {
        switch (section) {
            case 'admin-dashboard':
                this.loadDashboard();
                break;
            case 'admin-users':
                if (typeof AdminUsers !== 'undefined') AdminUsers.init();
                break;
            case 'admin-balances':
                if (typeof AdminBalances !== 'undefined') AdminBalances.init();
                break;
            case 'admin-support':
                if (typeof AdminSupport !== 'undefined') AdminSupport.init();
                break;
            case 'admin-audit':
                if (typeof AdminAudit !== 'undefined') AdminAudit.init();
                break;
            case 'admin-limits':
                if (typeof AdminLimits !== 'undefined') AdminLimits.init();
                break;
            case 'admin-simulation':
                this.initSimulation();
                break;
            case 'admin-impersonation':
                if (typeof AdminImpersonation !== 'undefined') AdminImpersonation.init();
                break;
            case 'admin-settings':
                this.loadSettings();
                break;
            case 'admin-reports':
                if (typeof AdminReports !== 'undefined') AdminReports.init();
                break;
            case 'admin-transactions':
                if (typeof AdminTransactions !== 'undefined') AdminTransactions.init();
                break;
            case 'admin-security':
                this.loadSecurityEvents();
                break;
            case 'admin-otp':
                if (typeof AdminOTP !== 'undefined') AdminOTP.init();
                break;
        }
    },

    async loadDashboard() {
        try {
            const stats = await API.admin.getDashboardStats();

            const updateStat = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };

            updateStat('statTotalUsers', stats.totalUsers?.toLocaleString() || '0');
            updateStat('statActiveUsers', stats.activeUsers?.toLocaleString() || '0');
            updateStat('statTotalBalance', Utils.formatCurrency(stats.totalBalanceUSD || 0));
            updateStat('statTransactions', stats.totalTransactions?.toLocaleString() || '0');
            updateStat('statPending', stats.pendingTransactions?.toLocaleString() || '0');
            updateStat('statOpenTickets', stats.openTickets?.toLocaleString() || '0');

        } catch (error) {
            console.error('Dashboard load error:', error);
        }
    },

    initSimulation() {
        document.querySelectorAll('.btn-sim').forEach(btn => {
            btn.onclick = async () => {
                const scenario = btn.dataset.scenario;
                const reason = prompt('Enter a reason for this simulation (for audit):');
                if (!reason) return;

                try {
                    const users = await API.admin.searchUsers('');
                    const userId = users.users?.[0]?.id;
                    const accountId = users.users?.[0]?.accounts?.[0]?.id;

                    if (!userId) {
                        Utils.showToast('No users found to simulate with', 'error');
                        return;
                    }

                    await API.admin.simulate(scenario, {
                        user_id: userId,
                        account_id: accountId,
                        amount: 100,
                        reason
                    });
                    Utils.showToast(`Simulation "${scenario}" executed!`, 'success');
                } catch (error) {
                    Utils.showToast(`Simulation failed: ${error.message}`, 'error');
                }
            };
        });
    },

    async loadSettings() {
        try {
            const settings = await API.admin.getSettings();
            const container = document.getElementById('settingsContent');
            if (!container) return;

            container.innerHTML = Object.entries(settings).map(([key, value]) => `
                <div class="form-group">
                    <label>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                    <textarea class="setting-input" data-key="${key}" rows="2">${JSON.stringify(value, null, 2)}</textarea>
                </div>
            `).join('') + '<button class="btn btn-primary" id="saveSettingsBtn">💾 Save All Settings</button>';

            document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
                const inputs = document.querySelectorAll('.setting-input');
                let saved = 0;
                
                for (const input of inputs) {
                    try {
                        const value = JSON.parse(input.value);
                        await API.admin.updateSetting(input.dataset.key, value);
                        saved++;
                    } catch (e) {
                        Utils.showToast(`Invalid JSON for ${input.dataset.key}`, 'error');
                        return;
                    }
                }
                Utils.showToast(`${saved} settings saved!`, 'success');
            });
        } catch (error) {
            console.error('Settings load error:', error);
        }
    },

    async loadSecurityEvents() {
        try {
            const response = await API.admin.getSecurityEvents({ limit: 50 });
            const events = response.events || [];
            const container = document.getElementById('securityContent');
            if (!container) return;

            if (events.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>No security events</p></div>';
                return;
            }

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>User</th>
                                <th>Event</th>
                                <th>Severity</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${events.map(e => `
                                <tr>
                                    <td>${Utils.formatDateTime(e.created_at)}</td>
                                    <td>${e.users?.email || 'Unknown'}</td>
                                    <td><code>${e.event_type}</code></td>
                                    <td><span class="badge badge-${e.severity === 'high' ? 'danger' : e.severity === 'medium' ? 'warning' : 'info'}">${e.severity}</span></td>
                                    <td>${e.description || '—'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            console.error('Security events error:', error);
        }
    }
};

// ============================================
// AUTO-INITIALIZE - ALWAYS RUN ON ADMIN PAGE
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('admin.html')) {
        console.log('🚀 Admin page detected, initializing AdminApp');
        AdminApp.init();
    }
});