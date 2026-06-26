
// Safe Global Fetch Interceptor for Production
(function() {
    if (window.__fetchInterceptorAttached) return;
    const originalFetch = window.fetch;
    window.fetch = function(resource, config) {
        if (typeof resource === 'string' && resource.startsWith('/api/') && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
            resource = 'https://hrmsapi.seawindsolution.com' + resource;
        }
        return originalFetch(resource, config);
    };
    window.__fetchInterceptorAttached = true;
})();
// Global Search & Filter System
const SearchFilters = {
  employees: [],
  filteredEmployees: [],

  // Initialize global search
  initGlobalSearch() {
    const searchHTML = `
            <div id="globalSearchOverlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;backdrop-filter:blur(5px);" onclick="SearchFilters.closeGlobalSearch()">
                <div style="max-width:700px;margin:100px auto;background:white;border-radius:16px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">
                    <input type="text" id="globalSearchInput" placeholder="🔍 Search employees, tasks, leaves..." style="width:100%;padding:16px;border:2px solid #e2e8f0;border-radius:12px;font-size:16px;margin-bottom:20px;" oninput="SearchFilters.performGlobalSearch(this.value)">
                    <div id="globalSearchResults" style="max-height:400px;overflow-y:auto;"></div>
                </div>
            </div>`;
    document.body.insertAdjacentHTML("beforeend", searchHTML);

    // Add search icon to header
    const searchIcon = document.createElement("div");
    searchIcon.innerHTML =
      '<i class="fas fa-search" style="font-size:20px;color:#64748b;cursor:pointer;"></i>';
    searchIcon.style.cssText = "margin-right:20px;cursor:pointer;";
    searchIcon.onclick = () => this.openGlobalSearch();
    const headerRight = document.querySelector(".header-right");
    if (!headerRight) { console.warn("Search icon target not found: .header-right"); return; }
    headerRight.insertBefore(searchIcon, document.querySelector(".notification-bell"));

    // Keyboard shortcut Ctrl+K
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        this.openGlobalSearch();
      }
    });
  },

  openGlobalSearch() {
    document.getElementById("globalSearchOverlay").style.display = "block";
    document.getElementById("globalSearchInput").focus();
  },

  closeGlobalSearch() {
    document.getElementById("globalSearchOverlay").style.display = "none";
    document.getElementById("globalSearchInput").value = "";
    document.getElementById("globalSearchResults").innerHTML = "";
  },

  async performGlobalSearch(query) {
    if (!query || query.length < 2) {
      document.getElementById("globalSearchResults").innerHTML =
        '<p style="color:#94a3b8;text-align:center;padding:20px;">Type to search...</p>';
      return;
    }

    const results = document.getElementById("globalSearchResults");
    results.innerHTML =
      '<p style="color:#94a3b8;text-align:center;padding:20px;">Searching...</p>';

    try {
      const [empRes, taskRes] = await Promise.all([
        fetch(
          `/employees/search?q=${query}`),
        fetch(`/api/tasks`),
      ]);

      const empData = await empRes.json();
      const taskData = await taskRes.json();

      let html = "";

      if (empData.results && empData.results.length > 0) {
        html +=
          '<div style="margin-bottom:20px;"><h4 style="color:#1e293b;margin-bottom:12px;">👥 Employees</h4>';
        empData.results.slice(0, 5).forEach((emp) => {
          html += `<div style="padding:12px;background:#f8fafc;border-radius:8px;margin-bottom:8px;cursor:pointer;" onclick="showSection('employees');SearchFilters.closeGlobalSearch();">
                        <strong>${emp.name}</strong> <span style="color:#64748b;font-size:13px;">${emp.employee_id}</span><br>
                        <small style="color:#94a3b8;">${emp.department || "N/A"}</small>
                    </div>`;
        });
        html += "</div>";
      }

      if (taskData.success && taskData.tasks) {
        const matchedTasks = taskData.tasks
          .filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 5);

        if (matchedTasks.length > 0) {
          html +=
            '<div><h4 style="color:#1e293b;margin-bottom:12px;">📋 Tasks</h4>';
          matchedTasks.forEach((task) => {
            html += `<div style="padding:12px;background:#f8fafc;border-radius:8px;margin-bottom:8px;cursor:pointer;" onclick="showSection('tasks');SearchFilters.closeGlobalSearch();">
                            <strong>${task.title}</strong><br>
                            <small style="color:#94a3b8;">${task.status} • ${task.priority}</small>
                        </div>`;
          });
          html += "</div>";
        }
      }

      results.innerHTML =
        html ||
        '<p style="color:#94a3b8;text-align:center;padding:20px;">No results found</p>';
    } catch (error) {
      results.innerHTML =
        '<p style="color:#ef4444;text-align:center;padding:20px;">Search error</p>';
    }
  },

  // Advanced Employee Filters
  initEmployeeFilters() {
    const filterHTML = `
            <div style="background:white;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <h3 style="margin:0 0 16px 0;color:#1e293b;">🔍 Advanced Filters</h3>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
                    <select id="filterStatus" onchange="SearchFilters.applyEmployeeFilters()" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <select id="filterDepartment" onchange="SearchFilters.applyEmployeeFilters()" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;">
                        <option value="">All Departments</option>
                    </select>
                    <select id="filterRole" onchange="SearchFilters.applyEmployeeFilters()" style="padding:10px;border:1px solid #e2e8f0;border-radius:8px;">
                        <option value="">All Roles</option>
                        <option value="admin">Admin</option>
                        <option value="hr">HR</option>
                        <option value="manager">Manager</option>
                        <option value="employee">Employee</option>
                    </select>
                    <button onclick="SearchFilters.resetFilters()" style="padding:10px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                        🔄 Reset
                    </button>
                </div>
            </div>`;

    const employeeSection = document.getElementById("employees-section");
    if (!employeeSection) { console.warn("Search filter target not found: employees-section"); return; }
    const insertAfter = employeeSection.querySelector(".stats-grid") ||
                        employeeSection.querySelector(".action-grid") ||
                        employeeSection.querySelector(".card");
    if (!insertAfter) { console.warn("Search filter target not found: no container in employees-section"); return; }
    insertAfter.insertAdjacentHTML("afterend", filterHTML);

    this.loadDepartments();
  },

  async loadDepartments() {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) {
        const departments = [
          ...new Set(data.users.map((u) => u.department).filter((d) => d)),
        ];
        const select = document.getElementById("filterDepartment");
        departments.forEach((dept) => {
          select.innerHTML += `<option value="${dept}">${dept}</option>`;
        });
      }
    } catch (error) {
      console.error("Error loading departments:", error);
    }
  },

  async applyEmployeeFilters() {
    const status = document.getElementById("filterStatus").value;
    const department = document.getElementById("filterDepartment").value;
    const role = document.getElementById("filterRole").value;

    try {
      const res = await fetch("/api/users");
      const data = await res.json();

      if (data.success) {
        let filtered = data.users;

        if (status === "active") filtered = filtered.filter((u) => u.is_active);
        if (status === "inactive")
          filtered = filtered.filter((u) => !u.is_active);
        if (department)
          filtered = filtered.filter((u) => u.department === department);
        if (role) filtered = filtered.filter((u) => u.role === role);

        this.displayFilteredEmployees(filtered);
      }
    } catch (error) {
      console.error("Filter error:", error);
    }
  },

  displayFilteredEmployees(employees) {
    let html = `<div style="background:white;border-radius:12px;padding:20px;">
            <h3 style="margin:0 0 16px 0;">Found ${employees.length} employees</h3>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#f1f5f9;">
                    <th style="padding:12px;text-align:left;">Name</th>
                    <th style="padding:12px;text-align:left;">ID</th>
                    <th style="padding:12px;text-align:left;">Department</th>
                    <th style="padding:12px;text-align:left;">Role</th>
                    <th style="padding:12px;text-align:left;">Status</th>
                </tr></thead><tbody>`;

    employees.forEach((emp) => {
      const statusBadge = emp.is_active
        ? '<span style="background:#dcfce7;color:#166534;padding:4px 8px;border-radius:4px;font-size:12px;">Active</span>'
        : '<span style="background:#fee2e2;color:#991b1b;padding:4px 8px;border-radius:4px;font-size:12px;">Inactive</span>';

      html += `<tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:12px;font-weight:600;">${emp.full_name}</td>
                <td style="padding:12px;">${emp.user_id}</td>
                <td style="padding:12px;">${emp.department || "N/A"}</td>
                <td style="padding:12px;">${emp.role}</td>
                <td style="padding:12px;">${statusBadge}</td>
            </tr>`;
    });

    html += "</tbody></table></div>";
    const resultsEl = document.getElementById("employeeResults");
    if (!resultsEl) { console.warn("Search filter target not found: employeeResults"); return; }
    resultsEl.innerHTML = html;
  },

  resetFilters() {
    document.getElementById("filterStatus").value = "";
    document.getElementById("filterDepartment").value = "";
    document.getElementById("filterRole").value = "";
    this.applyEmployeeFilters();
  },

  // Date Range Picker for Reports
  initDateRangePicker() {
    const dateRangeHTML = `
            <div style="background:white;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <h3 style="margin:0 0 16px 0;color:#1e293b;">📅 Date Range</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end;">
                    <div>
                        <label style="display:block;margin-bottom:4px;font-weight:500;font-size:13px;">From Date</label>
                        <input type="date" id="dateFrom" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:4px;font-weight:500;font-size:13px;">To Date</label>
                        <input type="date" id="dateTo" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;">
                    </div>
                    <button onclick="SearchFilters.applyDateRange()" style="padding:10px 20px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                        Apply
                    </button>
                </div>
                <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="SearchFilters.setQuickDate('today')" style="padding:6px 12px;background:#f1f5f9;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Today</button>
                    <button onclick="SearchFilters.setQuickDate('week')" style="padding:6px 12px;background:#f1f5f9;border:none;border-radius:6px;cursor:pointer;font-size:12px;">This Week</button>
                    <button onclick="SearchFilters.setQuickDate('month')" style="padding:6px 12px;background:#f1f5f9;border:none;border-radius:6px;cursor:pointer;font-size:12px;">This Month</button>
                    <button onclick="SearchFilters.setQuickDate('year')" style="padding:6px 12px;background:#f1f5f9;border:none;border-radius:6px;cursor:pointer;font-size:12px;">This Year</button>
                </div>
            </div>`;

    const reportsSection = document.getElementById("reports-section");
    if (!reportsSection) { console.warn("Date range target not found: reports-section"); return; }
    const pageHeader = reportsSection.querySelector(".page-header");
    if (!pageHeader) { console.warn("Date range target not found: .page-header"); return; }
    pageHeader.insertAdjacentHTML("afterend", dateRangeHTML);
  },

  setQuickDate(period) {
    const today = new Date();
    const dateFrom = document.getElementById("dateFrom");
    const dateTo = document.getElementById("dateTo");

    dateTo.value = today.toISOString().split("T")[0];

    switch (period) {
      case "today":
        dateFrom.value = today.toISOString().split("T")[0];
        break;
      case "week":
        const weekAgo = new Date(today.setDate(today.getDate() - 7));
        dateFrom.value = weekAgo.toISOString().split("T")[0];
        break;
      case "month":
        const monthAgo = new Date(today.setMonth(today.getMonth() - 1));
        dateFrom.value = monthAgo.toISOString().split("T")[0];
        break;
      case "year":
        const yearAgo = new Date(today.setFullYear(today.getFullYear() - 1));
        dateFrom.value = yearAgo.toISOString().split("T")[0];
        break;
    }

    this.applyDateRange();
  },

  applyDateRange() {
    const from = document.getElementById("dateFrom").value;
    const to = document.getElementById("dateTo").value;

    if (!from || !to) {
      alert("Please select both dates");
      return;
    }

    const results = document.getElementById("reportResults");
    results.innerHTML = `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-top:20px;">
            <strong style="color:#1e40af;">📊 Date Range Applied:</strong>
            <p style="margin:8px 0 0 0;color:#1e3a8a;">${from} to ${to}</p>
            <p style="margin:8px 0 0 0;color:#64748b;font-size:13px;">Reports will be filtered for this date range. Select a report type above to generate.</p>
        </div>`;
  },
};

// Auto-initialize
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    SearchFilters.initGlobalSearch();

    // Initialize filters when sections are shown
    const observer = new MutationObserver(() => {
      const employeeSection = document.getElementById("employees-section");
      const reportsSection = document.getElementById("reports-section");

      if (
        employeeSection &&
        employeeSection.classList.contains("active") &&
        !document.getElementById("filterStatus")
      ) {
        SearchFilters.initEmployeeFilters();
      }

      if (
        reportsSection &&
        reportsSection.classList.contains("active") &&
        !document.getElementById("dateFrom")
      ) {
        SearchFilters.initDateRangePicker();
      }
    });

    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["class"],
    });
  }, 1000);
});

window.SearchFilters = SearchFilters;
