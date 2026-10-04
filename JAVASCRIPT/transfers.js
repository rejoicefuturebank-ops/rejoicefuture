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
            this._accounts = response.accounts || [];
            const select = document.getElementById('transferFromAccount');
            if (select) {
                select.innerHTML = this._accounts.map(acc =>
                    `<option value="${acc.id}" data-currency="${acc.currency}">${acc.currency} - ${Utils.formatCurrency(acc.account_balances?.available_balance || 0, acc.currency)}</option>`
                ).join('');
                this.updateCurrencyDisplay();
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
                document.getElementById('internalTransferFields').style.display = value === 'internal' ? 'block' : 'none';
                document.getElementById('externalTransferFields').style.display = value === 'external' ? 'block' : 'none';
            });
        }

        const form = document.getElementById('transferForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleTransfer(e));
        }

        const fromAccountSelect = document.getElementById('transferFromAccount');
        if (fromAccountSelect) {
            fromAccountSelect.addEventListener('change', () => this.updateCurrencyDisplay());
        }

        document.getElementById('addBeneficiaryBtn')?.addEventListener('click', () => this.showAddBeneficiaryModal());
        document.getElementById('transferAmount')?.addEventListener('input', () => this.updateSummary());
    },

    updateCurrencyDisplay() {
        const select = document.getElementById('transferFromAccount');
        const display = document.getElementById('transferCurrencyDisplay');
        if (!select || !display) return;
        const currency = select.options[select.selectedIndex]?.dataset.currency;
        display.textContent = currency || 'Select a source account';
    },

    updateSummary() {
        const amount = parseFloat(document.getElementById('transferAmount')?.value || 0);
        const transferType = document.getElementById('transferType')?.value;
        const summary = document.getElementById('transferSummary');
        if (summary && amount > 0) {
            summary.style.display = 'block';
            // Internal (app-to-app) transfers are free. External payouts
            // carry the same fee the backend calculates: max($5, 1%).
            const fee = transferType === 'external' ? Math.max(5, amount * 0.01) : 0;
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
        const fromAccountId = document.getElementById('transferFromAccount').value;
        const fromSelect = document.getElementById('transferFromAccount');
        const currency = fromSelect.options[fromSelect.selectedIndex]?.dataset.currency;

        const baseData = {
            from_account_id: fromAccountId,
            amount: parseFloat(document.getElementById('transferAmount').value),
            currency,
            description: document.getElementById('transferDescription').value
        };

        const recipientIdentifier = document.getElementById('internalRecipient')?.value;
        const beneficiaryId = document.getElementById('transferBeneficiary')?.value;

        try {
            let response;
            if (transferType === 'internal') {
                response = await API.sendInternalTransfer({ ...baseData, recipient_identifier: recipientIdentifier });
            } else {
                response = await API.sendExternalTransfer({ ...baseData, beneficiary_id: beneficiaryId });
            }

            Utils.showToast(response.message || 'Transfer completed successfully!', 'success');
            this.showReceipt(response.receipt);
            document.getElementById('transferForm').reset();
            await this.loadHistory();
            Dashboard.loadAccounts();
        } catch (error) {
            if (error.otp_required || (error.message && error.message.toLowerCase().includes('verification code'))) {
                this.showOTPModal(transferType, baseData, recipientIdentifier, beneficiaryId, error.challenge_id);
                return;
            }
            if (error.message && error.message.toLowerCase().includes('limit')) {
                this.showLimitExceededModal(error);
            } else {
                Utils.showToast(error.message, 'error');
            }
        }
    },

    // The backend returns 402 with a challenge_id when a code is needed
    // and emails the actual code — we never see or display it ourselves.
    showOTPModal(transferType, baseData, recipientIdentifier, beneficiaryId, challengeId) {
        Utils.showModal(`
            <div class="modal-header">
                <h3>🔐 Verification Required</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="alert alert-info">
                We've emailed a 6-digit verification code to your registered email address. It expires in 10 minutes.
            </div>
            <form id="otpForm">
                <div class="form-group">
                    <label>Enter verification code</label>
                    <input type="text" id="otpInput" maxlength="6" pattern="[0-9]{6}" required
                           style="text-align:center;font-size:24px;letter-spacing:8px">
                </div>
                <button type="submit" class="btn btn-primary btn-block">Verify & Complete Transfer</button>
            </form>
        `);

        document.getElementById('otpForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const otp_code = document.getElementById('otpInput').value;
            const payload = { ...baseData, otp_code, challenge_id: challengeId };

            try {
                const response = transferType === 'internal'
                    ? await API.sendInternalTransfer({ ...payload, recipient_identifier: recipientIdentifier })
                    : await API.sendExternalTransfer({ ...payload, beneficiary_id: beneficiaryId });

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
        if (!receipt) return;
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
                    ${receipt.status ? `<div class="receipt-row"><span class="label">Status:</span><span class="value">${receipt.status}</span></div>` : ''}
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
                    beneficiaries.map(b => `<option value="${b.id}">${b.name} - ${b.bank_name}${b.bank_code ? '' : ' (missing bank code — edit before sending)'}</option>`).join('');
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
                <div class="form-group">
                    <label>Country</label>
                    <select id="benCountry" required>
                        <option value="NG">Nigeria</option>
                        <option value="GH">Ghana</option>
                        <option value="KE">Kenya</option>
                        <option value="ZA">South Africa</option>
                        <option value="UG">Uganda</option>
                        <option value="TZ">Tanzania</option>
                    </select>
                    <small class="text-muted">External payouts are currently only supported to these countries.</small>
                </div>
                <div class="form-group">
                    <label>Bank</label>
                    <select id="benBankCode" required><option value="">Loading banks...</option></select>
                </div>
                <div class="form-group"><label>Account Number</label><input type="text" id="benAccount" required></div>
                <button type="submit" class="btn btn-primary btn-block">Add Beneficiary</button>
            </form>
        `);

        const loadBanks = async () => {
            const country = document.getElementById('benCountry').value;
            const bankSelect = document.getElementById('benBankCode');
            bankSelect.innerHTML = '<option value="">Loading banks...</option>';
            try {
                const response = await API.getBanks(country);
                const banks = response.banks || [];
                bankSelect.innerHTML = '<option value="">Select bank</option>' +
                    banks.map(b => `<option value="${b.code}" data-name="${b.name}">${b.name}</option>`).join('');
            } catch (error) {
                bankSelect.innerHTML = '<option value="">Could not load banks — try again</option>';
            }
        };
        document.getElementById('benCountry').addEventListener('change', loadBanks);
        loadBanks();

        document.getElementById('beneficiaryForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const bankSelect = document.getElementById('benBankCode');
                const bankName = bankSelect.options[bankSelect.selectedIndex]?.dataset.name || '';

                await API.addBeneficiary({
                    name: document.getElementById('benName').value,
                    account_number: document.getElementById('benAccount').value,
                    bank_name: bankName,
                    bank_code: bankSelect.value,
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
                        <td>${tx.metadata?.recipient_name || tx.metadata?.recipient_identifier || tx.description || 'Transfer'}</td>
                        <td>${Utils.formatCurrency(tx.amount, tx.currency)}</td>
                        <td><span class="badge badge-${tx.status === 'completed' ? 'success' : tx.status === 'processing' || tx.status === 'pending' ? 'warning' : 'danger'}">${tx.status}</span></td>
                    </tr>
                `).join('');
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }
};