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
          Utils.showToast("Login successful!", "success");
          setTimeout(() => (window.location.href = "/dashboard.html"), 500);
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

  // Register Form
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirm_password").value;
      const errorDiv = document.getElementById("registerError");

      if (password !== confirmPassword) {
        errorDiv.textContent = "Passwords do not match";
        errorDiv.style.display = "block";
        return;
      }

      const btn = document.getElementById("registerBtn");
      btn.disabled = true;
      btn.textContent = "Creating account...";
      errorDiv.style.display = "none";

    
      try {
        const data = {
          email: document.getElementById("email").value,
          password,
          first_name: document.getElementById("first_name").value,
          last_name: document.getElementById("last_name").value,
          phone: document.getElementById("phone").value,
          date_of_birth: document.getElementById("date_of_birth").value,
          country: document.getElementById("country").value,
        };

        const response = await API.register(data);

        if (response.token) {
          // Store token and user data
          API.setToken(response.token);
          localStorage.setItem("user_data", JSON.stringify(response));

          Utils.showToast(
            "Account created successfully! Redirecting...",
            "success",
          );

          // Redirect after a short delay to show the toast
          setTimeout(() => {
            window.location.href = "/dashboard.html";
          }, 1000);
        }
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Create Account";
      } finally {
        btn.disabled = false;
      }
    });

    // Password strength indicator
    const passwordInput = document.getElementById("password");
    const strengthDiv = document.getElementById("passwordStrength");
    if (passwordInput && strengthDiv) {
      passwordInput.addEventListener("input", () => {
        const val = passwordInput.value;
        let strength = 0;
        if (val.length >= 8) strength++;
        if (/[A-Z]/.test(val)) strength++;
        if (/[0-9]/.test(val)) strength++;
        if (/[^A-Za-z0-9]/.test(val)) strength++;

        strengthDiv.className = "password-strength";
        if (val.length === 0) {
          strengthDiv.style.background = "transparent";
        } else if (strength <= 1) {
          strengthDiv.classList.add("weak");
        } else if (strength <= 2) {
          strengthDiv.classList.add("medium");
        } else {
          strengthDiv.classList.add("strong");
        }
      });
    }
  }

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

  // Check auth on dashboard
  if (window.location.pathname.includes("dashboard.html")) {
    Utils.requireAuth();
  }
});
