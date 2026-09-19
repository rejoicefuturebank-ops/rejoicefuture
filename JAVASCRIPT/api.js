// API Client Module
const API = {
    baseURL: 'https://rejoicefuturebank.vercel.app/api',


    getToken() {
        return localStorage.getItem('banking_token');
    },

    getAdminToken() {
        return localStorage.getItem('admin_token');
    },

    setToken(token) {
        localStorage.setItem('banking_token', token);
    },

    setAdminToken(token) {
        localStorage.setItem('admin_token', token);
    },

    clearTokens() {
        localStorage.removeItem('banking_token');
        localStorage.removeItem('admin_token');
        localStorage.removeItem('impersonation_session');
    },

    async request(endpoint, options = {}) {
        const token = options.admin ? this.getAdminToken() : this.getToken();

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    },

    // Auth
    async register(data) {
        return this.request('/auth/register', { method: 'POST', body: JSON.stringify(data) });
    },

    async login(email, password) {
        return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    },

    async adminLogin(email, password) {
        return this.request('/auth/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    },

    async logout() {
        return this.request('/auth/logout', { method: 'POST' });
    },

    async getCurrentUser() {
        return this.request('/auth/me');
    },

    // Stepped signup flow
    async updateRegistrationLocation(data) {
        return this.request('/auth/register/location', { method: 'PATCH', body: JSON.stringify(data) });
    },

    async getRegistrationReview() {
        return this.request('/auth/register/review');
    },

    async sendVerificationCode() {
        return this.request('/auth/register/send-verification', { method: 'POST' });
    },

    async resendVerificationCode() {
        return this.request('/auth/register/resend-code', { method: 'POST' });
    },

    async verifyEmailCode(code) {
        return this.request('/auth/register/verify-email', { method: 'POST', body: JSON.stringify({ code }) });
    },

    async forgotPassword(email) {
        return this.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    },

    async resetPassword(token, newPassword) {
        return this.request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
    },

    // Accounts
    async getAccounts() {
        return this.request('/accounts');
    },

    async getAccount(id) {
        return this.request(`/accounts/${id}`);
    },

    async createAccount(data) {
        return this.request('/accounts', { method: 'POST', body: JSON.stringify(data) });
    },

    // Funding (real money in — replaces the old fake "deposit")
    async initiateFunding(data) {
        return this.request('/funding/initiate', { method: 'POST', body: JSON.stringify(data) });
    },

    async getFundingStatus(reference) {
        return this.request(`/funding/status/${reference}`);
    },

    async convert(data) {
        return this.request('/accounts/convert', { method: 'POST', body: JSON.stringify(data) });
    },

    async getExchangeRates() {
        return this.request('/accounts/exchange-rates');
    },

    // Transfers — split into internal (same-app, real ledger movement)
    // and external (payout via Flutterwave to a saved beneficiary)
    async sendInternalTransfer(data) {
        return this.request('/transfers/internal', { method: 'POST', body: JSON.stringify(data) });
    },

    async sendExternalTransfer(data) {
        return this.request('/transfers/external', { method: 'POST', body: JSON.stringify(data) });
    },

    async getTransferHistory(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/transfers/history?${query}`);
    },

    async getBeneficiaries() {
        return this.request('/transfers/beneficiaries');
    },

    async getBanks(countryCode) {
        return this.request(`/transfers/banks/${countryCode}`);
    },

    async addBeneficiary(data) {
        return this.request('/transfers/beneficiaries', { method: 'POST', body: JSON.stringify(data) });
    },

    async removeBeneficiary(id) {
        return this.request(`/transfers/beneficiaries/${id}`, { method: 'DELETE' });
    },

    // Cards
    async getCards() {
        return this.request('/cards');
    },

    async createCard(data) {
        return this.request('/cards', { method: 'POST', body: JSON.stringify(data) });
    },

    async activateCard(id) {
        return this.request(`/cards/${id}/activate`, { method: 'POST' });
    },

    async freezeCard(id) {
        return this.request(`/cards/${id}/freeze`, { method: 'POST' });
    },

    async unfreezeCard(id) {
        return this.request(`/cards/${id}/unfreeze`, { method: 'POST' });
    },

    async cancelCard(id) {
        return this.request(`/cards/${id}/cancel`, { method: 'POST' });
    },

    // Savings
    async getSavings() {
        return this.request('/savings');
    },

    async createSavings(data) {
        return this.request('/savings', { method: 'POST', body: JSON.stringify(data) });
    },

    async depositSavings(id, amount) {
        return this.request(`/savings/${id}/deposit`, { method: 'POST', body: JSON.stringify({ amount }) });
    },

    // Investments
    async getPortfolio() {
        return this.request('/investments/portfolio');
    },

    async getAssets() {
        return this.request('/investments/assets');
    },

    async buyAsset(data) {
        return this.request('/investments/buy', { method: 'POST', body: JSON.stringify(data) });
    },

    async sellAsset(data) {
        return this.request('/investments/sell', { method: 'POST', body: JSON.stringify(data) });
    },

    // Loans
    async getLoans() {
        return this.request('/loans');
    },

    async applyLoan(data) {
        return this.request('/loans/apply', { method: 'POST', body: JSON.stringify(data) });
    },

    async payLoan(id, amount) {
        return this.request(`/loans/${id}/pay`, { method: 'POST', body: JSON.stringify({ amount }) });
    },

    async calculateLoan(data) {
        return this.request('/loans/calculate', { method: 'POST', body: JSON.stringify(data) });
    },

    // Support
    async getTickets() {
        return this.request('/support/tickets');
    },

    async createTicket(data) {
        return this.request('/support/tickets', { method: 'POST', body: JSON.stringify(data) });
    },

    async replyToTicket(id, message) {
        return this.request(`/support/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ message }) });
    },

    async requestLimitIncrease(data) {
        return this.request('/support/request-limit-increase', { method: 'POST', body: JSON.stringify(data) });
    },

    // Notifications
    async getNotifications() {
        return this.request('/notifications');
    },

    async markNotificationRead(id) {
        return this.request(`/notifications/${id}/read`, { method: 'PUT' });
    },

    async markAllNotificationsRead() {
        return this.request('/notifications/read-all', { method: 'PUT' });
    },

    // Admin APIs
    admin: {
        async getDashboardStats() {
            return API.request('/admin/reports/dashboard', { admin: true });
        },

        async searchUsers(query) {
            return API.request(`/admin/users/search?q=${encodeURIComponent(query)}`, { admin: true });
        },

        async getUser(id) {
            return API.request(`/admin/users/${id}`, { admin: true });
        },

        async freezeUser(id, reason) {
            return API.request(`/admin/users/${id}/freeze`, { admin: true, method: 'POST', body: JSON.stringify({ reason }) });
        },

        async unfreezeUser(id, reason) {
            return API.request(`/admin/users/${id}/unfreeze`, { admin: true, method: 'POST', body: JSON.stringify({ reason }) });
        },

        async suspendUser(id, reason) {
            return API.request(`/admin/users/${id}/suspend`, { admin: true, method: 'POST', body: JSON.stringify({ reason }) });
        },

        async updateUserLimits(id, data) {
            return API.request(`/admin/users/${id}/limits`, { admin: true, method: 'PUT', body: JSON.stringify(data) });
        },

        async adjustBalance(data) {
            return API.request('/admin/balances/adjust', { admin: true, method: 'POST', body: JSON.stringify(data) });
        },

        async getAdjustmentHistory(params = {}) {
            const query = new URLSearchParams(params).toString();
            return API.request(`/admin/balances/history?${query}`, { admin: true });
        },

        async getSupportTickets(params = {}) {
            const query = new URLSearchParams(params).toString();
            return API.request(`/admin/support/tickets?${query}`, { admin: true });
        },

        async replyToTicket(id, message, isInternal = false) {
            return API.request(`/admin/support/tickets/${id}/reply`, {
                admin: true, method: 'POST',
                body: JSON.stringify({ message, is_internal: isInternal })
            });
        },

        async updateTicketStatus(id, status) {
            return API.request(`/admin/support/tickets/${id}/status`, {
                admin: true, method: 'PUT',
                body: JSON.stringify({ status })
            });
        },

        async approveLimitRequest(id, data) {
            return API.request(`/admin/support/limit-requests/${id}/approve`, {
                admin: true, method: 'POST', body: JSON.stringify(data)
            });
        },

        async getAuditLogs(params = {}) {
            const query = new URLSearchParams(params).toString();
            return API.request(`/admin/audit?${query}`, { admin: true });
        },

        async getSettings() {
            return API.request('/admin/settings', { admin: true });
        },

        async updateSetting(key, value) {
            return API.request(`/admin/settings/${key}`, {
                admin: true, method: 'PUT',
                body: JSON.stringify({ value })
            });
        },

        async startImpersonation(userId, reason) {
            return API.request('/admin/impersonation/start', {
                admin: true, method: 'POST',
                body: JSON.stringify({ user_id: userId, reason })
            });
        },

        async endImpersonation(sessionId) {
            return API.request('/admin/impersonation/end', {
                admin: true, method: 'POST',
                body: JSON.stringify({ session_id: sessionId })
            });
        },

        async simulate(scenario, data) {
            return API.request('/admin/simulation/simulate', {
                admin: true, method: 'POST',
                body: JSON.stringify({ scenario, ...data })
            });
        },

        async getSecurityEvents(params = {}) {
            const query = new URLSearchParams(params).toString();
            return API.request(`/admin/security/events?${query}`, { admin: true });
        },

        async getOTPSettings(userId) {
            return API.request(`/admin/security/otp-settings/${userId}`, { admin: true });
        },

        async updateOTPSettings(userId, settings) {
            return API.request(`/admin/security/otp-settings/${userId}`, {
                admin: true, method: 'PUT', body: JSON.stringify(settings)
            });
        }
    }
};

// Utility Functions
const Utils = {
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency
        }).format(amount);
    },

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    },

    formatDateTime(date) {
        return new Date(date).toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    },

    showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toastContainer') || document.getElementById('adminToastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    showModal(content) {
        const overlay = document.getElementById('modalOverlay') || document.getElementById('adminModalOverlay');
        const modalContent = document.getElementById('modalContent') || document.getElementById('adminModalContent');

        if (!overlay || !modalContent) return;

        modalContent.innerHTML = content;
        overlay.style.display = 'flex';

        overlay.onclick = (e) => {
            if (e.target === overlay) this.closeModal();
        };
    },

    closeModal() {
        const overlay = document.getElementById('modalOverlay') || document.getElementById('adminModalOverlay');
        if (overlay) overlay.style.display = 'none';
    },

    isAuthenticated() {
        return !!localStorage.getItem('banking_token');
    },

    isAdminAuthenticated() {
        return !!localStorage.getItem('admin_token');
    },

    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
        }
    },

    requireAdmin() {
        if (!this.isAdminAuthenticated()) {
            document.getElementById('adminLoginView').style.display = 'flex';
            document.getElementById('adminDashboardView').style.display = 'none';
        }
    }
};