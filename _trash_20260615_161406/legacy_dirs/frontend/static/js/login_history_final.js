
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
window.viewLoginHistory = async function () {
  const e = document.getElementById("auditResults");
  if (!e) return;
  e.innerHTML = '<p style="color:#64748b;">Loading login history...</p>';
  try {
    const r = await fetch("/api/audit/login-history?limit=100"),
      d = await r.json();
    if (d.success && d.logs && d.logs.length > 0) {
      let h =
        '<div style="background:#dcfce7;padding:12px;border-radius:8px;margin-bottom:16px;color:#166534;"><strong>✅ ' +
        d.logs.length +
        ' login records</strong></div><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f1f5f9;"><th style="padding:12px;text-align:left;">User ID</th><th style="padding:12px;text-align:left;">Username</th><th style="padding:12px;text-align:left;">Status</th><th style="padding:12px;text-align:left;">IP</th><th style="padding:12px;text-align:left;">Login Time</th></tr></thead><tbody>';
      d.logs.forEach((l) => {
        const s = l.status === "SUCCESS",
          t = l.login_time
            ? new Date(l.login_time).toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "N/A";
        h += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:12px;font-weight:600;">${l.user_id}</td><td style="padding:12px;">${l.username}</td><td style="padding:12px;"><span style="background:${s ? "#dcfce7" : "#fee2e2"};color:${s ? "#166534" : "#991b1b"};padding:4px 8px;border-radius:4px;font-size:12px;font-weight:600;">${l.status}</span></td><td style="padding:12px;">${l.ip_address || "-"}</td><td style="padding:12px;">${t}</td></tr>`;
      });
      h += "</tbody></table>";
      e.innerHTML = h;
    } else
      e.innerHTML =
        '<p style="color:#64748b;">No login history. New logins will appear here.</p>';
  } catch (err) {
    e.innerHTML = '<p style="color:#ef4444;">❌ Error: ' + err.message + "</p>";
  }
};
console.log("🔧 Final Login History Override Active");
