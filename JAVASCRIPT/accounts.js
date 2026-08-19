const Accounts = {
    async init() {
        await this.renderAccountsPage();
    },

    async renderAccountsPage() {
        const container = document.getElementById('accountsContent');
        if (!container) return;

        try {
            const response = await API.getAccounts();
            const accounts = response.accounts || [];

            container.innerHTML = `
                <div class="dashboard-card mb-2">
                    <div class="flex-between mb-2">
                        <h3>My Accounts</h3>
                        <button class="btn btn-primary btn-sm" onclick="Accounts.showAddAccountModal()">+ New Currency Account</button>
                    </div>
                    <div class="accounts-list">
                        ${accounts.map(acc => `
                            <div class="account-item">
                                <div class="account-info">
                                    <div class="account-currency-icon">${acc.currency}</div>
                                    <div>
                                        <div class="account-name">${acc.account_type} Account</div>
                                        <div class="account-number">${acc.account_number}</div>
                                    </div>
                                </div>
                                <div style="text-align:right">
                                    <div class="account-balance">${Utils.formatCurrency(acc.account_balances?.available_balance || 0, acc.currency)}</div>
                                    <button class="btn btn-sm btn-outline" onclick="Accounts.showDepositModal('${acc.id}')">Deposit</button>
                                    <button class="btn btn-sm btn-outline" onclick="Accounts.showTransactions('${acc.id}')">History</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } catch (error) {
            container.innerHTML = `<div class="alert alert-error">Failed to load accounts: ${error.message}</div>`;
        }
    },

    showAddAccountModal() {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Add Currency Account</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="addAccountForm">
                <div class="form-group">
                    <label>Currency</label>
                    <select id="newCurrency" required>
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="CAD">CAD - Canadian Dollar</option>
                        <option value="AUD">AUD - Australian Dollar</option>
                        <option value="CHF">CHF - Swiss Franc</option>
                        <option value="JPY">JPY - Japanese Yen</option>
                        <option value="AED">AED - UAE Dirham</option>
                        <option value="NGN">NGN - Nigerian Naira</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Create Account</button>
            </form>
        `);

        document.getElementById('addAccountForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await API.createAccount({ currency: document.getElementById('newCurrency').value });
                Utils.showToast('Account created!', 'success');
                Utils.closeModal();
                this.renderAccountsPage();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    },

    showDepositModal(accountId) {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Deposit Funds</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="depositForm">
                <div class="form-group">
                    <label>Amount</label>
                    <input type="number" id="depositAmount" step="0.01" min="1" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <input type="text" id="depositDescription" placeholder="Optional">
                </div>
                <div class="alert alert-info">DEMO: Simulated deposit, no real money involved.</div>
                <button type="submit" class="btn btn-primary btn-block">Deposit</button>
            </form>
        `);

        document.getElementById('depositForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await API.deposit(accountId, {
                    amount: parseFloat(document.getElementById('depositAmount').value),
                    description: document.getElementById('depositDescription').value
                });
                Utils.showToast('Deposit successful!', 'success');
                Utils.closeModal();
                Dashboard.loadAccounts();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    },

    async showTransactions(accountId) {
        try {
            const response = await API.request(`/accounts/${accountId}/transactions?limit=20`);
            const transactions = response.transactions || [];

            Utils.showModal(`
                <div class="modal-header">
                    <h3>Transaction History</h3>
                    <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
                </div>
                <div style="max-height:400px;overflow-y:auto">
                    ${transactions.length === 0 ? '<p class="text-muted">No transactions yet</p>' : ''}
                    ${transactions.map(tx => `
                        <div class="transaction-item">
                            <div class="transaction-details">
                                <div class="transaction-name">${tx.description || tx.transaction_type}</div>
                                <div class="transaction-date">${Utils.formatDateTime(tx.created_at)}</div>
                            </div>
                            <div class="transaction-amount ${tx.credit_account_id === accountId ? 'credit' : 'debit'}">
                                ${tx.credit_account_id === accountId ? '+' : '-'}${Utils.formatCurrency(tx.amount, tx.currency)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `);
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    }
};