// ============================================
// ADMIN USERS MODULE
// ============================================

const AdminUsers = {
  users: [],

  init() {
    console.log("👥 Admin Users initializing");
    this.setupSearch();
    this.loadUsers();
  },

  setupSearch() {
    const searchBtn = document.getElementById("searchUsersBtn");
    const searchInput = document.getElementById("userSearchInput");

    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        this.loadUsers(searchInput.value);
      });
    }

    if (searchInput) {
      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.loadUsers(e.target.value);
        }
      });
    }
  },

  async loadUsers(query = "") {
    try {
      const response = await API.admin.searchUsers(query);
      this.users = response.users || [];
      this.renderUsers();
    } catch (error) {
      Utils.showToast("Failed to load users", "error");
      console.error("Load users error:", error);
    }
  },

  renderUsers() {
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;

    if (this.users.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:2rem">No users found</td></tr>';
      return;
    }

    tbody.innerHTML = this.users
      .map((user) => {
        const accounts = user.accounts || [];
        const totalBalance = accounts.reduce(
          (sum, a) =>
            sum + parseFloat(a.account_balances?.available_balance || 0),
          0,
        );

        let status = "active";
        let statusClass = "success";
        if (user.is_suspended) {
          status = "suspended";
          statusClass = "danger";
        } else if (user.is_frozen) {
          status = "frozen";
          statusClass = "warning";
        }

        return `
                <tr>
                    <td>
                        <strong>${user.profiles?.full_name || "No name"}</strong>
                        <div style="font-size:11px;color:#64748b">${user.id?.slice(0, 8)}...</div>
                    </td>
                    <td>${user.email}</td>
                    <td>${accounts.length} accounts<br><small>${Utils.formatCurrency(totalBalance)}</small></td>
                    <td><span class="badge badge-${statusClass}">${status}</span></td>
                    <td>${user.last_login ? Utils.formatDateTime(user.last_login) : "Never"}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-outline" onclick="AdminUsers.viewUser('${user.id}')">View</button>
                            <button class="btn btn-sm btn-warning" onclick="AdminUsers.freezeUser('${user.id}')">Freeze</button>
                            <button class="btn btn-sm btn-danger" onclick="AdminUsers.suspendUser('${user.id}')">Suspend</button>
                        </div>
                    </td>
                </tr>
            `;
      })
      .join("");
  },

  async viewUser(userId) {
    try {
      const data = await API.admin.getUser(userId);
      const user = data.user;
      const accounts = data.accounts || [];
      const limits = data.limits || {};

      Utils.showModal(`
                <div class="modal-header">
                    <h3>👤 ${user.profiles?.full_name || user.email}</h3>
                    <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
                </div>
                <div class="user-detail-grid">
                    <div class="user-info-card">
                        <h4>Account Info</h4>
                        <p><strong>Email:</strong> ${user.email}</p>
                        <p><strong>Phone:</strong> ${user.phone || "Not set"}</p>
                        <p><strong>Status:</strong> ${user.is_suspended ? "🔴 Suspended" : user.is_frozen ? "🟡 Frozen" : "🟢 Active"}</p>
                        <p><strong>Created:</strong> ${Utils.formatDate(user.created_at)}</p>
                        <p><strong>Last Login:</strong> ${user.last_login ? Utils.formatDateTime(user.last_login) : "Never"}</p>
                    </div>
                    <div class="user-info-card">
                        <h4>Accounts (${accounts.length})</h4>
                        ${
                          accounts
                            .map(
                              (a) => `
                            <div style="margin-bottom:8px;padding:8px;background:#1e293b;border-radius:4px">
                                <strong>${a.currency}</strong> - ${a.account_number}<br>
                                <small>Balance: ${Utils.formatCurrency(a.account_balances?.available_balance || 0, a.currency)}</small>
                            </div>
                        `,
                            )
                            .join("") || "<p>No accounts</p>"
                        }
                    </div>
                    <div class="user-info-card">
                        <h4>Transfer Limits</h4>
                        <p><strong>Daily:</strong> ${Utils.formatCurrency(limits.daily_transfer_limit || 0)}</p>
                        <p><strong>Single Max:</strong> ${Utils.formatCurrency(limits.single_transfer_max || 0)}</p>
                        <p><strong>Monthly:</strong> ${Utils.formatCurrency(limits.monthly_transfer_limit || 0)}</p>
                    </div>
                    <div class="user-info-card">
                        <h4>Recent Logins</h4>
                        ${
                          (data.loginHistory || [])
                            .slice(0, 3)
                            .map(
                              (l) => `
                            <div style="font-size:11px;margin-bottom:4px">
                                ${l.is_successful ? "✅" : "❌"} ${Utils.formatDateTime(l.created_at)}<br>
                                <small>${l.ip_address || "Unknown IP"}</small>
                            </div>
                        `,
                            )
                            .join("") || "<p>No login history</p>"
                        }
                    </div>
                </div>
                <div class="action-buttons" style="margin-top:1rem">
                    <button class="btn btn-outline" onclick="AdminUsers.impersonateUser('${userId}')">🎭 Test Mode</button>
                    <button class="btn btn-warning" onclick="AdminUsers.freezeUser('${userId}')">🧊 Freeze</button>
                    <button class="btn btn-success" onclick="AdminUsers.unfreezeUser('${userId}')">✅ Unfreeze</button>
                    <button class="btn btn-danger" onclick="AdminUsers.suspendUser('${userId}')">⛔ Suspend</button>
                </div>
            `);
    } catch (error) {
      Utils.showToast("Failed to load user details", "error");
    }
  },

  async freezeUser(userId) {
    const reason = prompt("Reason for freezing this account:");
    if (!reason) return;

    try {
      const response = await API.admin.freezeUser(userId, reason);
      Utils.showToast("✅ Account frozen successfully", "success");

      // Close modal if open
      Utils.closeModal();

      // ✅ REFRESH THE USER LIST
      await this.loadUsers();

      // Show confirmation
      setTimeout(() => {
        Utils.showToast(
          `User account has been frozen. Reference: ${response.reference || "N/A"}`,
          "info",
        );
      }, 2000);
    } catch (error) {
      Utils.showToast(`Failed to freeze: ${error.message}`, "error");
    }
  },

  async unfreezeUser(userId) {
    const reason = prompt("Reason for unfreezing:");
    if (!reason) return;

    try {
      await API.admin.unfreezeUser(userId, reason);
      Utils.showToast("Account unfrozen", "success");
      this.loadUsers();
    } catch (error) {
      Utils.showToast(error.message, "error");
    }
  },

  async suspendUser(userId) {
    const reason = prompt("Reason for suspending this account:");
    if (!reason) return;

    if (!confirm("Are you sure? This will block all user access.")) return;

    try {
      await API.admin.suspendUser(userId, reason);
      Utils.showToast("Account suspended", "success");
      this.loadUsers();
    } catch (error) {
      Utils.showToast(error.message, "error");
    }
  },

  async impersonateUser(userId) {
    const reason = prompt(
      "Enter reason for entering test mode (required for audit):",
    );
    if (!reason) return;

    if (
      !confirm(
        "You will view the app as this user. All actions are audited. Continue?",
      )
    )
      return;

    try {
      const response = await API.admin.startImpersonation(userId, reason);
      localStorage.setItem("banking_token", response.token);
      localStorage.setItem("impersonation_session", response.sessionId);
      window.location.href = "/dashboard.html";
    } catch (error) {
      Utils.showToast(error.message, "error");
    }
  },
};
