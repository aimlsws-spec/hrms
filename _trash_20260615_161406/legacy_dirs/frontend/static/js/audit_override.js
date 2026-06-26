
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
// FINAL OVERRIDE - Load this last
(function () {
  "use strict";

  window.viewLoginHistory = async function () {
    const el = document.getElementById("auditResults");
    if (!el) return;

    el.innerHTML = '<p style="color: #64748b;">Loading login history...</p>';

    try {
      const response = await fetch("/api/audit/login-history?limit=100");
      const data = await response.json();

      if (data.success && data.logs && data.logs.length > 0) {
        let html =
          '<div style="background:#dcfce7;padding:12px;border-radius:8px;margin-bottom:16px;color:#166534;"><strong>✅ Found ' +
          data.logs.length +
          " login records</strong></div>";
        html +=
          '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f1f5f9;"><th style="padding:12px;text-align:left;">User ID</th><th style="padding:12px;text-align:left;">Username</th><th style="padding:12px;text-align:left;">Status</th><th style="padding:12px;text-align:left;">IP</th><th style="padding:12px;text-align:left;">Login Time</th></tr></thead><tbody>';

        data.logs.forEach((log) => {
          const isSuccess = log.status === "SUCCESS";
          const statusBg = isSuccess ? "#dcfce7" : "#fee2e2";
          const statusColor = isSuccess ? "#166534" : "#991b1b";

          let loginTime = "N/A";
          if (log.login_time) {
            try {
              const d = new Date(log.login_time);
              loginTime = d.toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
            } catch (e) {
              loginTime = String(log.login_time);
            }
          }

          html += `<tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="padding:12px;font-weight:600;">${log.user_id}</td>
                        <td style="padding:12px;">${log.username}</td>
                        <td style="padding:12px;"><span style="background:${statusBg};color:${statusColor};padding:4px 8px;border-radius:4px;font-size:12px;font-weight:600;">${log.status}</span></td>
                        <td style="padding:12px;">${log.ip_address || "-"}</td>
                        <td style="padding:12px;">${loginTime}</td>
                    </tr>`;
        });

        html += "</tbody></table>";
        el.innerHTML = html;
      } else {
        el.innerHTML =
          '<p style="color:#64748b;">No login history found. New logins will appear here.</p>';
      }
    } catch (error) {
      el.innerHTML =
        '<p style="color:#ef4444;">❌ Error: ' + error.message + "</p>";
    }
  };

  console.log("🔧 Login History Override Loaded");
})();
