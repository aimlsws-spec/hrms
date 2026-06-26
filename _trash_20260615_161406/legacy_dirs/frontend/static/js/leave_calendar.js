
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
// Leave Calendar - Simplified and Robust
(function () {
  let currentCalendarMonth = new Date().getMonth() + 1;
  let currentCalendarYear = new Date().getFullYear();

  window.loadLeaveCalendar = function () {
    const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
    if (!user || !user.user_id) {
      console.log("No user found for calendar");
      return;
    }

    fetch(`/api/leave/calendar/${user.user_id}?year=${currentCalendarYear}&month=${currentCalendarMonth}`)
      .then((r) => r.json())
      .then((data) => {
        console.log("Calendar API Response:", data);
        if (data.success) {
          renderCalendar(data, currentCalendarYear, currentCalendarMonth);
        }
      })
      .catch((e) => console.error("Calendar error:", e));
  };

  function renderCalendar(data, year, month) {
    const container = document.getElementById("leaveCalendarContainer");
    if (!container) {
      console.log("Calendar container not found");
      return;
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    let html = `<div style="background: white; border-radius: 12px; padding: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
                <button onclick="changeMonth(-1)" style="background: #f1f5f9; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">◀</button>
                <h4 style="margin: 0;">${monthNames[month - 1]} ${year}</h4>
                <button onclick="changeMonth(1)" style="background: #f1f5f9; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">▶</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center;">
                <div style="font-weight: 600; font-size: 12px; color: #64748b; padding: 8px 0;">Sun</div>
                <div style="font-weight: 600; font-size: 12px; color: #64748b; padding: 8px 0;">Mon</div>
                <div style="font-weight: 600; font-size: 12px; color: #64748b; padding: 8px 0;">Tue</div>
                <div style="font-weight: 600; font-size: 12px; color: #64748b; padding: 8px 0;">Wed</div>
                <div style="font-weight: 600; font-size: 12px; color: #64748b; padding: 8px 0;">Thu</div>
                <div style="font-weight: 600; font-size: 12px; color: #64748b; padding: 8px 0;">Fri</div>
                <div style="font-weight: 600; font-size: 12px; color: #64748b; padding: 8px 0;">Sat</div>`;

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      html += "<div></div>";
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();

      let bg = "#ffffff",
        color = "#1e293b",
        tooltip = "";

      // Sunday
      if (dayOfWeek === 0) {
        bg = "#fee2e2";
        color = "#991b1b";
        tooltip = "Sunday";
      }

      // 2nd/4th Saturday
      if (data.saturdays && data.saturdays.includes(day)) {
        bg = "#fef3c7";
        color = "#92400e";
        tooltip = "2nd/4th Saturday";
      }

      // Holidays
      if (data.holidays) {
        const holiday = data.holidays.find((h) => {
          const hd = new Date(h.date);
          return (
            hd.getFullYear() === year &&
            hd.getMonth() + 1 === month &&
            hd.getDate() === day
          );
        });
        if (holiday) {
          bg = "#dbeafe";
          color = "#1e40af";
          tooltip = holiday.name;
        }
      }

      // Leaves
      if (data.leaves) {
        const leave = data.leaves.find((l) => {
          const start = new Date(l.start_date);
          const end = new Date(l.end_date);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          date.setHours(12, 0, 0, 0);
          return date >= start && date <= end;
        });
        if (leave) {
          if (leave.status === "Approved") {
            bg = "#dcfce7";
            color = "#166534";
            tooltip = leave.leave_type + " (Approved)";
          } else if (leave.status === "Pending") {
            bg = "#fef9c3";
            color = "#854d0e";
            tooltip = leave.leave_type + " (Pending)";
          }
        }
      }

      html += `<div style="background: ${bg}; color: ${color}; padding: 8px; border-radius: 6px; font-size: 14px; font-weight: 500; min-height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="${tooltip}">${day}</div>`;
    }

    html += `</div>
            <div style="margin-top: 16px; display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px;">
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 16px; height: 16px; background: #fee2e2; border-radius: 3px;"></div>
                    <span>Sunday</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 16px; height: 16px; background: #fef3c7; border-radius: 3px;"></div>
                    <span>2nd/4th Sat</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 16px; height: 16px; background: #dbeafe; border-radius: 3px;"></div>
                    <span>Holiday</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 16px; height: 16px; background: #dcfce7; border-radius: 3px;"></div>
                    <span>Leave (Approved)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 16px; height: 16px; background: #fef9c3; border-radius: 3px;"></div>
                    <span>Leave (Pending)</span>
                </div>
            </div>
        </div>`;

    container.innerHTML = html;
  }

  window.changeMonth = function (delta) {
    currentCalendarMonth += delta;
    if (currentCalendarMonth > 12) {
      currentCalendarMonth = 1;
      currentCalendarYear++;
    } else if (currentCalendarMonth < 1) {
      currentCalendarMonth = 12;
      currentCalendarYear--;
    }
    loadLeaveCalendar();
  };

  // Auto-load
  setTimeout(() => {
    loadLeaveCalendar();
  }, 1500);
})();
