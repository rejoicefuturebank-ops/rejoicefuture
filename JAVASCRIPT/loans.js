const Loans = {
    async init() {
        await this.loadLoans();
        document.getElementById('applyLoanBtn')?.addEventListener('click', () => this.showApplyModal());
    },

    async loadLoans() {
        try {
            const response = await API.getLoans();
            const loans = response.loans || [];
            const container = document.getElementById('loansContent');
            if (!container) return;

            if (loans.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏠</div><p>No active loans</p></div>';
                return;
            }

            container.innerHTML = loans.map(loan => `
                <div class="dashboard-card mb-2">
                    <div class="flex-between">
                        <h4>${loan.loan_type} Loan</h4>
                        <span class="badge badge-${loan.status === 'active' ? 'info' : 'success'}">${loan.status}</span>
                    </div>
                    <div class="form-row mt-1">
                        <div><small class="text-muted">Outstanding</small><br><strong>${Utils.formatCurrency(loan.outstanding_balance)}</strong></div>
                        <div><small class="text-muted">Monthly Payment</small><br><strong>${Utils.formatCurrency(loan.monthly_payment)}</strong></div>
                        <div><small class="text-muted">Interest Rate</small><br><strong>${loan.interest_rate}%</strong></div>
                        <div><small class="text-muted">Term</small><br><strong>${loan.term_months} months</strong></div>
                    </div>
                    <button class="btn btn-primary btn-sm mt-2" onclick="Loans.makePayment('${loan.id}')">Make Payment</button>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading loans:', error);
        }
    },

    showApplyModal() {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Apply for Loan</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="loanApplyForm">
                <div class="form-group">
                    <label>Loan Type</label>
                    <select id="loanType">
                        <option value="personal">Personal Loan (8.5%)</option>
                        <option value="auto">Auto Loan (5.5%)</option>
                        <option value="business">Business Loan (7.0%)</option>
                        <option value="credit_line">Credit Line (12.0%)</option>
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Amount</label><input type="number" id="loanAmount" required></div>
                    <div class="form-group"><label>Term (months)</label><input type="number" id="loanTerm" value="12" min="6" max="60" required></div>
                </div>
                <div id="loanCalcResult" class="calculator-result" style="display:none">
                    <small>Estimated Monthly Payment</small>
                    <div class="amount" id="calcMonthly">$0.00</div>
                </div>
                <button type="button" class="btn btn-outline btn-block mb-1" onclick="Loans.calculate()">Calculate</button>
                <button type="submit" class="btn btn-primary btn-block">Apply Now</button>
            </form>
        `);

        document.getElementById('loanApplyForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await API.applyLoan({
                    loan_type: document.getElementById('loanType').value,
                    principal_amount: parseFloat(document.getElementById('loanAmount').value),
                    term_months: parseInt(document.getElementById('loanTerm').value)
                });
                Utils.showToast('Loan approved and created!', 'success');
                Utils.closeModal();
                await this.loadLoans();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    },

    async calculate() {
        try {
            const result = await API.calculateLoan({
                principal: parseFloat(document.getElementById('loanAmount').value),
                term_months: parseInt(document.getElementById('loanTerm').value)
            });
            document.getElementById('loanCalcResult').style.display = 'block';
            document.getElementById('calcMonthly').textContent = Utils.formatCurrency(result.monthly_payment);
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    },

    async makePayment(loanId) {
        const amount = prompt('Enter payment amount:');
        if (!amount) return;

        try {
            await API.payLoan(loanId, parseFloat(amount));
            Utils.showToast('Payment made!', 'success');
            await this.loadLoans();
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    }
};