const Transfers = {
    async init() {
        this.setupForm();
        await this.loadBeneficiaries();
        await this.loadHistory();
        await this.loadAccountOptions();
    },

    async loadAccountOptions() {
        try {
            const response = await API.getAccounts();
            const accounts = response.accounts || [];
            const select = document.getElementById('transferFromAccount');
            if (select) {
                select.innerHTML = accounts.map(acc =>
                    `<option value="${acc.id}">${acc.currency} - ${Utils.formatCurrency(acc.account_balances?.available_balance || 0, acc.currency)}</option>`
                ).join('');
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    },

    setupForm() {
        const transferType = document.getElementById('transferType');
        if (transferType) {
            transferType.addEventListener('change', (e) => {
                const value = e.target.value;
                document.getElementById('beneficiarySelect').style.display = value === 'beneficiary' ? 'block' : 'none';
                document.getElementById('externalTransferFields').style.display = value === 'external' ? 'block' : 'none';
            });
        }

        const form = document.getElementById('transferForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleTransfer(e));
        }

        document.getElementById('addBeneficiaryBtn')?.addEventListener('click', () => this.showAddBeneficiaryModal());

        document.getElementById('transferAmount')?.addEventListener('input', () => this.updateSummary());
    },

    updateSummary() {
        const amount = parseFloat(document.getElementById('transferAmount')?.value || 0);
        const summary = document.getElementById('transferSummary');
        if (summary && amount > 0) {
            summary.style.display = 'block';
            const fee = amount * 0.01; // 1% fee simulation
            document.getElementById('summaryAmount').textContent = Utils.formatCurrency(amount);
            document.getElementById('summaryFee').textContent = Utils.formatCurrency(fee);
            document.getElementById('summaryTotal').textContent = Utils.formatCurrency(amount + fee);
        } else if (summary) {
            summary.style.display = 'none';
        }
    },

    async handleTransfer(e) {
        e.preventDefault();

        const transferType = document.getElementById('transferType').value;
        const data = {
            from_account_id: document.getElementById('transferFromAccount').value,
            amount: parseFloat(document.getElementById('transferAmount').value),
            currency: document.getElementById('transferCurrency').value,
            description: document.getElementById('transferDescription').value
        };

        if (transferType === 'beneficiary') {
            data.beneficiary_id = document.getElementById('transferBeneficiary').value;
        } else if (transferType === 'external') {
            data.recipient_name = document.getElementById('recipientName').value;
            data.recipient_account_number = document.getElementById('recipientAccount').value;
            data.recipient_bank = document.getElementById('recipientBank').value;
            data.recipient_country = document.getElementById('recipientCountry').value;
        }

        try {
            const response = await API.createTransfer(data);

            if (response.otp_required) {
                this.showOTPModal(response.challenge_id, response.otp_code, data);
                return;
            }

            Utils.showToast('Transfer completed successfully!', 'success');
            this.showReceipt(response.receipt);
            form.reset();
            await this.loadHistory();
            Dashboard.loadAccounts();
        } catch (error) {
            if (error.message.includes('limit') || error.message.includes('Limit')) {
                this.showLimitExceededModal(error);
            } else {
                Utils.showToast(error.message, 'error');
            }
        }
    },

    showOTPModal(challengeId, otpCode, transferData) {
        Utils.showModal(`
            <div class="modal-header">
                <h3>🔐 OTP Verification Required</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="alert alert-info">
                DEMO MODE: Your OTP code is <strong style="font-size:20px">${otpCode}</strong>
                <br><small>In production, this would be sent via SMS/Email</small>
            </div>
            <form id="otpForm">
                <div class="form-group">
                    <label>Enter OTP Code</label>
                    <input type="text" id="otpInput" maxlength="6" pattern="[0-9]{6}" required
                           style="text-align:center;font-size:24px;letter-spacing:8px">
                </div>
                <button type="submit" class="btn btn-primary btn-block">Verify & Complete Transfer</button>
            </form>
        `);

        document.getElementById('otpForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const otp = document.getElementById('otpInput').value;

            try {
                transferData.otp_code = otp;
                transferData.challenge_id = challengeId;
                const response = await API.createTransfer(transferData);
                Utils.showToast('Transfer completed!', 'success');
                Utils.closeModal();
                this.showReceipt(response.receipt);
                await this.loadHistory();
                Dashboard.loadAccounts();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    },

    showLimitExceededModal(error) {
        Utils.showModal(`
            <div class="limit-exceeded-card">
                <div class="limit-exceeded-icon">⚠️</div>
                <h3>Transfer Limit Reached</h3>
                <p>${error.message}</p>
                <div class="limit-options">
                    <button class="btn btn-primary btn-block" onclick="Utils.closeModal(); Transfers.requestLimitIncrease()">
                        📈 Request Limit Increase
                    </button>
                    <button class="btn btn-outline btn-block" onclick="Utils.closeModal(); Dashboard.switchSection('support')">
                        💬 Contact Support
                    </button>
                    <button class="btn btn-outline btn-block" onclick="Utils.closeModal()">Cancel</button>
                </div>
            </div>
        `);
    },

    requestLimitIncrease() {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Request Limit Increase</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="limitRequestForm">
                <div class="form-group">
                    <label>Requested New Limit</label>
                    <input type="number" id="requestedLimit" required>
                </div>
                <div class="form-group">
                    <label>Reason</label>
                    <textarea id="limitReason" rows="3" required></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Submit Request</button>
            </form>
        `);

        document.getElementById('limitRequestForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await API.requestLimitIncrease({
                    limit_type: 'daily_transfer',
                    requested_limit: parseFloat(document.getElementById('requestedLimit').value),
                    reason: document.getElementById('limitReason').value
                });
                Utils.showToast('Request submitted! Check support for updates.', 'success');
                Utils.closeModal();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    },

    showReceipt(receipt) {
        Utils.showModal(`
            <div class="receipt">
                <div class="receipt-header">
                    <div class="receipt-icon">✅</div>
                    <h3>Transfer Successful</h3>
                </div>
                <div class="receipt-details">
                    <div class="receipt-row"><span class="label">Reference:</span><span class="value">${receipt.reference}</span></div>
                    <div class="receipt-row"><span class="label">Recipient:</span><span class="value">${receipt.recipient}</span></div>
                    <div class="receipt-row"><span class="label">Amount:</span><span class="value">${Utils.formatCurrency(receipt.amount, receipt.currency)}</span></div>
                    <div class="receipt-row"><span class="label">Fee:</span><span class="value">${Utils.formatCurrency(receipt.fee, receipt.currency)}</span></div>
                    <div class="receipt-row"><span class="label">Total:</span><span class="value">${Utils.formatCurrency(receipt.total, receipt.currency)}</span></div>
                    <div class="receipt-row"><span class="label">Date:</span><span class="value">${Utils.formatDateTime(receipt.date)}</span></div>
                </div>
            </div>
            <button class="btn btn-primary btn-block mt-2" onclick="Utils.closeModal()">Done</button>
        `);
    },

    async loadBeneficiaries() {
        try {
            const response = await API.getBeneficiaries();
            const beneficiaries = response.beneficiaries || [];
            const select = document.getElementById('transferBeneficiary');
            if (select) {
                select.innerHTML = '<option value="">Select Beneficiary</option>' +
                    beneficiaries.map(b => `<option value="${b.id}">${b.name} - ${b.bank_name}</option>`).join('');
            }
        } catch (error) {
            console.error('Error loading beneficiaries:', error);
        }
    },

    showAddBeneficiaryModal() {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Add Beneficiary</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="beneficiaryForm">
                <div class="form-group"><label>Full Name</label><input type="text" id="benName" required></div>
                <div class="form-group"><label>Account Number</label><input type="text" id="benAccount" required></div>
                <div class="form-group"><label>Bank Name</label><input type="text" id="benBank" required></div>
                <div class="form-group"><label>Country</label>
                    <select id="benCountry">
                        <option value="US">United States</option>
                        <option value="GB">United Kingdom</option>
                        <option value="DE">Germany</option>
                        <option value="NG">Nigeria</option>
                        <option value="AE">UAE</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Add Beneficiary</button>
            </form>
        `);

        document.getElementById('beneficiaryForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await API.addBeneficiary({
                    name: document.getElementById('benName').value,
                    account_number: document.getElementById('benAccount').value,
                    bank_name: document.getElementById('benBank').value,
                    country: document.getElementById('benCountry').value
                });
                Utils.showToast('Beneficiary added!', 'success');
                Utils.closeModal();
                await this.loadBeneficiaries();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    },

    async loadHistory() {
        try {
            const response = await API.getTransferHistory({ limit: 20 });
            const transfers = response.transfers || [];
            const tbody = document.getElementById('transferHistoryBody');
            if (!tbody) return;

            tbody.innerHTML = transfers.length === 0
                ? '<tr><td colspan="5" style="text-align:center">No transfers yet</td></tr>'
                : transfers.map(tx => `
                    <tr>
                        <td>${Utils.formatDate(tx.created_at)}</td>
                        <td><code>${tx.reference}</code></td>
                        <td>${tx.metadata?.recipient_name || tx.description || 'Transfer'}</td>
                        <td>${Utils.formatCurrency(tx.amount, tx.currency)}</td>
                        <td><span class="badge badge-${tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger'}">${tx.status}</span></td>
                    </tr>
                `).join('');
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }
};