// ============================================
// ADMIN BALANCE ADJUSTMENTS MODULE
// ============================================

const AdminBalances = {
    selectedUserId: null,
    selectedUserAccounts: [],

    init() {
        console.log('⚖️ Admin Balances initializing');
        this.setupForm();
        this.loadHistory();
    },

    setupForm() {
        const searchInput = document.getElementById('adjustUserSearch');
        const resultsDiv = document.getElementById('adjustUserResults');
        const form = document.getElementById('balanceAdjustForm');

        if (!searchInput || !resultsDiv || !form) {
            console.warn('Balance adjustment form elements not found');
            return;
        }

        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                const q = e.target.value.trim();
                if (q.length < 2) {
                    resultsDiv.innerHTML = '';
                    return;
                }

                try {
                    const response = await API.admin.searchUsers(q);
                    const users = response.users || [];

                    resultsDiv.innerHTML = users.slice(0, 5).map(u => `
                        <div class="search-result-item" data-id="${u.id}" data-email="${u.email}">
                            ${u.profiles?.full_name || 'No name'} - ${u.email}
                        </div>
                    `).join('');

                    if (users.length === 0) {
                        resultsDiv.innerHTML = '<div class="search-result-item">No users found</div>';
                    }

                    resultsDiv.querySelectorAll('.search-result-item[data-id]').forEach(item => {
                        item.addEventListener('click', async () => {
                            this.selectedUserId = item.dataset.id;
                            searchInput.value = `${item.textContent.trim()}`;
                            resultsDiv.innerHTML = '';

                            // Load user accounts
                            try {
                                const userData = await API.admin.getUser(item.dataset.id);
                                this.selectedUserAccounts = userData.accounts || [];

                                const select = document.getElementById('adjustAccountId');
                                if (select) {
                                    select.innerHTML = '<option value="">Select account...</option>' +
                                        this.selectedUserAccounts.map(a =>
                                            `<option value="${a.id}">${a.currency} - ${a.account_number} (Balance: ${Utils.formatCurrency(a.account_balances?.available_balance || 0, a.currency)})</option>`
                                        ).join('');
                                }
                            } catch (err) {
                                Utils.showToast('Failed to load user accounts', 'error');
                            }
                        });
                    });
                } catch (error) {
                    console.error('Search error:', error);
                }
            }, 300);
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const accountId = document.getElementById('adjustAccountId').value;
            const type = document.getElementById('adjustType').value;
            const amount = parseFloat(document.getElementById('adjustAmount').value);
            const reason = document.getElementById('adjustReason').value;

            if (!accountId || !amount || !reason) {
                Utils.showToast('All fields are required', 'error');
                return;
            }

            if (!confirm(`Are you sure you want to ${type} the balance by ${Utils.formatCurrency(amount)}?\n\nReason: ${reason}\n\nThis action will be audited.`)) {
                return;
            }

            try {
                const result = await API.admin.adjustBalance({
                    account_id: accountId,
                    type,
                    amount,
                    reason,
                    reference: `ADMIN-${Date.now()}`
                });

                Utils.showModal(`
                    <div class="modal-header">
                        <h3>⚖️ Balance Adjustment Completed</h3>
                        <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
                    </div>
                    <div class="receipt">
                        <div class="receipt-header">
                            <div class="receipt-icon">⚖️</div>
                            <h4>Adjustment Receipt</h4>
                        </div>
                        <div class="receipt-details">
                            <div class="receipt-row">
                                <span class="label">Before:</span>
                                <span class="value">${Utils.formatCurrency(result.details.before)}</span>
                            </div>
                            <div class="receipt-row">
                                <span class="label">Adjustment:</span>
                                <span class="value">${result.details.adjustment > 0 ? '+' : ''}${Utils.formatCurrency(result.details.adjustment)}</span>
                            </div>
                            <div class="receipt-row">
                                <span class="label">After:</span>
                                <span class="value">${Utils.formatCurrency(result.details.after)}</span>
                            </div>
                            <div class="receipt-row">
                                <span class="label">Reference:</span>
                                <span class="value">${result.details.reference}</span>
                            </div>
                            <div class="receipt-row">
                                <span class="label">Reason:</span>
                                <span class="value">${reason}</span>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-block mt-2" onclick="Utils.closeModal()">Done</button>
                `);

                this.loadHistory();
                form.reset();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    },

    async loadHistory() {
        try {
            const response = await API.admin.getAdjustmentHistory({ limit: 50 });
            const adjustments = response.adjustments || [];

            const tbody = document.getElementById('adjustmentHistoryBody');
            if (!tbody) return;

            if (adjustments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem">No adjustments yet</td></tr>';
                return;
            }

            tbody.innerHTML = adjustments.map(adj => `
                <tr>
                    <td><code>${adj.adjustment_number}</code></td>
                    <td>${adj.accounts?.account_number || '—'}</td>
                    <td>${adj.adjustment_type === 'decrease' ? '-' : '+'}${Utils.formatCurrency(adj.amount, adj.currency)}</td>
                    <td>${Utils.formatCurrency(adj.balance_before, adj.currency)} → ${Utils.formatCurrency(adj.balance_after, adj.currency)}</td>
                    <td>${adj.admin_users?.first_name || 'Admin'}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${adj.reason}">${adj.reason}</td>
                    <td>${Utils.formatDateTime(adj.created_at)}</td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('History load error:', error);
        }
    }
};