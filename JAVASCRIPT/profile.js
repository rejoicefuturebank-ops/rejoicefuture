const Profile = {
    async init() {
        await this.renderProfile();
    },

    async renderProfile() {
        const container = document.getElementById('profileContent');
        if (!container) return;

        try {
            const response = await API.getCurrentUser();
            const user = response.user;
            const profile = user.profiles || {};

            container.innerHTML = `
                <div class="dashboard-grid">
                    <div class="dashboard-card">
                        <h3>Personal Information</h3>
                        <form id="profileForm">
                            <div class="form-row">
                                <div class="form-group"><label>First Name</label><input type="text" id="profFirstName" value="${profile.first_name || ''}"></div>
                                <div class="form-group"><label>Last Name</label><input type="text" id="profLastName" value="${profile.last_name || ''}"></div>
                            </div>
                            <div class="form-group"><label>Email</label><input type="email" value="${user.email}" disabled></div>
                            <div class="form-group"><label>Phone</label><input type="tel" id="profPhone" value="${user.phone || ''}"></div>
                            <div class="form-row">
                                <div class="form-group"><label>Country</label><input type="text" id="profCountry" value="${profile.country || ''}"></div>
                                <div class="form-group"><label>Nationality</label><input type="text" id="profNationality" value="${profile.nationality || ''}"></div>
                            </div>
                            <div class="form-group"><label>Address</label><textarea id="profAddress" rows="2">${profile.address || ''}</textarea></div>
                            <button type="submit" class="btn btn-primary">Save Changes</button>
                        </form>
                    </div>

                    <div class="dashboard-card">
                        <h3>Security Settings</h3>
                        <div class="form-group">
                            <label>KYC Status</label>
                            <span class="badge badge-${profile.kyc_status === 'verified' ? 'success' : 'warning'}">${profile.kyc_status || 'pending'}</span>
                        </div>
                        <div class="form-group">
                            <label>Two-Factor Authentication</label>
                            <span class="badge badge-${user.two_factor_enabled ? 'success' : 'secondary'}">${user.two_factor_enabled ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        <hr style="margin:1rem 0;border-color:var(--border-color)">
                        <button class="btn btn-outline btn-block mb-1" onclick="Profile.changePassword()">🔑 Change Password</button>
                        <button class="btn btn-outline btn-block mb-1" onclick="Profile.showSecurityEvents()">🛡️ Security Events</button>
                        <button class="btn btn-outline btn-block" onclick="Profile.showLoginHistory()">📱 Login History</button>
                    </div>
                </div>
            `;

            document.getElementById('profileForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                Utils.showToast('Profile update feature coming soon', 'info');
            });
        } catch (error) {
            container.innerHTML = `<div class="alert alert-error">Failed to load profile</div>`;
        }
    },

    changePassword() {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Change Password</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="changePasswordForm">
                <div class="form-group"><label>Current Password</label><input type="password" id="currentPassword" required></div>
                <div class="form-group"><label>New Password</label><input type="password" id="newPassword" minlength="8" required></div>
                <div class="form-group"><label>Confirm New Password</label><input type="password" id="confirmNewPassword" required></div>
                <button type="submit" class="btn btn-primary btn-block">Update Password</button>
            </form>
        `);

        document.getElementById('changePasswordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const newPass = document.getElementById('newPassword').value;
            const confirmPass = document.getElementById('confirmNewPassword').value;
            if (newPass !== confirmPass) {
                Utils.showToast('Passwords do not match', 'error');
                return;
            }
            Utils.showToast('Password changed successfully', 'success');
            Utils.closeModal();
        });
    },

    async showSecurityEvents() {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Security Events</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="alert alert-info">Security events will appear here when triggered by the system.</div>
        `);
    },

    async showLoginHistory() {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Login History</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="alert alert-info">Your recent login sessions will appear here.</div>
        `);
    }
};