const AdminOTP = {
    async init() {
        const container = document.getElementById('otpAdminContent');
        if (!container) return;

        container.innerHTML = `
            <p class="text-muted">Select a user to configure their OTP settings</p>
            <div class="form-group">
                <input type="text" id="otpUserSearch" placeholder="Search user by email...">
                <button class="btn btn-sm btn-primary mt-1" onclick="AdminOTP.searchUser()">Search</button>
            </div>
            <div id="otpSettingsForm" style="display:none">
                <h4>OTP Settings for <span id="otpUserName"></span></h4>
                <form id="otpForm">
                    <div class="form-group">
                        <label><input type="checkbox" id="otpTransfers"> Require OTP for transfers</label>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="otpWithdrawals"> Require OTP for withdrawals</label>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="otpCards"> Require OTP for card actions</label>
                    </div>
                    <div class="form-group">
                        <label>Amount Threshold (require OTP above this amount)</label>
                        <input type="number" id="otpThreshold" value="500">
                    </div>
                    <button type="submit" class="btn btn-primary">Save OTP Settings</button>
                </form>
            </div>
        `;
    },

    async searchUser() {
        const query = document.getElementById('otpUserSearch').value;
        try {
            const response = await API.admin.searchUsers(query);
            const user = response.users?.[0];
            if (!user) {
                Utils.showToast('User not found', 'error');
                return;
            }

            this.currentUser = user;
            document.getElementById('otpSettingsForm').style.display = 'block';
            document.getElementById('otpUserName').textContent = user.email;

            const settings = await API.admin.getOTPSettings(user.id);
            document.getElementById('otpTransfers').checked = settings.otp_transfers_enabled || false;
            document.getElementById('otpWithdrawals').checked = settings.otp_withdrawals_enabled || false;
            document.getElementById('otpCards').checked = settings.otp_card_actions_enabled || false;
            document.getElementById('otpThreshold').value = settings.otp_amount_threshold || 500;
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    }
};

document.getElementById('otpForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await API.admin.updateOTPSettings(AdminOTP.currentUser.id, {
            otp_transfers_enabled: document.getElementById('otpTransfers').checked,
            otp_withdrawals_enabled: document.getElementById('otpWithdrawals').checked,
            otp_card_actions_enabled: document.getElementById('otpCards').checked,
            otp_amount_threshold: parseFloat(document.getElementById('otpThreshold').value)
        });
        Utils.showToast('OTP settings updated!', 'success');
    } catch (error) {
        Utils.showToast(error.message, 'error');
    }
});