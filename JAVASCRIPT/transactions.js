const Transactions = {
    async getAllTransactions(accountId, params = {}) {
        try {
            const query = new URLSearchParams(params).toString();
            const response = await API.request(`/accounts/${accountId}/transactions?${query}`);
            return response.transactions || [];
        } catch (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }
    },

    formatTransaction(tx, accountId) {
        const isCredit = tx.credit_account_id === accountId;
        return {
            id: tx.id,
            type: tx.transaction_type,
            description: tx.description || tx.transaction_type,
            amount: tx.amount,
            currency: tx.currency,
            direction: isCredit ? 'credit' : 'debit',
            status: tx.status,
            date: tx.created_at,
            reference: tx.reference
        };
    },

    getStatusBadge(status) {
        const colors = {
            completed: 'success',
            pending: 'warning',
            failed: 'danger',
            reversed: 'secondary'
        };
        return `<span class="badge badge-${colors[status] || 'secondary'}">${status}</span>`;
    }
};