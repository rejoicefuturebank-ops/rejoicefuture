const Savings = {
    async init() {
        await this.loadSavings();
        document.getElementById('createSavingsBtn')?.addEventListener('click', () => this.showCreateModal());
    },

    async loadSavings() {
        try {
            const response = await API.getSavings();
            const accounts = response.accounts || [];
            const grid = document.getElementById('savingsGrid');
            if (!grid) return;

            if (accounts.length === 0) {
                grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏦</div><p>No savings accounts yet</p></div>';
                return;
            }

            grid.innerHTML = accounts.map(acc => {
                const progress = acc.target_amount ? (parseFloat(acc.balance) / parseFloat(acc.target_amount)) * 100 : 0;
                return `
                    <div class="savings-card">
                        <div class="flex-between">
                            <h4>${acc.name}</h4>
                            <span class="badge badge-info">${acc.savings_type}</span>
                        </div>
                        <div style="font-size:24px;font-weight:700;margin:1rem 0">
                            ${Utils.formatCurrency(acc.balance, acc.currency)}
                        </div>
                        ${acc.target_amount ? `
                            <div class="savings-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width:${Math.min(progress, 100)}%"></div>
                                </div>
                                <div class="progress-text">
                                    <span>${progress.toFixed(1)}% of goal</span>
                                    <span>Goal: ${Utils.formatCurrency(acc.target_amount, acc.currency)}</span>
                                </div>
                            </div>
                        ` : ''}
                        <div class="flex-between mt-1">
                            <small class="text-muted">Interest: ${acc.interest_rate}%</small>
                            <small class="text-success">+${Utils.formatCurrency(acc.interest_earned || 0, acc.currency)} earned</small>
                        </div>
                        <div class="flex gap-1 mt-2">
                            <button class="btn btn-sm btn-primary" onclick="Savings.showDepositModal('${acc.id}')">Deposit</button>
                            <button class="btn btn-sm btn-outline" onclick="Savings.showWithdrawModal('${acc.id}')">Withdraw</button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading savings:', error);
        }
    },

    showCreateModal() {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Create Savings Account</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="createSavingsForm">
                <div class="form-group"><label>Name</label><input type="text" id="savName" required placeholder="e.g., Vacation Fund"></div>
                <div class="form-group">
                    <label>Type</label>
                    <select id="savType">
                        <option value="flexible">Flexible (withdraw anytime)</option>
                        <option value="fixed">Fixed (locked until maturity)</option>
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Target Amount</label><input type="number" id="savTarget" step="0.01"></div>
                    <div class="form-group"><label>Currency</label>
                        <select id="savCurrency">
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                        </select>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Create</button>
            </form>
        `);

        document.getElementById('createSavingsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await API.createSavings({
                    name: document.getElementById('savName').value,
                    savings_type: document.getElementById('savType').value,
                    target_amount: parseFloat(document.getElementById('savTarget').value) || null,
                    currency: document.getElementById('savCurrency').value,
                    interest_rate: 2.5
                });
                Utils.showToast('Savings account created!', 'success');
                Utils.closeModal();
                await this.loadSavings();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    },

    showDepositModal(accountId) {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Deposit to Savings</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="savDepositForm">
                <div class="form-group"><label>Amount</label><input type="number" id="savDepositAmount" step="0.01" min="1" required></div>
                <button type="submit" class="btn btn-primary btn-block">Deposit</button>
            </form>
        `);

        document.getElementById('savDepositForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await API.depositSavings(accountId, parseFloat(document.getElementById('savDepositAmount').value));
                Utils.showToast('Deposit successful!', 'success');
                Utils.closeModal();
                await this.loadSavings();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    },

    showWithdrawModal(accountId) {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Withdraw from Savings</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="savWithdrawForm">
                <div class="form-group"><label>Amount</label><input type="number" id="savWithdrawAmount" step="0.01" min="1" required></div>
                <button type="submit" class="btn btn-primary btn-block">Withdraw</button>
            </form>
        `);

        document.getElementById('savWithdrawForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await API.request(`/savings/${accountId}/withdraw`, {
                    method: 'POST',
                    body: JSON.stringify({ amount: parseFloat(document.getElementById('savWithdrawAmount').value) })
                });
                Utils.showToast('Withdrawal successful!', 'success');
                Utils.closeModal();
                await this.loadSavings();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    }
};