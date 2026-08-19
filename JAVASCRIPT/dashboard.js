// ============================================
// PRODUCTION-READY DASHBOARD MODULE
// ============================================

const Dashboard = {
  data: {
    user: null,
    accounts: [],
    totalBalance: 0,
    notifications: [],
    exchangeRates: {},
    recentTransactions: [],
  },

  isLoading: false,

  // ============================================
  // INITIALIZATION
  // ============================================
  async init() {
    console.log("🏦 Dashboard initializing...");

    // Check authentication first
    if (!this.checkAuth()) {
      return;
    }

    // Show loading state
    this.showLoadingState();

    try {
      // Load all data in parallel for faster loading
      await this.checkAccountStatus();
      await Promise.allSettled([
        this.loadUserData(),
        this.loadAccounts(),
        this.loadExchangeRates(),
        this.loadNotifications(),
      ]);

      // Load transactions after accounts are loaded
      if (this.data.accounts.length > 0) {
        await this.loadRecentTransactions();
      }

      // Hide loading, show content
      this.hideLoadingState();

      // Setup event listeners
      this.setupEventListeners();

      // Check for impersonation mode
      this.checkImpersonation();

      console.log("✅ Dashboard loaded successfully");
    } catch (error) {
      console.error("❌ Dashboard initialization error:", error);
      this.showErrorState(error.message);
    }
  },

  checkAuth() {
    const token = localStorage.getItem("banking_token");
    if (!token) {
      console.warn("⚠️ No auth token found, redirecting to login");
      Utils.showToast("Session expired. Please login again.", "warning");
      setTimeout(() => {
        window.location.href = "/login.html";
      }, 1500);
      return false;
    }

    // Check if token is expired
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        console.warn("⚠️ Token expired");
        Utils.showToast("Session expired. Please login again.", "warning");
        localStorage.removeItem("banking_token");
        setTimeout(() => {
          window.location.href = "/login.html";
        }, 1500);
        return false;
      }
    } catch (e) {
      console.error("Token validation error:", e);
    }

    return true;
  },

  // ============================================
  // LOADING STATES
  // ============================================
  /*showLoadingState() {
    this.isLoading = true;
    const balanceCards = document.querySelector(".balance-cards");
    if (balanceCards) {
      balanceCards.innerHTML = `
                <div class="balance-card"><div class="skeleton" style="height:80px"></div></div>
                <div class="balance-card"><div class="skeleton" style="height:80px"></div></div>
                <div class="balance-card"><div class="skeleton" style="height:80px"></div></div>
                <div class="balance-card"><div class="skeleton" style="height:80px"></div></div>
            `;
    }
  }*/

  showLoadingState() {
    this.isLoading = true;

    // Instead of replacing everything, just add loading class
    const balanceCards = document.querySelector(".balance-cards");
    if (balanceCards) {
      balanceCards.classList.add("loading");
      // Add subtle loading indicator without destroying structure
      const cards = balanceCards.querySelectorAll(".balance-amount");
      cards.forEach((card) => {
        card.setAttribute("data-original", card.textContent);
        card.textContent = "Loading...";
        card.style.opacity = "0.5";
      });
    }
  },

  hideLoadingState() {
    this.isLoading = false;
  },

  showErrorState(message) {
    this.hideLoadingState();
    const container = document.getElementById("section-dashboard");
    if (container) {
      container.innerHTML = `
                <div class="empty-state" style="padding:4rem">
                    <div class="empty-state-icon">⚠️</div>
                    <h3>Something went wrong</h3>
                    <p class="text-muted">${message || "Failed to load dashboard data"}</p>
                    <button class="btn btn-primary mt-2" onclick="location.reload()">🔄 Retry</button>
                </div>
            `;
    }
  },

  // ============================================
  // DATA LOADING
  // ============================================
  async loadUserData() {
    try {
      // First try localStorage
      let userData = null;
      const storedData = localStorage.getItem("user_data");

      if (storedData) {
        userData = JSON.parse(storedData);
      }

      // If no stored data, fetch from API
      if (!userData || !userData.user) {
        console.log("📡 Fetching user data from API...");
        const response = await API.getCurrentUser();
        userData = response;
        localStorage.setItem("user_data", JSON.stringify(response));
      }

      this.data.user = userData.user || userData;
      const profile = userData.user?.profiles || userData.profiles || {};

      // Update UI with user info
      this.updateUserDisplay(profile);

      console.log("✅ User data loaded:", this.data.user.email);
    } catch (error) {
      console.error("Error loading user data:", error);
      // Don't throw - dashboard can still work without profile data
      this.updateUserDisplay({});
    }
  },

  async checkAccountStatus() {
    try {
      const response = await API.request("/auth/me");
      const user = response.user;
      const freezeInfo = response.freeze_info;

      // Store freeze info globally
      this.freezeInfo = freezeInfo;

      if (user.is_frozen) {
        this.showFrozenBanner(freezeInfo);
        this.disableFinancialActions();
      } else if (user.is_suspended) {
        this.showSuspendedBanner();
        this.disableAllActions();
      }
    } catch (error) {
      console.error("Status check error:", error);
    }
  },

  showFrozenBanner(freezeInfo) {
    // ✅ Remove any existing banner first
    const existingBanner = document.getElementById("frozenBanner");
    if (existingBanner) {
      existingBanner.remove();
    }

    const reason = freezeInfo?.reason || "No reason provided";
    const frozenDate = freezeInfo?.frozen_at
      ? new Date(freezeInfo.frozen_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Unknown date";

    const banner = document.createElement("div");
    banner.id = "frozenBanner";
    banner.className = "account-status-banner frozen";
    banner.innerHTML = `
        <div class="status-banner-content">
            <span class="status-icon">🧊</span>
            <div class="status-text">
                <strong>Account Frozen</strong>
                <p class="freeze-reason">Reason: ${this.escapeHtml(reason)}</p>
                <p class="freeze-meta">Frozen on: ${frozenDate} • Contact support to resolve</p>
            </div>
            <button class="btn btn-outline btn-sm" onclick="Dashboard.switchSection('support')">
                💬 Contact Support
            </button>
        </div>
    `;

    // ✅ INSERT ONLY INTO DASHBOARD SECTION (not globally)
    const dashboardSection = document.getElementById("section-dashboard");
    if (dashboardSection) {
      dashboardSection.insertBefore(banner, dashboardSection.firstChild);
    }
  },

  showSuspendedBanner() {
    const existingBanner = document.getElementById("suspendedBanner");
    if (existingBanner) {
      existingBanner.remove();
    }

    const banner = document.createElement("div");
    banner.id = "suspendedBanner";
    banner.className = "account-status-banner suspended";
    banner.innerHTML = `
        <div class="status-banner-content">
            <span class="status-icon">⛔</span>
            <div class="status-text">
                <strong>Account Suspended</strong>
                <p>Your account has been suspended due to policy violations. Please contact support for more information.</p>
            </div>
            <button class="btn btn-outline btn-sm" onclick="Dashboard.switchSection('support')">
                💬 Contact Support
            </button>
        </div>
    `;

    // ✅ INSERT ONLY INTO DASHBOARD SECTION
    const dashboardSection = document.getElementById("section-dashboard");
    if (dashboardSection) {
      dashboardSection.insertBefore(banner, dashboardSection.firstChild);
    }
  },

  // Helper to prevent XSS in reason text
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  disableFinancialActions() {
    // ✅ DISABLE: Deposit, Transfer, Withdraw, Exchange, Cards
    const blockedActions = [
      "deposit",
      "transfer",
      "withdraw",
      "exchange",
      "pay-bills",
      "cards",
    ];

    document.querySelectorAll(".quick-action-btn").forEach((btn) => {
      const action = btn.dataset.action;
      if (blockedActions.includes(action)) {
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
        btn.onclick = (e) => {
          e.preventDefault();
          Utils.showToast(
            "🧊 Account frozen. This action is not available. Please contact support.",
            "warning",
          );
        };
      }
    });

    // ✅ ALLOW: Viewing accounts, support, profile, notifications
    // These remain functional
  },

  updateUserDisplay(profile) {
    const fullName =
      profile.full_name ||
      `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
      this.data.user?.email ||
      "User";

    const firstName = profile.first_name || fullName.split(" ")[0] || "User";

    // Update greeting with null check
    const greetingEl = document.getElementById("greetingName");
    if (greetingEl) greetingEl.textContent = firstName;

    // Update top bar user info with null check
    const userNameEl = document.getElementById("userName");
    if (userNameEl) userNameEl.textContent = fullName;

    // Update avatar initials with null check
    const avatarEl = document.getElementById("userAvatar");
    if (avatarEl) {
      const initials = fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
      avatarEl.textContent = initials || "U";
    }
  },

  async loadAccounts() {
    try {
      console.log("📡 Loading accounts...");
      const response = await API.getAccounts();

      this.data.accounts = response.accounts || [];
      this.data.totalBalance = response.totalBalanceUSD || 0;

      // Update balance cards
      this.renderBalanceCards();
      this.renderAccountsList();

      console.log(`✅ Loaded ${this.data.accounts.length} accounts`);
    } catch (error) {
      console.error("Error loading accounts:", error);
      this.data.accounts = [];
      this.renderBalanceCards();
      this.renderAccountsList();
    }
  },

  renderBalanceCards() {
    const totalBalance = this.data.totalBalance || 0;
    const availableBalance = this.data.accounts.reduce(
      (sum, acc) =>
        sum + parseFloat(acc.account_balances?.available_balance || 0),
      0,
    );

    // Calculate savings and investments
    const savingsBalance = 0; // Will be updated when savings loads
    const investmentBalance = 0; // Will be updated when investments loads

    // Remove loading state
    const balanceCards = document.querySelector(".balance-cards");
    if (balanceCards) {
      balanceCards.classList.remove("loading");
    }

    // Rebuild balance cards with proper structure
    if (balanceCards) {
      balanceCards.innerHTML = `
            <div class="balance-card primary">
                <div class="balance-label">Total Balance (USD)</div>
                <div class="balance-amount" id="totalBalance">${Utils.formatCurrency(totalBalance)}</div>
                <div class="balance-change positive">+2.4% this month</div>
            </div>
            <div class="balance-card">
                <div class="balance-label">Available</div>
                <div class="balance-amount" id="availableBalance">${Utils.formatCurrency(availableBalance)}</div>
            </div>
            <div class="balance-card">
                <div class="balance-label">Savings</div>
                <div class="balance-amount" id="savingsBalance">${Utils.formatCurrency(savingsBalance)}</div>
            </div>
            <div class="balance-card">
                <div class="balance-label">Investments</div>
                <div class="balance-amount" id="investmentBalance">${Utils.formatCurrency(investmentBalance)}</div>
            </div>
        `;
    }
  },

  renderAccountsList() {
    const container = document.getElementById("accountsList");
    if (!container) return;

    if (this.data.accounts.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💰</div>
                    <p>No accounts yet</p>
                    <button class="btn btn-primary btn-sm mt-1" onclick="Dashboard.showAddAccountModal()">
                        + Create Your First Account
                    </button>
                </div>
            `;
      return;
    }

    container.innerHTML = this.data.accounts
      .map((acc) => {
        const balance = parseFloat(
          acc.account_balances?.available_balance || 0,
        );
        return `
                <div class="account-item" onclick="Dashboard.showAccountDetails('${acc.id}')">
                    <div class="account-info">
                        <div class="account-currency-icon">${acc.currency}</div>
                        <div>
                            <div class="account-name">${this.capitalizeFirst(acc.account_type)} Account</div>
                            <div class="account-number">${acc.account_number}</div>
                        </div>
                    </div>
                    <div class="account-balance">
                        ${Utils.formatCurrency(balance, acc.currency)}
                        <div class="account-currency">${acc.currency}</div>
                    </div>
                </div>
            `;
      })
      .join("");
  },

  async loadRecentTransactions() {
    try {
      const container = document.getElementById("recentTransactions");
      if (!container) return;

      if (this.data.accounts.length === 0) {
        container.innerHTML =
          '<div class="empty-state"><p>No transactions yet</p></div>';
        return;
      }

      const firstAccount = this.data.accounts[0];
      const response = await API.request(
        `/accounts/${firstAccount.id}/transactions?limit=5`,
      );
      const transactions = response.transactions || [];

      this.data.recentTransactions = transactions;

      if (transactions.length === 0) {
        container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📝</div>
                        <p>No transactions yet</p>
                        <p class="text-muted" style="font-size:12px">Make a deposit to get started</p>
                    </div>
                `;
        return;
      }

      container.innerHTML = transactions
        .map((tx) => {
          const isCredit = tx.credit_account_id === firstAccount.id;
          return `
                    <div class="transaction-item">
                        <div class="transaction-icon ${isCredit ? "credit" : "debit"}">
                            ${isCredit ? "⬇️" : "⬆️"}
                        </div>
                        <div class="transaction-details">
                            <div class="transaction-name">${tx.description || this.capitalizeFirst(tx.transaction_type)}</div>
                            <div class="transaction-date">${Utils.formatDateTime(tx.created_at)}</div>
                        </div>
                        <div class="transaction-amount ${isCredit ? "credit" : "debit"}">
                            ${isCredit ? "+" : "-"}${Utils.formatCurrency(tx.amount, tx.currency)}
                        </div>
                    </div>
                `;
        })
        .join("");
    } catch (error) {
      console.error("Error loading transactions:", error);
      const container = document.getElementById("recentTransactions");
      if (container) {
        container.innerHTML =
          '<div class="empty-state"><p>Unable to load transactions</p></div>';
      }
    }
  },

  async loadExchangeRates() {
    try {
      const response = await API.getExchangeRates();
      this.data.exchangeRates = response.rates || {};
      this.renderExchangeRates();
    } catch (error) {
      console.error("Error loading exchange rates:", error);
      this.renderExchangeRates();
    }
  },

  renderExchangeRates() {
    const container = document.getElementById("exchangeRates");
    if (!container) return;

    const rates = this.data.exchangeRates;
    const currencies = [
      "EUR",
      "GBP",
      "CAD",
      "AUD",
      "CHF",
      "JPY",
      "CNY",
      "AED",
      "NGN",
    ];

    container.innerHTML = currencies
      .map(
        (cur) => `
            <div class="rate-item">
                <span class="rate-currency">USD/${cur}</span>
                <span class="rate-value">${rates[cur] ? rates[cur].toFixed(4) : "—"}</span>
            </div>
        `,
      )
      .join("");
  },

  async loadNotifications() {
    try {
      const response = await API.getNotifications();
      this.data.notifications = response.notifications || [];
      const unreadCount = response.unreadCount || 0;

      const badge = document.getElementById("notifBadge");
      if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? "flex" : "none";
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  },

  // ============================================
  // EVENT LISTENERS
  // ============================================
  /*setupEventListeners() {
    // Navigation
    document.querySelectorAll(".sidebar-nav .nav-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        if (section) this.switchSection(section);
      });
    });

    // Quick actions
    document.querySelectorAll(".quick-action-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        this.handleQuickAction(action);
      });
    });

    // Notification toggle
    document
      .getElementById("notificationBtn")
      ?.addEventListener("click", () => {
        this.toggleNotificationPanel();
      });

    // Mark all notifications as read
    document.getElementById("markAllRead")?.addEventListener("click", () => {
      this.markAllNotificationsRead();
    });

    // Mobile menu toggle
    document.getElementById("menuToggle")?.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.toggle("open");
    });

    // Add account button
    document.getElementById("addAccountBtn")?.addEventListener("click", () => {
      this.showAddAccountModal();
    });

    // Close notification panel when clicking outside
    document.addEventListener("click", (e) => {
      const panel = document.getElementById("notificationPanel");
      const btn = document.getElementById("notificationBtn");
      if (
        panel &&
        panel.style.display === "flex" &&
        !panel.contains(e.target) &&
        !btn.contains(e.target)
      ) {
        panel.style.display = "none";
      }
    });
  },*/

  setupEventListeners() {
    // Navigation with auto-close on mobile
    document.querySelectorAll(".sidebar-nav .nav-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        if (section) {
          this.switchSection(section);
          // Auto-close sidebar on mobile after selection
          this.closeSidebarOnMobile();
        }
      });
    });

    // Quick actions
    document.querySelectorAll(".quick-action-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        this.handleQuickAction(action);
      });
    });

    // Notification toggle
    document
      .getElementById("notificationBtn")
      ?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleNotificationPanel();
      });

    // Mark all notifications as read
    document.getElementById("markAllRead")?.addEventListener("click", () => {
      this.markAllNotificationsRead();
    });

    // Mobile menu toggle (hamburger)
    document.getElementById("menuToggle")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleSidebar();
    });

    // Close button (X) - NEW!
    document.getElementById("sidebarClose")?.addEventListener("click", () => {
      this.closeSidebar();
    });

    // Overlay click to close sidebar - NEW!
    document.getElementById("sidebarOverlay")?.addEventListener("click", () => {
      this.closeSidebar();
    });

    // Add account button
    document.getElementById("addAccountBtn")?.addEventListener("click", () => {
      this.showAddAccountModal();
    });

    // Close notification panel when clicking outside
    document.addEventListener("click", (e) => {
      const panel = document.getElementById("notificationPanel");
      const btn = document.getElementById("notificationBtn");
      if (
        panel &&
        panel.style.display === "flex" &&
        !panel.contains(e.target) &&
        !btn.contains(e.target)
      ) {
        panel.style.display = "none";
      }
    });

    // Handle escape key to close sidebar
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeSidebar();
        Utils.closeModal();
      }
    });

    // Prevent body scroll when sidebar is open on mobile
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === "class") {
            if (
              sidebar.classList.contains("open") &&
              window.innerWidth <= 768
            ) {
              document.body.style.overflow = "hidden";
            } else {
              document.body.style.overflow = "";
            }
          }
        });
      });
      observer.observe(sidebar, { attributes: true });
    }
  },

  // ============================================
  // SIDEBAR CONTROL METHODS
  // ============================================

  toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");

    if (sidebar) {
      sidebar.classList.toggle("open");

      if (overlay) {
        overlay.classList.toggle("active");
      }
    }
  },

  closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");

    if (sidebar) {
      sidebar.classList.remove("open");
    }

    if (overlay) {
      overlay.classList.remove("active");
    }

    // Re-enable body scroll
    document.body.style.overflow = "";
  },

  closeSidebarOnMobile() {
    // Only auto-close on mobile/tablet
    if (window.innerWidth <= 1024) {
      // Small delay for smooth UX
      setTimeout(() => {
        this.closeSidebar();
      }, 150);
    }
  },

  openSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");

    if (sidebar) {
      sidebar.classList.add("open");
    }

    if (overlay) {
      overlay.classList.add("active");
    }
  },

  // ============================================
  // NAVIGATION
  // ============================================
  // ✅ Show/hide banner when switching sections
  switchSection(section) {
    // Update nav active state
    document
      .querySelectorAll(".sidebar-nav .nav-item")
      .forEach((n) => n.classList.remove("active"));
    const activeNav = document.querySelector(`[data-section="${section}"]`);
    if (activeNav) activeNav.classList.add("active");

    // Show/hide sections
    document
      .querySelectorAll(".content-section")
      .forEach((s) => s.classList.remove("active"));
    const targetSection = document.getElementById(`section-${section}`);
    if (targetSection) targetSection.classList.add("active");

    // ✅ HANDLE FROZEN BANNER VISIBILITY
    const frozenBanner = document.getElementById("frozenBanner");
    const suspendedBanner = document.getElementById("suspendedBanner");

    if (section === "dashboard") {
      // Show banner only on dashboard
      if (frozenBanner) frozenBanner.style.display = "flex";
      if (suspendedBanner) suspendedBanner.style.display = "flex";
    } else {
      // Hide banner on other sections
      if (frozenBanner) frozenBanner.style.display = "none";
      if (suspendedBanner) suspendedBanner.style.display = "none";
    }

    // Close mobile sidebar
    this.closeSidebarOnMobile();

    // Initialize section-specific modules
    this.initializeSection(section);
  },

  initializeSection(section) {
    switch (section) {
      case "accounts":
        if (typeof Accounts !== "undefined") Accounts.init();
        break;
      case "transfers":
        if (typeof Transfers !== "undefined") Transfers.init();
        break;
      case "cards":
        if (typeof Cards !== "undefined") Cards.init();
        break;
      case "savings":
        if (typeof Savings !== "undefined") Savings.init();
        break;
      case "investments":
        if (typeof Investments !== "undefined") Investments.init();
        break;
      case "loans":
        if (typeof Loans !== "undefined") Loans.init();
        break;
      case "support":
        if (typeof Support !== "undefined") Support.init();
        break;
      case "profile":
        if (typeof Profile !== "undefined") Profile.init();
        break;
    }
  },

  handleQuickAction(action) {
    switch (action) {
      case "deposit":
        this.showDepositModal();
        break;
      case "transfer":
        this.switchSection("transfers");
        break;
      case "withdraw":
        this.showWithdrawModal();
        break;
      case "exchange":
        this.showExchangeModal();
        break;
      case "pay-bills":
        Utils.showToast("Bill payments coming soon!", "info");
        break;
      case "cards":
        this.switchSection("cards");
        break;
    }
  },

  // ============================================
  // MODALS & ACTIONS
  // ============================================
  showDepositModal() {
    if (this.data.accounts.length === 0) {
      Utils.showToast("Please create an account first", "warning");
      this.showAddAccountModal();
      return;
    }

    const accountsOptions = this.data.accounts
      .map(
        (a) =>
          `<option value="${a.id}">${a.currency} - ${a.account_number} (Balance: ${Utils.formatCurrency(a.account_balances?.available_balance || 0, a.currency)})</option>`,
      )
      .join("");

    Utils.showModal(`
            <div class="modal-header">
                <h3>💰 Deposit Funds</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="depositForm">
                <div class="form-group">
                    <label>Account</label>
                    <select id="depositAccount">${accountsOptions}</select>
                </div>
                <div class="form-group">
                    <label>Amount</label>
                    <input type="number" id="depositAmount" step="0.01" min="1" required placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Description (Optional)</label>
                    <input type="text" id="depositDescription" placeholder="e.g., Salary, Gift, etc.">
                </div>
                <div class="alert alert-info">
                    <strong>🔒 DEMO MODE:</strong> This is a simulated deposit. No real money is transferred.
                </div>
                <button type="submit" class="btn btn-primary btn-block">Deposit</button>
            </form>
        `);

    document
      .getElementById("depositForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = "Processing...";

        try {
          await API.deposit(document.getElementById("depositAccount").value, {
            amount: parseFloat(document.getElementById("depositAmount").value),
            description:
              document.getElementById("depositDescription").value || "Deposit",
          });
          Utils.showToast("Deposit completed successfully! 🎉", "success");
          Utils.closeModal();
          await this.loadAccounts();
          await this.loadRecentTransactions();
        } catch (error) {
          Utils.showToast(error.message, "error");
          btn.disabled = false;
          btn.textContent = "Deposit";
        }
      });
  },

  showWithdrawModal() {
    if (this.data.accounts.length === 0) {
      Utils.showToast("No accounts available", "warning");
      return;
    }

    const accountsOptions = this.data.accounts
      .map(
        (a) =>
          `<option value="${a.id}">${a.currency} - Balance: ${Utils.formatCurrency(a.account_balances?.available_balance || 0, a.currency)}</option>`,
      )
      .join("");

    Utils.showModal(`
            <div class="modal-header">
                <h3>⬆️ Withdraw Funds</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="withdrawForm">
                <div class="form-group">
                    <label>From Account</label>
                    <select id="withdrawAccount">${accountsOptions}</select>
                </div>
                <div class="form-group">
                    <label>Amount</label>
                    <input type="number" id="withdrawAmount" step="0.01" min="1" required>
                </div>
                <div class="form-group">
                    <label>Destination</label>
                    <input type="text" id="withdrawDestination" required placeholder="Bank account or wallet address">
                </div>
                <button type="submit" class="btn btn-primary btn-block">Withdraw</button>
            </form>
        `);

    document
      .getElementById("withdrawForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          await API.withdraw({
            account_id: document.getElementById("withdrawAccount").value,
            amount: parseFloat(document.getElementById("withdrawAmount").value),
            destination: document.getElementById("withdrawDestination").value,
            currency: this.data.accounts[0]?.currency || "USD",
          });
          Utils.showToast("Withdrawal processed!", "success");
          Utils.closeModal();
          await this.loadAccounts();
        } catch (error) {
          Utils.showToast(error.message, "error");
        }
      });
  },

  showExchangeModal() {
    if (this.data.accounts.length < 2) {
      Utils.showToast(
        "You need at least 2 currency accounts to exchange",
        "warning",
      );
      this.showAddAccountModal();
      return;
    }

    Utils.showModal(`
            <div class="modal-header">
                <h3>🔄 Currency Exchange</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="exchangeForm">
                <div class="form-group">
                    <label>From Account</label>
                    <select id="fromAccount">
                        ${this.data.accounts.map((a) => `<option value="${a.id}">${a.currency} (${Utils.formatCurrency(a.account_balances?.available_balance || 0, a.currency)})</option>`).join("")}
                    </select>
                </div>
                <div class="conversion-arrow">⬇️</div>
                <div class="form-group">
                    <label>To Account</label>
                    <select id="toAccount">
                        ${this.data.accounts.map((a) => `<option value="${a.id}">${a.currency}</option>`).join("")}
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount</label>
                    <input type="number" id="exchangeAmount" step="0.01" min="1" required>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Convert</button>
            </form>
        `);

    document
      .getElementById("exchangeForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          const result = await API.convert({
            from_account_id: document.getElementById("fromAccount").value,
            to_account_id: document.getElementById("toAccount").value,
            amount: parseFloat(document.getElementById("exchangeAmount").value),
          });
          Utils.showToast(
            `Converted! New balance: ${Utils.formatCurrency(result.conversion.convertedAmount, result.conversion.targetCurrency)}`,
            "success",
          );
          Utils.closeModal();
          await this.loadAccounts();
        } catch (error) {
          Utils.showToast(error.message, "error");
        }
      });
  },

  showAddAccountModal() {
    Utils.showModal(`
            <div class="modal-header">
                <h3>➕ Add Currency Account</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="addAccountForm">
                <div class="form-group">
                    <label>Select Currency</label>
                    <select id="newCurrency" required>
                        <option value="">Choose a currency...</option>
                        <option value="USD">🇺🇸 USD - US Dollar</option>
                        <option value="EUR">🇪🇺 EUR - Euro</option>
                        <option value="GBP">🇬🇧 GBP - British Pound</option>
                        <option value="CAD">🇨🇦 CAD - Canadian Dollar</option>
                        <option value="AUD">🇦🇺 AUD - Australian Dollar</option>
                        <option value="CHF">🇨🇭 CHF - Swiss Franc</option>
                        <option value="JPY">🇯🇵 JPY - Japanese Yen</option>
                        <option value="CNY">🇨🇳 CNY - Chinese Yuan</option>
                        <option value="AED">🇦🇪 AED - UAE Dirham</option>
                        <option value="NGN">🇳🇬 NGN - Nigerian Naira</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Create Account</button>
            </form>
        `);

    document
      .getElementById("addAccountForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          await API.createAccount({
            currency: document.getElementById("newCurrency").value,
          });
          Utils.showToast("Account created successfully! 🎉", "success");
          Utils.closeModal();
          await this.loadAccounts();
        } catch (error) {
          Utils.showToast(error.message, "error");
        }
      });
  },

  showAccountDetails(accountId) {
    const account = this.data.accounts.find((a) => a.id === accountId);
    if (!account) return;

    Utils.showModal(`
            <div class="modal-header">
                <h3>Account Details</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="receipt">
                <div class="receipt-details">
                    <div class="receipt-row"><span class="label">Account Number:</span><span class="value">${account.account_number}</span></div>
                    <div class="receipt-row"><span class="label">Type:</span><span class="value">${this.capitalizeFirst(account.account_type)}</span></div>
                    <div class="receipt-row"><span class="label">Currency:</span><span class="value">${account.currency}</span></div>
                    <div class="receipt-row"><span class="label">Available Balance:</span><span class="value">${Utils.formatCurrency(account.account_balances?.available_balance || 0, account.currency)}</span></div>
                    <div class="receipt-row"><span class="label">Pending:</span><span class="value">${Utils.formatCurrency(account.account_balances?.pending_balance || 0, account.currency)}</span></div>
                </div>
            </div>
        `);
  },

  // ============================================
  // NOTIFICATIONS
  // ============================================
  toggleNotificationPanel() {
    const panel = document.getElementById("notificationPanel");
    if (!panel) return;

    if (panel.style.display === "none" || !panel.style.display) {
      panel.style.display = "flex";
      this.renderNotifications();
    } else {
      panel.style.display = "none";
    }
  },

  renderNotifications() {
    const list = document.getElementById("notificationList");
    if (!list) return;

    if (this.data.notifications.length === 0) {
      list.innerHTML =
        '<div class="empty-state"><p>No notifications yet</p></div>';
      return;
    }

    list.innerHTML = this.data.notifications
      .map(
        (n) => `
            <div class="notification-item ${n.is_read ? "" : "unread"}" onclick="Dashboard.readNotification('${n.id}')">
                <div class="notification-title">${n.title}</div>
                <div class="notification-message">${n.message}</div>
                <div class="notification-time">${Utils.formatDateTime(n.created_at)}</div>
            </div>
        `,
      )
      .join("");
  },

  async readNotification(id) {
    try {
      await API.markNotificationRead(id);
      await this.loadNotifications();
      this.renderNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  },

  async markAllNotificationsRead() {
    try {
      await API.markAllNotificationsRead();
      await this.loadNotifications();
      this.renderNotifications();
      Utils.showToast("All notifications marked as read", "success");
    } catch (error) {
      Utils.showToast(error.message, "error");
    }
  },

  // ============================================
  // IMPERSONATION CHECK
  // ============================================
  checkImpersonation() {
    const token = localStorage.getItem("banking_token");
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.impersonation) {
        const banner = document.getElementById("impersonationBanner");
        if (banner) {
          banner.style.display = "flex";
          document.getElementById("impersonatingAs").textContent =
            payload.user?.name || payload.email || "User";

          document
            .getElementById("exitTestMode")
            ?.addEventListener("click", () => {
              this.exitTestMode(payload.sessionId);
            });
        }
      }
    } catch (e) {
      console.error("Impersonation check error:", e);
    }
  },

  async exitTestMode(sessionId) {
    try {
      await API.admin.endImpersonation(sessionId);
      localStorage.removeItem("banking_token");
      localStorage.removeItem("impersonation_session");
      window.location.href = "/admin.html";
    } catch (error) {
      Utils.showToast("Error ending test mode", "error");
    }
  },

  // ============================================
  // UTILITY
  // ============================================
  capitalizeFirst(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
};

// ============================================
// INITIALIZE ON DOM READY
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("dashboard")) {
    Dashboard.init();
  }
});
