const Investments = {
    async init() {
        await this.loadPortfolio();
        await this.loadAssets();
    },

    async loadPortfolio() {
        try {
            const response = await API.getPortfolio();
            const portfolio = response.portfolio || response;

            document.getElementById('portfolioValue').textContent =
                Utils.formatCurrency(portfolio.current_value || 0);
            document.getElementById('portfolioGainLoss').textContent =
                Utils.formatCurrency(portfolio.total_gain_loss || 0);

            const gainEl = document.getElementById('portfolioGainLoss');
            if (gainEl) {
                gainEl.style.color = (portfolio.total_gain_loss || 0) >= 0 ? '#059669' : '#dc2626';
            }

            const holdings = portfolio.investment_holdings || [];
            const container = document.getElementById('investmentsContent');
            if (!container) return;

            container.innerHTML = holdings.length === 0
                ? '<div class="empty-state"><p>No investments yet. Buy your first asset below!</p></div>'
                : `
                    <div class="dashboard-card">
                        <h3>Your Holdings</h3>
                        <table class="data-table">
                            <thead><tr><th>Asset</th><th>Quantity</th><th>Avg Cost</th><th>Current Value</th><th>Gain/Loss</th></tr></thead>
                            <tbody>
                                ${holdings.map(h => `
                                    <tr>
                                        <td><strong>${h.investment_assets?.symbol}</strong><br><small>${h.investment_assets?.name}</small></td>
                                        <td>${h.quantity}</td>
                                        <td>${Utils.formatCurrency(h.avg_cost)}</td>
                                        <td>${Utils.formatCurrency(h.current_value)}</td>
                                        <td style="color:${h.unrealized_gain_loss >= 0 ? '#059669' : '#dc2626'}">
                                            ${h.unrealized_gain_loss >= 0 ? '+' : ''}${Utils.formatCurrency(h.unrealized_gain_loss)}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
        } catch (error) {
            console.error('Error loading portfolio:', error);
        }
    },

    async loadAssets() {
        try {
            const response = await API.getAssets();
            const assets = response.assets || [];

            const container = document.getElementById('investmentsContent');
            if (!container) return;

            const assetsHtml = `
                <div class="dashboard-card mt-2">
                    <h3>Available Assets</h3>
                    <table class="data-table">
                        <thead><tr><th>Symbol</th><th>Name</th><th>Type</th><th>Price</th><th>Action</th></tr></thead>
                        <tbody>
                            ${assets.map(a => `
                                <tr>
                                    <td><strong>${a.symbol}</strong></td>
                                    <td>${a.name}</td>
                                    <td><span class="badge badge-info">${a.asset_type}</span></td>
                                    <td>${Utils.formatCurrency(a.current_price)}</td>
                                    <td>
                                        <button class="btn btn-sm btn-success" onclick="Investments.showBuyModal('${a.id}', '${a.symbol}', ${a.current_price})">Buy</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            container.innerHTML += assetsHtml;
        } catch (error) {
            console.error('Error loading assets:', error);
        }
    },

    showBuyModal(assetId, symbol, price) {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Buy ${symbol}</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="buyForm">
                <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" id="buyQuantity" step="0.001" min="0.001" required
                           oninput="document.getElementById('buyTotal').textContent = Utils.formatCurrency(this.value * ${price})">
                </div>
                <div class="form-group">
                    <label>Total Cost: <span id="buyTotal">$0.00</span></label>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Buy</button>
            </form>
        `);

        document.getElementById('buyForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const accounts = await API.getAccounts();
                const accountId = accounts.accounts[0]?.id;

                await API.buyAsset({
                    asset_id: assetId,
                    quantity: parseFloat(document.getElementById('buyQuantity').value),
                    account_id: accountId
                });
                Utils.showToast('Purchase successful!', 'success');
                Utils.closeModal();
                await this.loadPortfolio();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    }
};