
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
// Activity Tracking System - Tracks all user actions
(function () {
  let currentUser = null;

  // Initialize tracking when user data is available
  function initTracking() {
    const userData = localStorage.getItem("hrms_user");
    if (userData) {
      currentUser = JSON.parse(userData);
      console.log("Activity tracking initialized for:", currentUser.user_id);
    }
  }

  // Log activity to server
  function logActivity(action, details = "") {
    if (!currentUser) return;

    fetch("/api/log-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: currentUser.user_id,
        action: action,
        details: details,
        timestamp: new Date().toISOString(),
        page: window.location.pathname,
      }),
    }).catch((err) => console.error("Activity log error:", err));
  }

  // Track page navigation
  function trackNavigation(section) {
    logActivity("navigate", `Navigated to ${section}`);
  }

  // Track button clicks
  document.addEventListener("click", function (e) {
    if (!currentUser) return;

    const target = e.target.closest("button, a, .action-card, .nav-item");
    if (target) {
      const text = target.textContent.trim().substring(0, 50);
      const action = target.getAttribute("onclick") || target.href || text;
      logActivity("click", `Clicked: ${text}`);
    }
  });

  // Track form submissions
  document.addEventListener("submit", function (e) {
    if (!currentUser) return;
    const formId = e.target.id || "unknown form";
    logActivity("form_submit", `Submitted form: ${formId}`);
  });

  // Track file downloads
  document.addEventListener("click", function (e) {
    if (!currentUser) return;
    const link = e.target.closest(
      'a[download], a[href*="/files/"], a[href*="/employee_data/"]');
    if (link) {
      logActivity("download", `Downloaded: ${link.href}`);
    }
  });

  // Track section changes
  window.addEventListener("load", function () {
    initTracking();
    logActivity("page_load", "Portal loaded");

    // Override showSection to track navigation
    const originalShowSection = window.showSection;
    if (originalShowSection) {
      window.showSection = function (section) {
        trackNavigation(section);
        return originalShowSection(section);
      };
    }
  });

  // Track page unload
  window.addEventListener("beforeunload", function () {
    if (currentUser) {
      navigator.sendBeacon(
        "/api/log-activity",
        JSON.stringify({
          user_id: currentUser.user_id,
          action: "page_unload",
          details: "User left page",
          timestamp: new Date().toISOString(),
        })
      );
    }
  });

  // Re-initialize on storage change
  window.addEventListener("storage", function (e) {
    if (e.key === "hrms_user") {
      initTracking();
    }
  });
})();
