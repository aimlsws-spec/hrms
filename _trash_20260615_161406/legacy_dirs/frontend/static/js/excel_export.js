
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
// Excel Export System
class ExcelExporter {
  constructor() {
    this.init();
  }

  init() {
    this.addExportButtons();
  }

  addExportButtons() {
    // Add export button to all tables
    const tables = document.querySelectorAll("table");
    tables.forEach((table) => {
      if (!table.closest(".card-header")) {
        const cardHeader = table
          .closest(".card")
          ?.querySelector(".card-header");
        if (cardHeader && !cardHeader.querySelector(".export-btn")) {
          const exportBtn = document.createElement("button");
          exportBtn.className = "export-btn btn btn-secondary";
          exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> Export';
          exportBtn.style.cssText = "margin-left:auto;";
          exportBtn.onclick = () => this.exportTable(table);
          cardHeader.appendChild(exportBtn);
        }
      }
    });
  }

  exportTable(table, filename = "export") {
    const wb = this.tableToWorkbook(table);
    this.downloadWorkbook(wb, filename);
  }

  tableToWorkbook(table) {
    const rows = [];

    // Get headers
    const headers = [];
    table.querySelectorAll("thead th").forEach((th) => {
      headers.push(th.textContent.trim());
    });
    if (headers.length > 0) rows.push(headers);

    // Get data rows
    table.querySelectorAll("tbody tr").forEach((tr) => {
      const row = [];
      tr.querySelectorAll("td").forEach((td) => {
        // Clean text content
        let text = td.textContent.trim();
        // Remove extra whitespace
        text = text.replace(/\s+/g, " ");
        row.push(text);
      });
      if (row.length > 0) rows.push(row);
    });

    return rows;
  }

