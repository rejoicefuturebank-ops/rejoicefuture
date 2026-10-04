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
                            <thead><tr><th>Asset</th><th>Quantity</th><th>Avg Cost</th><th>Current Value</th><th>Gain/Loss</th><th>Action</th></tr></thead>
                            <tbody>
                                ${holdings.map(h => `
                                    <tr>
                                        <td><strong>${h.investment_assets?.symbol}</strong><br><small>${h.investment_assets?.name}</small></td>
                                        <td>${parseFloat(h.quantity).toFixed(4)}</td>
                                        <td>${Utils.formatCurrency(h.avg_cost)}</td>
                                        <td>${Utils.formatCurrency(h.current_value)}</td>
                                        <td style="color:${h.unrealized_gain_loss >= 0 ? '#059669' : '#dc2626'}">
                                            ${h.unrealized_gain_loss >= 0 ? '+' : ''}${Utils.formatCurrency(h.unrealized_gain_loss)}
                                        </td>
                                        <td>
                                            <button class="btn btn-sm btn-outline" onclick="Investments.showSellModal('${h.asset_id}', '${h.investment_assets?.symbol}', ${h.quantity})">Sell</button>
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
                    <div class="flex-between">
                        <h3>Available Assets</h3>
                        <small class="text-muted">Prices from Alpaca (paper trading — live market data, simulated money)</small>
                    </div>
                    <table class="data-table">
                        <thead><tr><th>Symbol</th><th>Name</th><th>Type</th><th>Price</th><th>Action</th></tr></thead>
                        <tbody>
                            ${assets.map(a => `
                                <tr>
                                    <td><strong>${a.symbol}</strong></td>
                                    <td>${a.name}</td>
                                    <td><span class="badge badge-info">${a.asset_type}</span></td>
                                    <td>
                                        ${a.current_price != null ? Utils.formatCurrency(a.current_price) : 'Unavailable'}
                                        ${a.price_source === 'stale_fallback' ? ' <small class="text-muted">(delayed)</small>' : ''}
                                    </td>
                                    <td>
                                        <button class="btn btn-sm btn-success" onclick="Investments.showBuyModal('${a.id}', '${a.symbol}', ${a.current_price || 0})">Buy</button>
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

    // Buying is by dollar amount, not share count — Alpaca fills
    // fractional-share market orders by notional value, and that also
    // matches how most people think about investing ("put in $100").
    showBuyModal(assetId, symbol, price) {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Buy ${symbol}</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="buyForm">
                <div class="form-group">
                    <label>Amount to invest ($)</label>
                    <input type="number" id="buyAmount" step="1" min="1" required
                           oninput="document.getElementById('buyEstShares').textContent = ${price} > 0 ? (this.value / ${price}).toFixed(4) : '—'">
                </div>
                <div class="form-group">
                    <label>Estimated shares: <span id="buyEstShares">0</span></label>
                    <small class="text-muted">Actual fill price may differ slightly — this is a live market order.</small>
                </div>
                <div class="form-group">
                    <label>Funding account</label>
                    <select id="buyAccountId"></select>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Buy</button>
            </form>
        `);

        API.getAccounts().then(response => {
            const accounts = (response.accounts || []).filter(a => a.currency === 'USD');
            document.getElementById('buyAccountId').innerHTML = accounts.map(a =>
                `<option value="${a.id}">${a.currency} - ${a.account_number} (${Utils.formatCurrency(a.account_balances?.available_balance || 0)})</option>`
            ).join('') || '<option value="">No USD account available</option>';
        });

        document.getElementById('buyForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Placing order...';

            try {
                const response = await API.buyAsset({
                    asset_id: assetId,
                    amount: parseFloat(document.getElementById('buyAmount').value),
                    account_id: document.getElementById('buyAccountId').value
                });

                if (response.status && response.status !== 'filled') {
                    Utils.showToast(response.message, 'info');
                } else {
                    Utils.showToast(
                        `Bought ${response.filled_quantity?.toFixed(4)} shares of ${response.asset} at ${Utils.formatCurrency(response.filled_price)}`,
                        'success'
                    );
                }
                Utils.closeModal();
                await this.loadPortfolio();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Buy';
            }
        });
    },

    showSellModal(assetId, symbol, maxQuantity) {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Sell ${symbol}</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="sellForm">
                <div class="form-group">
                    <label>Quantity (you hold ${parseFloat(maxQuantity).toFixed(4)})</label>
                    <input type="number" id="sellQuantity" step="0.0001" min="0.0001" max="${maxQuantity}" required>
                </div>
                <div class="form-group">
                    <label>Account to receive proceeds</label>
                    <select id="sellAccountId"></select>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Sell</button>
            </form>
        `);

        API.getAccounts().then(response => {
            const accounts = (response.accounts || []).filter(a => a.currency === 'USD');
            document.getElementById('sellAccountId').innerHTML = accounts.map(a =>
                `<option value="${a.id}">${a.currency} - ${a.account_number}</option>`
            ).join('') || '<option value="">No USD account available</option>';
        });

        document.getElementById('sellForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Placing order...';

            try {
                const response = await API.sellAsset({
                    asset_id: assetId,
                    quantity: parseFloat(document.getElementById('sellQuantity').value),
                    account_id: document.getElementById('sellAccountId').value
                });

                if (response.status && response.status !== 'filled') {
                    Utils.showToast(response.message, 'info');
                } else {
                    const gainLossText = response.gainLoss >= 0 ? `+${Utils.formatCurrency(response.gainLoss)}` : Utils.formatCurrency(response.gainLoss);
                    Utils.showToast(`Sold at ${Utils.formatCurrency(response.filled_price)} (${gainLossText})`, 'success');
                }
                Utils.closeModal();
                await this.loadPortfolio();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Sell';
            }
        });
    }
};