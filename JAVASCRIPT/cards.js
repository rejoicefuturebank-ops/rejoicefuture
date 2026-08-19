const Cards = {
    async init() {
        await this.loadCards();
        document.getElementById('createCardBtn')?.addEventListener('click', () => this.showCreateCardModal());
    },

    async loadCards() {
        try {
            const response = await API.getCards();
            const cards = response.cards || [];
            const grid = document.getElementById('cardsGrid');
            if (!grid) return;

            if (cards.length === 0) {
                grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💳</div><p>No cards yet. Create your first card!</p></div>';
                return;
            }

            grid.innerHTML = cards.map(card => `
                <div>
                    <div class="credit-card ${card.is_frozen ? 'frozen' : ''}">
                        <div class="card-brand">${card.card_brand?.toUpperCase() || 'VISA'}</div>
                        <div class="card-chip"></div>
                        <div class="card-number-display">**** **** **** ${card.card_last_four}</div>
                        <div class="card-footer">
                            <div><small>CARD HOLDER</small><br>${card.card_type}</div>
                            <div><small>EXPIRES</small><br>${String(card.expiry_month).padStart(2, '0')}/${card.expiry_year}</div>
                        </div>
                        ${card.is_frozen ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:24px">🧊 FROZEN</div>' : ''}
                    </div>
                    <div class="card-actions">
                        ${card.status === 'inactive' ? `<button class="btn btn-sm btn-success" onclick="Cards.activate('${card.id}')">Activate</button>` : ''}
                        ${card.is_frozen
                            ? `<button class="btn btn-sm btn-outline" onclick="Cards.unfreeze('${card.id}')">Unfreeze</button>`
                            : `<button class="btn btn-sm btn-warning" onclick="Cards.freeze('${card.id}')">Freeze</button>`
                        }
                        <button class="btn btn-sm btn-danger" onclick="Cards.cancel('${card.id}')">Cancel</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            Utils.showToast('Failed to load cards', 'error');
        }
    },

    showCreateCardModal() {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Create New Card</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="createCardForm">
                <div class="form-group">
                    <label>Card Type</label>
                    <select id="cardType">
                        <option value="debit">Debit Card</option>
                        <option value="credit">Credit Card</option>
                        <option value="virtual">Virtual Card</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Linked Account</label>
                    <select id="cardAccount"></select>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Create Card</button>
            </form>
        `);

        // Load accounts for dropdown
        API.getAccounts().then(response => {
            const accounts = response.accounts || [];
            document.getElementById('cardAccount').innerHTML = accounts.map(a =>
                `<option value="${a.id}">${a.currency} - ${a.account_number}</option>`
            ).join('');
        });

        document.getElementById('createCardForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const response = await API.createCard({
                    account_id: document.getElementById('cardAccount').value,
                    card_type: document.getElementById('cardType').value,
                    is_virtual: document.getElementById('cardType').value === 'virtual'
                });

                Utils.showModal(`
                    <div class="modal-header">
                        <h3>✅ Card Created!</h3>
                        <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
                    </div>
                    <div class="alert alert-warning">
                        <strong>⚠️ Save these details now!</strong> They won't be shown again.
                    </div>
                    <div class="receipt">
                        <div class="receipt-details">
                            <div class="receipt-row"><span class="label">Card Number:</span><span class="value">${response.card.full_number}</span></div>
                            <div class="receipt-row"><span class="label">CVV:</span><span class="value">${response.card.cvv}</span></div>
                            <div class="receipt-row"><span class="label">Expiry:</span><span class="value">${response.card.expiry}</span></div>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-block mt-2" onclick="Utils.closeModal(); Cards.loadCards()">Done</button>
                `);
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    },

    async activate(id) {
        try {
            await API.activateCard(id);
            Utils.showToast('Card activated!', 'success');
            await this.loadCards();
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    },

    async freeze(id) {
        try {
            await API.freezeCard(id);
            Utils.showToast('Card frozen', 'warning');
            await this.loadCards();
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    },

    async unfreeze(id) {
        try {
            await API.unfreezeCard(id);
            Utils.showToast('Card unfrozen', 'success');
            await this.loadCards();
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    },

    async cancel(id) {
        if (!confirm('Are you sure you want to cancel this card? This cannot be undone.')) return;
        try {
            await API.cancelCard(id);
            Utils.showToast('Card cancelled', 'success');
            await this.loadCards();
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    }
};