
// Safe Global Fetch Interceptor for Production
(function () {
  if (window.__fetchInterceptorAttached) return;
  const originalFetch = window.fetch;
  window.fetch = function (resource, config) {
    if (typeof resource === 'string' && resource.startsWith('/api/') && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      resource = 'https://hrmsapi.seawindsolution.com' + resource;
    }
    return originalFetch(resource, config);
  };
  window.__fetchInterceptorAttached = true;
})();
// Optimized Portal Core Functions
const PortalCore = {
  currentUser: null,

  // Initialize
  init() {
    this.currentUser = JSON.parse(localStorage.getItem("hrms_user") || "{}");
    if (!this.currentUser || !this.currentUser.user_id) {
      window.location.href = "index.html";
      return;
    }
    this.setupUI();
    this.loadDashboard();
    if (typeof window.loadDashboardData === "function") {
      window.loadDashboardData();
    }
  },

  // Setup UI
  setupUI() {
    document.getElementById("userName").textContent =
      this.currentUser.full_name;
    document.getElementById("userRole").textContent =
      this.currentUser.role.charAt(0).toUpperCase() +
      this.currentUser.role.slice(1);
    document.getElementById("userAvatar").textContent =
      this.currentUser.full_name.charAt(0).toUpperCase();
    document.getElementById("dashboardUserName").textContent =
      this.currentUser.full_name;

    // Show role-specific sections
    const isAdmin = this.currentUser.role === "admin";
    const isHR = this.currentUser.role === "hr";
    const isManager = this.currentUser.role === "manager";

    // Hide leave balance card for admin users (they don't apply for leave)
    if (isAdmin) {
      const leaveBalanceCard = document.getElementById("leaveBalanceCard");
      if (leaveBalanceCard) leaveBalanceCard.style.display = "none";
    }

    // Setup Performance Management sections based on role
    if (isAdmin || isHR) {
      const hrPerfSection = document.getElementById("hr-performance-section");
      if (hrPerfSection) hrPerfSection.style.display = "block";
    } else if (isManager) {
      const managerPerfSection = document.getElementById(
        "manager-performance-section",
      );
      if (managerPerfSection) managerPerfSection.style.display = "block";
    } else {
      // Employee
      const employeePerfSection = document.getElementById(
        "employee-performance-section",
      );
      if (employeePerfSection) employeePerfSection.style.display = "block";
    }

    if (isAdmin || isHR) {
      document.getElementById("adminSection").style.display = "block";
      document.getElementById("createAnnouncementCard").style.display = "block";
      document.getElementById("pendingLeavesCard").style.display = "block";
      document.getElementById("add-employee-card").style.display = "block";
      document.getElementById("employee-documents-card").style.display =
        "block";
      document.getElementById("hr-leave-card").style.display = "block";
      document.getElementById("create-task-card").style.display = "block";
      document.getElementById("view-all-tasks-card").style.display = "block";
      document.getElementById("add-remark-card").style.display = "block";
      document.getElementById("view-all-remarks-card").style.display = "block";
      document.getElementById("admin-shift-management").style.display = "block";
      document.getElementById("hr-document-generation").style.display = "block";
      document.getElementById("hr-analytics-view").style.display = "block";
      document.getElementById("hr-reports-generation").style.display = "block";
      document.getElementById("hr-user-management").style.display = "block";
    } else {
      document.getElementById("apply-leave-card").style.display = "block";
      document.getElementById("employee-leave-requests-card").style.display =
        "block";
      document.getElementById("employee-shift-view").style.display = "block";
      document.getElementById("employee-document-download").style.display =
        "block";
      document.getElementById("employee-analytics-view").style.display =
        "block";
      document.getElementById("employee-reports-view").style.display = "block";
      document.getElementById("employee-user-management").style.display =
        "block";
    }
  },

  // Load Dashboard
  async loadDashboard() {
    try {
      const [usersRes, leavesRes] = await Promise.all([
        fetch("/api/users"),
        fetch(`/api/leave/balance/${this.currentUser.user_id}`)
      ]);

      const usersData = await usersRes.json();
      const leavesData = await leavesRes.json();

      if (usersData.success) {
        document.getElementById("totalEmployees").textContent =
          usersData.users.length;
      }

      if (leavesData.success && leavesData.balance) {
        const total =
          (leavesData.balance.sick_balance || 0) +
          (leavesData.balance.casual_balance || 0) +
          (leavesData.balance.paid_balance || 0);
        document.getElementById("leaveBalanceValue").textContent =
          total.toFixed(1);
      }
    } catch (error) {
      console.error("Dashboard load error:", error);
    }
  },

  // Show Section
  showSection(sectionName) {
    document
      .querySelectorAll(".section-content")
      .forEach((s) => s.classList.remove("active"));
    document
      .querySelectorAll(".nav-item")
      .forEach((n) => n.classList.remove("active"));

    const section = document.getElementById(`${sectionName}-section`);
    const navItem = document.querySelector(`[data-section="${sectionName}"]`);

    if (section) section.classList.add("active");
    if (navItem) navItem.classList.add("active");

    // Close mobile menu
    document.querySelector(".sidebar")?.classList.remove("open");
    document.getElementById("mobileOverlay")?.classList.remove("active");
  },

  // Display Results
  displayResults(elementId, html) {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = html;
  },

  // Logout
  logout() {
    if (confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("hrms_user");
      localStorage.removeItem("hrms_token");
      window.location.href = "index.html";
    }
  },
};

// Export to global scope
window.PortalCore = PortalCore;
window.showSection = (s) => PortalCore.showSection(s);
window.displayResults = (e, h) => PortalCore.displayResults(e, h);
window.logout = () => PortalCore.logout();
window.currentUser = PortalCore.currentUser;

// Auto-init
document.addEventListener("DOMContentLoaded", () => PortalCore.init());
