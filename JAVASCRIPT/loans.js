const Loans = {
    async init() {
        await this.loadLoans();
        document.getElementById('applyLoanBtn')?.addEventListener('click', () => this.showComingSoonModal());
    },

    async loadLoans() {
        try {
            const response = await API.getLoans();
            const loans = response.loans || [];
            const container = document.getElementById('loansContent');
            if (!container) return;

            const comingSoonBanner = `
                <div class="alert alert-info mb-2">
                    Loan applications aren't available yet — we're working on real underwriting
                    and funding rather than instant approvals. This section will reopen once that's ready.
                </div>
            `;

            if (loans.length === 0) {
                container.innerHTML = comingSoonBanner + '<div class="empty-state"><div class="empty-state-icon">🏠</div><p>No active loans</p></div>';
                return;
            }

            container.innerHTML = comingSoonBanner + loans.map(loan => `
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

    showComingSoonModal() {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Loans — Coming Soon</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <p>We're building this out properly — real credit checks and a real funding source, instead of instant approval. Thanks for your patience.</p>
            <button class="btn btn-primary btn-block mt-2" onclick="Utils.closeModal()">Got it</button>
        `);
    },

    // Loan payoff calculator is still a legitimate, useful tool on its
    // own — it's just math, not a promise of approval — so it stays.
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