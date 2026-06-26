
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
// Fix audit functions to use correct endpoints
window.viewAdminLogs = async function () {
  document.getElementById("auditResults").innerHTML =
    '<p style="color: #64748b;">Loading admin activity logs...</p>';
  try {
    const response = await fetch("/api/audit/logs/admin-activity?limit=100");
    const data = await response.json();
    if (data.success && data.logs && data.logs.length > 0) {
      let html =
        '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f1f5f9;"><th style="padding:12px;text-align:left;">Admin ID</th><th style="padding:12px;text-align:left;">Name</th><th style="padding:12px;text-align:left;">Action</th><th style="padding:12px;text-align:left;">Details</th><th style="padding:12px;text-align:left;">IP Address</th><th style="padding:12px;text-align:left;">Timestamp</th></tr></thead><tbody>';
      data.logs.forEach((log) => {
        html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:12px;">${log.admin_id}</td><td style="padding:12px;">${log.admin_name}</td><td style="padding:12px;"><span style="background:#dbeafe;color:#1e40af;padding:4px 8px;border-radius:4px;font-size:12px;">${log.action}</span></td><td style="padding:12px;">${log.details || "-"}</td><td style="padding:12px;">${log.ip_address}</td><td style="padding:12px;">${new Date(log.timestamp).toLocaleString()}</td></tr>`;
      });
      html += "</tbody></table>";
      document.getElementById("auditResults").innerHTML = html;
    } else {
      document.getElementById("auditResults").innerHTML =
        '<p style="color:#64748b;">No admin activity logs found.</p>';
    }
  } catch (error) {
    document.getElementById("auditResults").innerHTML =
      '<p style="color:#ef4444;">Error loading logs: ' + error.message + "</p>";
  }
};

window.viewEmployeeLogs = async function () {
  document.getElementById("auditResults").innerHTML =
    '<p style="color: #64748b;">Loading employee activity logs...</p>';
  try {
    const response = await fetch("/api/audit/logs/employee-activity?limit=100");
    const data = await response.json();
    if (data.success && data.logs && data.logs.length > 0) {
      let html =
        '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f1f5f9;"><th style="padding:12px;text-align:left;">Employee ID</th><th style="padding:12px;text-align:left;">Name</th><th style="padding:12px;text-align:left;">Action</th><th style="padding:12px;text-align:left;">Details</th><th style="padding:12px;text-align:left;">IP Address</th><th style="padding:12px;text-align:left;">Timestamp</th></tr></thead><tbody>';
      data.logs.forEach((log) => {
        html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:12px;">${log.employee_id}</td><td style="padding:12px;">${log.employee_name}</td><td style="padding:12px;"><span style="background:#dcfce7;color:#166534;padding:4px 8px;border-radius:4px;font-size:12px;">${log.action}</span></td><td style="padding:12px;">${log.details || "-"}</td><td style="padding:12px;">${log.ip_address}</td><td style="padding:12px;">${new Date(log.timestamp).toLocaleString()}</td></tr>`;
      });
      html += "</tbody></table>";
      document.getElementById("auditResults").innerHTML = html;
    } else {
      document.getElementById("auditResults").innerHTML =
        '<p style="color:#64748b;">No employee activity logs found.</p>';
    }
  } catch (error) {
    document.getElementById("auditResults").innerHTML =
      '<p style="color:#ef4444;">Error loading logs: ' + error.message + "</p>";
  }
};

window.viewLoginHistory = async function () {
  document.getElementById("auditResults").innerHTML =
    '<p style="color: #64748b;">Loading login history...</p>';
  try {
    const response = await fetch("/api/audit/login-history?limit=100");
    const data = await response.json();
    console.log("Login history response:", data);
    if (data.success && data.logs && data.logs.length > 0) {
      let html =
        '<div style="background:#eff6ff;padding:12px;border-radius:8px;margin-bottom:16px;"><strong>Found ' +
        data.logs.length +
        " login records</strong></div>";
      html +=
        '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f1f5f9;"><th style="padding:12px;text-align:left;">User ID</th><th style="padding:12px;text-align:left;">Username</th><th style="padding:12px;text-align:left;">Status</th><th style="padding:12px;text-align:left;">IP Address</th><th style="padding:12px;text-align:left;">Login Time</th></tr></thead><tbody>';
      data.logs.forEach((log) => {
        const statusColor = log.status === "SUCCESS" ? "#22c55e" : "#ef4444";
        const statusBg = log.status === "SUCCESS" ? "#dcfce7" : "#fee2e2";
        const loginTime = log.login_time
          ? new Date(log.login_time).toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "N/A";
        html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:12px;font-weight:600;">${log.user_id}</td><td style="padding:12px;">${log.username}</td><td style="padding:12px;"><span style="background:${statusBg};color:${statusColor};padding:4px 8px;border-radius:4px;font-size:12px;font-weight:600;">${log.status}</span></td><td style="padding:12px;">${log.ip_address || "-"}</td><td style="padding:12px;">${loginTime}</td></tr>`;
      });
      html += "</tbody></table>";
      document.getElementById("auditResults").innerHTML = html;
    } else {
      document.getElementById("auditResults").innerHTML =
        '<p style="color:#64748b;">No login history found. New logins will appear here.</p>';
    }
  } catch (error) {
    console.error("Login history error:", error);
    document.getElementById("auditResults").innerHTML =
      '<p style="color:#ef4444;">Error: ' + error.message + "</p>";
  }
};

// Force override on page load
setTimeout(() => {
  console.log("✅ Audit functions loaded and ready");
}, 100);

console.log("✅ Audit fix script v2 loaded");
