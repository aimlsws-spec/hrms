
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
// Final Working Charts - All Sections

(function () {
  console.log("🚀 Charts initializing...");

  window.addEventListener("load", function () {
    setTimeout(setupCharts, 1000);
  });

  function setupCharts() {
    const orig = window.showSection;
    if (!orig) {
      setTimeout(setupCharts, 500);
      return;
    }

    window.showSection = function (section) {
      orig(section);
      console.log("📍 Section:", section);

      // Destroy ALL charts before creating new ones
      Chart.helpers.each(Chart.instances, function (instance) {
        instance.destroy();
      });

      setTimeout(function () {
        if (section === "leaves") initLeaveCharts();
        if (section === "tasks") initTaskCharts();
        if (section === "employees") initEmployeeCharts();
        if (section === "analytics") initAnalyticsCharts();
        if (section === "reports") initReportsCharts();
      }, 300);
    };
    console.log("✅ Charts ready");
  }

  // LEAVE CHARTS
  function initLeaveCharts() {
    const ctx1 = document.getElementById("leaveBalanceChart");
    const ctx2 = document.getElementById("leaveRequestsChart");

    if (ctx1) {
      new Chart(ctx1, {
        type: "bar",
        data: {
          labels: ["Sick", "Casual", "Paid"],
          datasets: [
            {
              data: [3.5, 4.0, 5.5],
              backgroundColor: ["#ef4444", "#f59e0b", "#10b981"],
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          plugins: { legend: { display: false } },
        },
      });

      if (window.currentUser) {
        fetch("/api/leave/balance/" +
            window.currentUser.user_id)
          .then((r) => r.json())
          .then((d) => {
            if (d.balance) {
              Chart.helpers.each(Chart.instances, function (i) {
                if (i.canvas.id === "leaveBalanceChart") {
                  i.data.datasets[0].data = [
                    parseFloat(d.balance.sick_balance) || 0,
                    parseFloat(d.balance.casual_balance) || 0,
                    parseFloat(d.balance.paid_balance) || 0,
                  ];
                  i.update();
                }
              });
            }
          });
      }
    }

    if (ctx2) {
      new Chart(ctx2, {
        type: "line",
        data: {
          labels: [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ],
          datasets: [
            {
              data: [2, 1, 3, 2, 1, 2, 3, 1, 2, 1, 2, 1],
              borderColor: "#3b82f6",
              backgroundColor: "rgba(59,130,246,0.1)",
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: { responsive: true, plugins: { legend: { display: false } } },
      });

      if (window.currentUser) {
        fetch("/api/leave_requests/employee/" +
            window.currentUser.user_id)
          .then((r) => r.json())
          .then((d) => {
            if (d.requests) {
              const months = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
              d.requests.forEach(
                (r) => months[new Date(r.start_date).getMonth()]++,
              );
              Chart.helpers.each(Chart.instances, function (i) {
                if (i.canvas.id === "leaveRequestsChart") {
                  i.data.datasets[0].data = months;
                  i.update();
                }
              });
            }
          });
      }
    }
  }

  // TASK CHARTS
  function initTaskCharts() {
    const ctx1 = document.getElementById("taskStatusChart");
    const ctx2 = document.getElementById("taskPriorityChart");

    if (ctx1) {
      new Chart(ctx1, {
        type: "doughnut",
        data: {
          labels: ["To Do", "In Progress", "Completed"],
          datasets: [
            {
              data: [0, 0, 0],
              backgroundColor: ["#fbbf24", "#3b82f6", "#10b981"],
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "bottom" } },
          cutout: "65%",
        },
      });

      fetch("/api/tasks?user_id=" +
          (window.currentUser ? window.currentUser.user_id : "") +
          "&user_role=" +
          (window.currentUser ? window.currentUser.role : ""))
        .then((r) => r.json())
        .then((d) => {
          if (d.tasks) {
            const todo = d.tasks.filter(
              (t) => t.status === "To Do" || t.status === "Pending",
            ).length;
            const inProgress = d.tasks.filter(
              (t) => t.status === "In Progress",
            ).length;
            const completed = d.tasks.filter(
              (t) => t.status === "Completed" || t.status === "Done",
            ).length;

            Chart.helpers.each(Chart.instances, function (i) {
              if (i.canvas.id === "taskStatusChart") {
                i.data.datasets[0].data = [todo, inProgress, completed];
                i.update();
              }
            });
          }
        });
    }

    if (ctx2) {
      new Chart(ctx2, {
        type: "bar",
        data: {
          labels: ["High", "Medium", "Low"],
          datasets: [
            {
              data: [0, 0, 0],
              backgroundColor: ["#ef4444", "#f59e0b", "#10b981"],
            },
          ],
        },
        options: { responsive: true, plugins: { legend: { display: false } } },
      });

      fetch("/api/tasks?user_id=" +
          (window.currentUser ? window.currentUser.user_id : "") +
          "&user_role=" +
          (window.currentUser ? window.currentUser.role : ""))
        .then((r) => r.json())
        .then((d) => {
          if (d.tasks) {
            const high = d.tasks.filter((t) => t.priority === "High").length;
            const medium = d.tasks.filter(
              (t) => t.priority === "Medium",
            ).length;
            const low = d.tasks.filter((t) => t.priority === "Low").length;

            Chart.helpers.each(Chart.instances, function (i) {
              if (i.canvas.id === "taskPriorityChart") {
                i.data.datasets[0].data = [high, medium, low];
                i.update();
              }
            });
          }
        });
    }
  }

  // EMPLOYEE CHARTS
  function initEmployeeCharts() {
    const ctx1 = document.getElementById("employeeDeptChart");
    const ctx2 = document.getElementById("employeeStatusChart");

    // Fetch both data sources first, then create charts once with real data
    // (avoids the "appears then disappears" pattern from dummy→real data updates)
    Promise.all([
      fetch("/api/employees/search?query=").then(r => r.json()).catch(() => ({ results: [] })),
      fetch("/api/users").then(r => r.json()).catch(() => ({ users: [] }))
    ]).then(function(results) {
      var empData  = results[0];
      var userData = results[1];

      // Department Headcount — real employee departments
      if (ctx1) {
        var emps  = empData.results || empData.employees || [];
        var depts = {};
        emps.forEach(function(e) {
          var dept = e.department || "Unassigned";
          depts[dept] = (depts[dept] || 0) + 1;
        });
        new Chart(ctx1, {
          type: "bar",
          data: {
            labels: Object.keys(depts),
            datasets: [{ data: Object.values(depts), backgroundColor: "#3b82f6" }]
          },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
      }

      // Employee Status — use the new API endpoint
      if (ctx2) {
        fetch("/api/employees/status-summary")
          .then(response => response.json())
          .then(data => {
            if (data.success && data.data) {
              const active = data.data.active || 0;
              const inactive = data.data.inactive || 0;
              const onLeave = data.data.on_leave || 0;
              new Chart(ctx2, {
                type: "pie",
                data: {
                  labels: ["Active", "Inactive", "On Leave"],
                  datasets: [{
                    data: [active, inactive, onLeave],
                    backgroundColor: ["#10b981", "#ef4444", "#f59e0b"]
                  }]
                },
                options: { responsive: true, plugins: { legend: { position: "bottom" } } }
              });
            }
          })
          .catch(() => {
            // Fallback to dummy data if API fails
            new Chart(ctx2, {
              type: "pie",
              data: {
                labels: ["Active", "Inactive", "On Leave"],
                datasets: [{
                  data: [0, 0, 0],
                  backgroundColor: ["#10b981", "#ef4444", "#f59e0b"]
                }]
              },
              options: { responsive: true, plugins: { legend: { position: "bottom" } } }
            });
          });
      }
    });
  }

  // ANALYTICS CHARTS
  function initAnalyticsCharts() {
    fetch("/api/analytics/overview")
      .then((response) => response.json())
      .then((data) => {
        console.log("Analytics API Response:", data);
        if (data.success && data.data) {
          const ctx1 = document.getElementById("departmentChart");
          const ctx2 = document.getElementById("employeeGrowthChart");
          const ctx3 = document.getElementById("leaveStatusChart");
          const ctx4 = document.getElementById("taskCompletionChart");

          if (ctx1 && data.data.departments) {
            new Chart(ctx1, {
              type: "doughnut",
              data: {
                labels: data.data.departments.map(
                  (d) => d.department || "Unknown"),
                datasets: [
                  {
                    data: data.data.departments.map((d) => d.count),
                    backgroundColor: [
                      "#3b82f6",
                      "#10b981",
                      "#f59e0b",
                      "#8b5cf6",
                      "#ef4444",
                      "#06b6d4",
                    ],
                  },
                ],
              },
              options: {
                responsive: true,
                plugins: { legend: { position: "right" } },
              },
            });
          }

          if (ctx2) {
            new Chart(ctx2, {
              type: "line",
              data: {
                labels: [
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ],
                datasets: [
                  {
                    label: "Employees",
                    data: Array(12).fill(data.data.total_employees || 0),
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(59,130,246,0.1)",
                    fill: true,
                    tension: 0.4,
                  },
                ],
              },
              options: { responsive: true },
            });
          }

          if (ctx3 && data.data.leaves) {
            new Chart(ctx3, {
              type: "bar",
              data: {
                labels: ["Approved", "Pending", "Rejected"],
                datasets: [
                  {
                    data: [
                      data.data.leaves.approved || 0,
                      data.data.leaves.pending || 0,
                      0,
                    ],
                    backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
                  },
                ],
              },
              options: {
                responsive: true,
                plugins: { legend: { display: false } },
              },
            });
          }

          if (ctx4 && data.data.tasks) {
            const completionRate =
              data.data.tasks.total > 0
                ? Math.round(
                    (data.data.tasks.completed / data.data.tasks.total) * 100,
                  )
                : 0;
            new Chart(ctx4, {
              type: "doughnut",
              data: {
                labels: ["Completed", "In Progress", "Pending"],
                datasets: [
                  {
                    data: [
                      data.data.tasks.completed || 0,
                      data.data.tasks.in_progress || 0,
                      data.data.tasks.pending || 0,
                    ],
                    backgroundColor: ["#10b981", "#3b82f6", "#fbbf24"],
                  },
                ],
              },
              options: {
                responsive: true,
                plugins: {
                  legend: { position: "bottom" },
                  title: {
                    display: true,
                    text: `Completion Rate: ${completionRate}%`,
                  },
                },
                cutout: "65%",
              },
            });
          }
        }
      })
      .catch((error) => console.error("Error fetching analytics data:", error));
  }

  // REPORTS CHARTS
  function initReportsCharts() {
    const ctx1 = document.getElementById("attendanceTrendChart");
    const ctx2 = document.getElementById("leaveTypeChart");

    if (ctx1)
      new Chart(ctx1, {
        type: "line",
        data: {
          labels: [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ],
          datasets: [
            {
              label: "Attendance %",
              data: [92, 94, 93, 95, 94, 96, 95, 94, 93, 95, 96, 94],
              borderColor: "#10b981",
              backgroundColor: "rgba(16,185,129,0.1)",
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: { responsive: true },
      });
    if (ctx2)
      new Chart(ctx2, {
        type: "pie",
        data: {
          labels: ["Sick", "Casual", "Paid", "Emergency"],
          datasets: [
            {
              data: [30, 35, 25, 10],
              backgroundColor: ["#ef4444", "#3b82f6", "#10b981", "#f59e0b"],
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "right" } },
        },
      });
  }
})();
