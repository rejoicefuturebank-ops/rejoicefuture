// Admin Limits Module
const AdminLimits = {
    currentUser: null,

    init() {
        this.setupForm();
    },

    setupForm() {
        document.getElementById('searchLimitsUser')?.addEventListener('click', async () => {
            const query = document.getElementById('limitUserSearch').value;
            if (!query) return;

            try {
                const response = await API.admin.searchUsers(query);
                const user = response.users?.[0];

                if (!user) {
                    Utils.showToast('User not found', 'error');
                    return;
                }

                this.currentUser = user;
                const userData = await API.admin.getUser(user.id);
                const limits = userData.limits;

                document.getElementById('limitsFormContainer').style.display = 'block';
                document.getElementById('limitsUserName').textContent = `${user.profiles?.full_name || user.email} - Limits`;

                if (limits) {
                    document.getElementById('limitSingleMax').value = limits.single_transfer_max || 50000;
                    document.getElementById('limitDailyTransfer').value = limits.daily_transfer_limit || 100000;
                    document.getElementById('limitDailyCount').value = limits.daily_transfer_count || 50;
                    document.getElementById('limitMonthlyTransfer').value = limits.monthly_transfer_limit || 2000000;
                    document.getElementById('limitWithdrawalMax').value = limits.single_withdrawal_max || 10000;
                    document.getElementById('limitDailyWithdrawal').value = limits.daily_withdrawal_limit || 20000;
                }
            } catch (error) {
                Utils.showToast('Search failed', 'error');
            }
        });

        document.getElementById('limitsForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!this.currentUser) {
                Utils.showToast('Please search for a user first', 'error');
                return;
            }

            const reason = document.getElementById('limitChangeReason').value;
            if (!reason) {
                Utils.showToast('Reason is required for audit', 'error');
                return;
            }

            try {
                await API.admin.updateUserLimits(this.currentUser.id, {
                    single_transfer_max: parseFloat(document.getElementById('limitSingleMax').value),
                    daily_transfer_limit: parseFloat(document.getElementById('limitDailyTransfer').value),
                    daily_transfer_count: parseInt(document.getElementById('limitDailyCount').value),
                    monthly_transfer_limit: parseFloat(document.getElementById('limitMonthlyTransfer').value),
                    single_withdrawal_max: parseFloat(document.getElementById('limitWithdrawalMax').value),
                    daily_withdrawal_limit: parseFloat(document.getElementById('limitDailyWithdrawal').value),
                    reason
                });

                Utils.showToast('Limits updated successfully!', 'success');
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    }
};