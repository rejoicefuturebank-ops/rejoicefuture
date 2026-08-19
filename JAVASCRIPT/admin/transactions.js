const AdminTransactions = {
    async init() {
        await this.loadTransactions();
    },

    async loadTransactions() {
        const container = document.getElementById('transactionsAdminContent');
        if (!container) return;

        container.innerHTML = `
            <div class="admin-toolbar">
                <select id="txStatusFilter">
                    <option value="">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                </select>
                <button class="btn btn-primary" onclick="AdminTransactions.filter()">Filter</button>
            </div>
            <div id="transactionsTable"></div>
        `;

        await this.fetchAndRender();
    },

    async fetchAndRender(status = '') {
        try {
            const query = status ? `?status=${status}` : '';
            const response = await API.request(`/admin/reports/transactions${query}`, { admin: true });
            const transactions = response.transactions || [];

            document.getElementById('transactionsTable').innerHTML = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr><th>Reference</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                        <tbody>
                            ${transactions.slice(0, 50).map(tx => `
                                <tr>
                                    <td><code>${tx.reference}</code></td>
                                    <td>${tx.transaction_type}</td>
                                    <td>${Utils.formatCurrency(tx.amount, tx.currency)}</td>
                                    <td><span class="badge badge-${tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger'}">${tx.status}</span></td>
                                    <td>${Utils.formatDateTime(tx.created_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    },

    filter() {
        const status = document.getElementById('txStatusFilter').value;
        this.fetchAndRender(status);
    }
};