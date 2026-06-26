
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
// Reports Module - Accurate Leave Report for Admin
console.log("✅ Reports.js v2 loaded - Accurate leave report");

window.generateReport = async function (reportType) {
  console.log("generateReport called with:", reportType);
  if (reportType === "leave_report") {
    await generateAccurateLeaveReport();
  } else {
    document.getElementById("reportResults").innerHTML =
      '<p style="color: #64748b;">Report type not implemented yet.</p>';
  }
};

async function generateAccurateLeaveReport() {
  const resultsDiv = document.getElementById("reportResults");
  resultsDiv.innerHTML =
    '<p style="color: #64748b;">Loading accurate leave report...</p>';

  try {
    const usersRes = await fetch("/api/users");
    const usersData = await usersRes.json();

    if (!usersData.success) {
      resultsDiv.innerHTML =
        '<p style="color: #ef4444;">Error loading users</p>';
      return;
    }

    const promises = usersData.users.map(async (user) => {
      try {
        const balanceRes = await fetch(`/api/leave/balance/${user.user_id}`);
        const balanceData = await balanceRes.json();
        return {
          user_id: user.user_id,
          name: user.full_name,
          role: user.role,
          balance: balanceData.balance || {
            sick_balance: 0,
            casual_balance: 0,
            paid_balance: 0,
            total_balance: 0,
          },
        };
      } catch {
        return {
          user_id: user.user_id,
          name: user.full_name,
          role: user.role,
          balance: {
            sick_balance: 0,
            casual_balance: 0,
            paid_balance: 0,
            total_balance: 0,
          },
        };
      }
    });

    const results = await Promise.all(promises);

    let html = `
            <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h2 style="margin: 0 0 20px 0; color: #1e3a8a;">📊 Accurate Leave Balance Report</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 12px; text-align: left;">Employee ID</th>
                            <th style="padding: 12px; text-align: left;">Name</th>
                            <th style="padding: 12px; text-align: left;">Role</th>
                            <th style="padding: 12px; text-align: right;">Sick</th>
                            <th style="padding: 12px; text-align: right;">Casual</th>
                            <th style="padding: 12px; text-align: right;">Paid</th>
                            <th style="padding: 12px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

    results.forEach((r) => {
      const b = r.balance;
      html += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px;">${r.user_id}</td>
                    <td style="padding: 12px; font-weight: 500;">${r.name}</td>
                    <td style="padding: 12px;"><span style="background: ${r.role === "admin" ? "#fee2e2" : r.role === "hr" ? "#dbeafe" : "#f3e8ff"}; color: ${r.role === "admin" ? "#991b1b" : r.role === "hr" ? "#1e40af" : "#6b21a8"}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${r.role.toUpperCase()}</span></td>
                    <td style="padding: 12px; text-align: right;">${(b.sick_balance || 0).toFixed(1)}</td>
                    <td style="padding: 12px; text-align: right;">${(b.casual_balance || 0).toFixed(1)}</td>
                    <td style="padding: 12px; text-align: right;">${(b.paid_balance || 0).toFixed(1)}</td>
                    <td style="padding: 12px; text-align: right; font-weight: 600; color: #3b82f6;">${(b.total_balance || 0).toFixed(1)}</td>
                </tr>
            `;
    });

    html += `
                    </tbody>
                </table>
                <div style="margin-top: 20px; padding: 16px; background: #eff6ff; border-radius: 8px;">
                    <strong style="color: #1e40af;">📋 Leave Policy:</strong>
                    <span style="color: #1e3a8a;"> 18 leaves/year • 1.5 leaves/month (0.5 Sick + 0.5 Casual + 0.5 Paid) • Carry forward monthly • Excess deducted from salary</span>
                </div>
            </div>
        `;

    resultsDiv.innerHTML = html;
  } catch (error) {
    console.error("Error generating leave report:", error);
    resultsDiv.innerHTML =
      '<p style="color: #ef4444;">Error generating report</p>';
  }
}
