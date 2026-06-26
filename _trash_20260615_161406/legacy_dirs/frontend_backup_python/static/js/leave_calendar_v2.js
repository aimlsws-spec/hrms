
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
// Enhanced Leave Calendar with Holidays, Sundays, 2nd/4th Saturdays
(function () {
  var currentYear = new Date().getFullYear();
  var currentMonth = new Date().getMonth() + 1;
  var months = [
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

  function loadLeaveCalendar(y, m) {
    var u = JSON.parse(localStorage.getItem("hrms_user") || "{}");
    if (!u.user_id) return;

    y = y || currentYear;
    m = m || currentMonth;

    var headerEl = document.getElementById("calendarHeader");
    if (headerEl)
      headerEl.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><button onclick="window.prevMonth()" style="background:#f1f5f9;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:600;">◀</button><span style="font-weight:600;color:#1e293b;">' +
        months[m - 1] +
        " " +
        y +
        '</span><button onclick="window.nextMonth()" style="background:#f1f5f9;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:600;">▶</button></div>';

    fetch("/api/leave/calendar/" +
        u.user_id +
        "?year=" +
        y +
        "&month=" +
        m)
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data.success) return;

        var days = new Date(y, m, 0).getDate();
        var first = new Date(y, m - 1, 1).getDay();
        var html = "";

        for (var i = 0; i < first; i++)
          html += '<div style="opacity:0.3;"></div>';

        for (var day = 1; day <= days; day++) {
          var dt = new Date(y, m - 1, day);
          var dow = dt.getDay();
          var bg = "#fff",
            col = "#1e293b",
            border = "1px solid #e2e8f0",
            tooltip = "",
            icon = "";
          var isLeave = false,
            isHoliday = false;

          // Priority 1: Employee leaves
          if (data.leaves && data.leaves.length > 0) {
            for (var k = 0; k < data.leaves.length; k++) {
              var s = new Date(data.leaves[k].start_date);
              var e = new Date(data.leaves[k].end_date);
              s.setHours(0, 0, 0, 0);
              e.setHours(23, 59, 59, 999);
              dt.setHours(12, 0, 0, 0);

              if (dt >= s && dt <= e) {
                if (data.leaves[k].status === "Approved") {
                  bg = "#dcfce7";
                  col = "#166534";
                  border = "2px solid #22c55e";
                  icon = "✓";
                  tooltip = data.leaves[k].leave_type + " (Approved)";
                } else if (data.leaves[k].status === "Pending") {
                  bg = "#fef9c3";
                  col = "#854d0e";
                  border = "2px solid #eab308";
                  icon = "⏳";
                  tooltip = data.leaves[k].leave_type + " (Pending)";
                } else if (data.leaves[k].status === "Rejected") {
                  bg = "#fee2e2";
                  col = "#991b1b";
                  border = "2px solid #ef4444";
                  icon = "✗";
                  tooltip = data.leaves[k].leave_type + " (Rejected)";
                }
                isLeave = true;
                break;
              }
            }
          }

          // Priority 2: Company holidays
          if (!isLeave && data.holidays && data.holidays.length > 0) {
            for (var j = 0; j < data.holidays.length; j++) {
              var hDate = data.holidays[j].holiday_date;
              if (typeof hDate === "string") {
                var parts = hDate.split("-");
                if (
                  parseInt(parts[0]) === y &&
                  parseInt(parts[1]) === m &&
                  parseInt(parts[2]) === day
                ) {
                  bg = "#fce7f3";
                  col = "#831843";
                  border = "2px solid #ec4899";
                  icon = "🎉";
                  tooltip = data.holidays[j].holiday_name || "Holiday";
                  isHoliday = true;
                  break;
                }
              }
            }
          }

          // Priority 3: Sundays
          if (!isLeave && !isHoliday && dow === 0) {
            bg = "#fee2e2";
            col = "#991b1b";
            border = "2px solid #ef4444";
            icon = "☀️";
            tooltip = "Sunday";
            isHoliday = true;
          }

          // Priority 4: 2nd & 4th Saturdays
          if (
            !isLeave &&
            !isHoliday &&
            data.saturdays &&
            data.saturdays.indexOf(day) >= 0
          ) {
            bg = "#fef3c7";
            col = "#92400e";
            border = "2px solid #f59e0b";
            icon = "🏖️";
            tooltip = "2nd/4th Saturday";
            isHoliday = true;
          }

          html +=
            '<div title="' +
            tooltip +
            '" style="background:' +
            bg +
            ";color:" +
            col +
            ";padding:8px;border-radius:8px;font-size:13px;font-weight:600;min-height:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:" +
            border +
            ";cursor:pointer;transition:all 0.2s;\" onmouseover=\"this.style.transform='scale(1.05)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'\" onmouseout=\"this.style.transform='scale(1)';this.style.boxShadow='none'\">" +
            (icon
              ? '<span style="font-size:10px;margin-bottom:2px;">' +
                icon +
                "</span>"
              : "") +
            "<span>" +
            day +
            "</span></div>";
        }

        var el = document.getElementById("calendarDays");
        if (el) el.innerHTML = html;
      })
      .catch(function (e) {
        console.error("Calendar error:", e);
      });
  }

  window.prevMonth = function () {
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
    loadLeaveCalendar(currentYear, currentMonth);
  };

  window.nextMonth = function () {
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    loadLeaveCalendar(currentYear, currentMonth);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(function () {
        loadLeaveCalendar(currentYear, currentMonth);
      }, 2000);
    });
  } else {
    setTimeout(function () {
      loadLeaveCalendar(currentYear, currentMonth);
    }, 2000);
  }
})();