  downloadWorkbook(data, filename) {
    // Convert to CSV format
    const csv = data
      .map((row) =>
        row
          .map((cell) => {
            // Escape quotes and wrap in quotes if contains comma
            const escaped = String(cell).replace(/"/g, '""');
            return escaped.includes(",") || escaped.includes("\n")
              ? `"${escaped}"`
              : escaped;
          })
          .join(","),
      )
      .join("\n");

    // Create blob and download
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    // Show success message with confetti
    this.showSuccess("Excel file downloaded successfully!");
    if (typeof window.showConfetti === "function") {
      window.showConfetti(2000);
    }
  }

  // Export current view data
  exportCurrentView() {
    const activeSection = document.querySelector(".section-content.active");
    if (!activeSection) return;

    const table = activeSection.querySelector("table");
    if (table) {
      const sectionName = activeSection.id.replace("-section", "");
      this.exportTable(table, sectionName);
    } else {
      this.showError("No table found to export");
    }
  }

  // Export all employees
  exportAllEmployees() {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.users) {
          const rows = [
            ["User ID", "Full Name", "Email", "Role", "Department", "Status"],
          ];

          data.users.forEach((user) => {
            rows.push([
              user.user_id,
              user.full_name,
              user.username,
              user.role,
              user.department || "N/A",
              user.is_active ? "Active" : "Inactive",
            ]);
          });

          this.downloadWorkbook(rows, "all_employees");
        }
      })
      .catch((e) => this.showError("Failed to export employees"));
  }

  // Export leave balance
  exportLeaveBalance() {
    fetch("/api/users")
      .then((r) => r.json())
      .then((userData) => {
        if (userData.success && userData.users) {
          const promises = userData.users.map((u) =>
            fetch(`/api/leave/balance/${u.user_id}`)
              .then((r) => r.json())
              .then((d) => ({
                user: u,
                balance: d.balance || {
                  sick_balance: 0,
                  casual_balance: 0,
                  paid_balance: 0,
                  total_balance: 0,
                },
              })),
          );

          Promise.all(promises).then((results) => {
            const rows = [
              [
                "Employee ID",
                "Name",
                "Role",
                "Sick Leave",
                "Casual Leave",
                "Paid Leave",
                "Total Balance",
              ],
            ];

            results.forEach((r) => {
              const b = r.balance;
              rows.push([
                r.user.user_id,
                r.user.full_name,
                r.user.role,
                (b.sick_balance || 0).toFixed(1),
                (b.casual_balance || 0).toFixed(1),
                (b.paid_balance || 0).toFixed(1),
                (b.total_balance || 0).toFixed(1),
              ]);
            });

            this.downloadWorkbook(rows, "leave_balance");
          });
        }
      })
      .catch((e) => this.showError("Failed to export leave balance"));
  }

  // Export tasks
  exportTasks() {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.tasks) {
          const rows = [
            [
              "Task ID",
              "Title",
              "Assigned To",
              "Priority",
              "Status",
              "Due Date",
              "Progress",
            ],
          ];

          data.tasks.forEach((task) => {
            rows.push([
              task.task_id,
              task.title,
              task.assigned_to,
              task.priority,
              task.status,
              task.due_date || "N/A",
              `${task.progress || 0}%`,
            ]);
          });

          this.downloadWorkbook(rows, "tasks");
        }
      })
      .catch((e) => this.showError("Failed to export tasks"));
  }

  // Export to PDF
  exportToPDF() {
    const activeSection = document.querySelector(".section-content.active");
    if (!activeSection) {
      this.showError("No active section found");
      return;
    }

    const table = activeSection.querySelector("table");
    if (!table) {
      this.showError("No table found to export");
      return;
    }

    const sectionName = activeSection.id.replace("-section", "");
    const printWindow = window.open("", "_blank");
    const tableClone = table.cloneNode(true);

    printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${sectionName} - Export</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #1e3a8a; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    th { background: #1e3a8a; color: white; font-weight: 600; }
                    tr:nth-child(even) { background: #f8fafc; }
                    @media print {
                        body { padding: 0; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <h1>Seawind HRMS - ${sectionName}</h1>
                <p>Generated on: ${new Date().toLocaleString()}</p>
                ${tableClone.outerHTML}
                <br>
                <button onclick="window.print()" style="background:#1e3a8a;color:white;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;font-size:14px;">
                    🖨️ Print / Save as PDF
                </button>
                <button onclick="window.close()" style="background:#64748b;color:white;padding:10px 20px;border:none;border-radius:6px;cursor:pointer;font-size:14px;margin-left:10px;">
                    ✖️ Close
                </button>
            </body>
            </html>
        `);

    printWindow.document.close();
    this.showSuccess(
      "PDF preview opened! Use Ctrl+P or Print button to save as PDF");
  }

  showSuccess(message) {
    const toast = document.createElement("div");
    toast.style.cssText =
      "position:fixed;top:20px;right:20px;background:#10b981;color:white;padding:16px 24px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:10001;animation:slideInRight 0.3s;display:flex;align-items:center;gap:12px;";
    toast.innerHTML = `<i class="fas fa-check-circle" style="font-size:20px;"></i><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "slideOutRight 0.3s";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  showError(message) {
    const toast = document.createElement("div");
    toast.style.cssText =
      "position:fixed;top:20px;right:20px;background:#ef4444;color:white;padding:16px 24px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:10001;animation:slideInRight 0.3s;display:flex;align-items:center;gap:12px;";
    toast.innerHTML = `<i class="fas fa-exclamation-circle" style="font-size:20px;"></i><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "slideOutRight 0.3s";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Global export functions
window.exportTableToExcel = function (table, filename) {
  const exporter = new ExcelExporter();
  if (table) {
    exporter.exportTable(table, filename);
  } else {
    exporter.exportCurrentView();
  }
};

window.exportAllEmployees = function () {
  const exporter = new ExcelExporter();
  exporter.exportAllEmployees();
};

window.exportLeaveBalance = function () {
  const exporter = new ExcelExporter();
  exporter.exportLeaveBalance();
};

window.exportTasks = function () {
  const exporter = new ExcelExporter();
  exporter.exportTasks();
};

window.exportToPDF = function () {
  const exporter = new ExcelExporter();
  exporter.exportToPDF();
};

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  window.excelExporter = new ExcelExporter();

  // Add CSS animations
  const style = document.createElement("style");
  style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
        .export-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s;
        }
        .export-btn:hover {
            background: #059669;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
    `;
  document.head.appendChild(style);

  // Re-add buttons when content changes
  const observer = new MutationObserver(() => {
    window.excelExporter.addExportButtons();
  });
  observer.observe(document.body, { childList: true, subtree: true });
});
