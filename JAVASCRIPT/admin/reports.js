const AdminReports = {
    async init() {
        await this.loadReports();
    },

    async loadReports() {
        const container = document.getElementById('reportsContent');
        if (!container) return;

        try {
            const stats = await API.admin.getDashboardStats();

            container.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">👥</div>
                        <div class="stat-info">
                            <span class="stat-value">${stats.totalUsers}</span>
                            <span class="stat-label">Total Users</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">✅</div>
                        <div class="stat-info">
                            <span class="stat-value">${stats.activeUsers}</span>
                            <span class="stat-label">Active (30d)</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">💰</div>
                        <div class="stat-info">
                            <span class="stat-value">${Utils.formatCurrency(stats.totalBalanceUSD)}</span>
                            <span class="stat-label">Total Balances</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">💸</div>
                        <div class="stat-info">
                            <span class="stat-value">${Utils.formatCurrency(stats.transferVolume30d)}</span>
                            <span class="stat-label">Transfer Volume (30d)</span>
                        </div>
                    </div>
                </div>
                <div class="mt-2">
                    <button class="btn btn-outline" onclick="AdminReports.exportTransactions()">📥 Export Transactions CSV</button>
                </div>
            `;
        } catch (error) {
            container.innerHTML = `<div class="alert alert-error">Failed to load reports</div>`;
        }
    },

    exportTransactions() {
        const token = API.getAdminToken();
        window.open(`${API.baseURL}/admin/reports/export/transactions?token=${token}`, '_blank');
    }
};