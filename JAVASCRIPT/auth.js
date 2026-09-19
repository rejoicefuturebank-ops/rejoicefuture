// Auth Module
document.addEventListener("DOMContentLoaded", () => {
  // Login Form
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      const btn = document.getElementById("loginBtn");
      const errorDiv = document.getElementById("loginError");

      btn.disabled = true;
      btn.querySelector(".btn-text").textContent = "Signing in...";
      errorDiv.style.display = "none";

      try {
        const response = await API.login(email, password);

        if (response.token) {
          API.setToken(response.token);
          localStorage.setItem("user_data", JSON.stringify(response));

          // Server is authoritative on where we go next — never assume
          // a successful login means the account is fully set up.
          if (response.registration_status === "active") {
            Utils.showToast("Login successful!", "success");
            setTimeout(() => (window.location.href = "/dashboard.html"), 500);
          } else if (response.registration_status === "email_pending") {
            Utils.showToast("Let's verify your email to finish setting up your account.", "info");
            setTimeout(() => (window.location.href = "/register.html?stage=5"), 500);
          } else {
            // in_progress
            const remaining = 5 - (response.signup_stage || 2);
            Utils.showToast(`Let's finish setting up your account. You have ${remaining} step${remaining === 1 ? '' : 's'} remaining.`, "info");
            setTimeout(() => (window.location.href = `/register.html?stage=${response.signup_stage || 2}`), 500);
          }
        }
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = "block";
      } finally {
        btn.disabled = false;
        btn.querySelector(".btn-text").textContent = "Sign In";
      }
    });
  }

  // NOTE: the old single-page registration form has been replaced by the
  // 5-step wizard in register.html / register.js. This file no longer
  // handles a #registerForm submit — see Register in register.js.

  // Admin Login
  const adminLoginForm = document.getElementById("adminLoginForm");
  if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("adminEmail").value;
      const password = document.getElementById("adminPassword").value;
      const errorDiv = document.getElementById("adminLoginError");

      try {
        const response = await API.adminLogin(email, password);

        if (response.token) {
          API.setAdminToken(response.token);
          localStorage.setItem("admin_data", JSON.stringify(response));
          Utils.showToast("Admin login successful!", "success");

          document.getElementById("adminLoginView").style.display = "none";
          document.getElementById("adminDashboardView").style.display = "flex";

          if (typeof AdminApp !== "undefined") {
            AdminApp.init();
          }
        }
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = "block";
      }
    });
  }

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await API.logout();
      } catch (e) {}
      API.clearTokens();
      localStorage.clear();
      window.location.href = "/login.html";
    });
  }

  // Check auth on dashboard — registration-status enforcement itself
  // lives in Dashboard.checkAccountStatus() (dashboard.js), which already
  // calls /auth/me on init; no need to duplicate that call here.
  if (window.location.pathname.includes("dashboard.html")) {
    Utils.requireAuth();
  }
});