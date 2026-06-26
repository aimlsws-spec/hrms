
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
// ==================== GPS ATTENDANCE FUNCTIONS ====================

function markGPSAttendance() {
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  if (params.toString()) url += "?" + params.toString();
} else {
  document.getElementById("gpsStartDate").value = "";
  document.getElementById("gpsEndDate").value = "";
}

fetch(url)
  .then((r) => r.json())
  .then((data) => {
    if (data.success && data.records) {
      let html = "<h3>All GPS Punch Records</h3>";
      html +=
        '<table style="width: 100%; border-collapse: collapse;"><tr><th>Employee</th><th>Punch Type</th><th>Date & Time</th><th>Distance</th><th>Status</th></tr>';
      data.records.forEach((r) => {
        const status = r.is_valid ? "✅ Valid" : "⚠️ Invalid";
        const punchType = r.punch_type === "IN" ? "🟢 IN" : "🔴 OUT";
        const distance = r.distance_meters
          ? Math.round(r.distance_meters) + "m"
          : "-";
        html += `<tr>
                        <td>${r.employee_name || r.employee_id}</td>
                        <td>${punchType}</td>
                        <td>${new Date(r.punch_time).toLocaleString()}</td>
                        <td>${distance}</td>
                        <td>${status}</td>
                    </tr>`;
      });
      html += "</table>";
      document.getElementById("gpsTableResults").innerHTML = html;
    } else {
      document.getElementById("gpsTableResults").innerHTML =
        "<p>No GPS attendance records found.</p>";
    }
  });
}

function viewMyGPSAttendance() {
  fetch(`/api/attendance/gps/employee/${currentUser.user_id}`)
    .then((r) => r.json())
    .then((data) => {
      if (data.success && data.records) {
        let html = "<h3>My GPS Attendance Records</h3>";
        html +=
          '<table style="width: 100%; border-collapse: collapse;"><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr>';
        data.records.forEach((r) => {
          const hours =
            r.check_in_time && r.check_out_time
              ? (
                (new Date(r.check_out_time) - new Date(r.check_in_time)) /
                3600000
              ).toFixed(2)
              : "-";
          const status = r.is_within_geofence ? "✅" : "⚠️";
          html += `<tr>
                        <td>${r.attendance_date}</td>
                        <td>${r.check_in_time || "-"}</td>
                        <td>${r.check_out_time || "-"}</td>
                        <td>${hours}h</td>
                        <td>${status}</td>
                    </tr>`;
        });
        html += "</table>";
        displayResults("gpsResults", html);
      } else {
        displayResults("gpsResults", "<p>No GPS attendance records found.</p>");
      }
    });
}

function manageOfficeLocations() {
  fetch("/api/geofence/locations")
    .then((r) => r.json())
    .then((data) => {
      if (data.success && data.locations) {
        let html = "<h3>Office Locations</h3>";
        html +=
          '<table style="width: 100%; border-collapse: collapse;"><tr><th>Location</th><th>Coordinates</th><th>Radius</th><th>Status</th></tr>';
        data.locations.forEach((loc) => {
          html += `<tr>
                        <td>${loc.location_name}</td>
                        <td>${loc.latitude}, ${loc.longitude}</td>
                        <td>${loc.radius_meters}m</td>
                        <td>${loc.is_active ? "✅ Active" : "❌ Inactive"}</td>
                    </tr>`;
        });
        html += "</table>";
        displayResults("gpsResults", html);
      } else {
        displayResults("gpsResults", "<p>No office locations configured.</p>");
      }
    });
}

// ==================== SHIFT MANAGEMENT FUNCTIONS ====================

function createShift() {
  const html = `
        <h3>Create New Shift</h3>
        <form id="createShiftForm" style="max-width: 600px;">
            <div style="margin-bottom: 15px;">
                <label>Shift Name:</label>
                <input type="text" id="shiftName" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db;">
            </div>
            <div style="margin-bottom: 15px;">
                <label>Shift Type:</label>
                <select id="shiftType" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db;">
                    <option value="Regular">Regular</option>
                    <option value="Rotating">Rotating</option>
                    <option value="Overnight">Overnight</option>
                    <option value="Flexible">Flexible</option>
                </select>
            </div>
            <div style="margin-bottom: 15px;">
                <label>Start Time:</label>
                <input type="time" id="startTime" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db;">
            </div>
            <div style="margin-bottom: 15px;">
                <label>End Time:</label>
                <input type="time" id="endTime" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db;">
            </div>
            <div style="margin-bottom: 15px;">
                <label>Break Duration (minutes):</label>
                <input type="number" id="breakDuration" value="60" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db;">
            </div>
            <button type="submit" class="btn btn-primary">Create Shift</button>
        </form>
    `;
  displayResults("shiftResults", html);

  document
    .getElementById("createShiftForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      fetch("/api/shifts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_name: document.getElementById("shiftName").value,
          shift_type: document.getElementById("shiftType").value,
          start_time: document.getElementById("startTime").value,
          end_time: document.getElementById("endTime").value,
          break_duration: document.getElementById("breakDuration").value,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            displayResults(
              "shiftResults",
              '<div style="background: #d1fae5; padding: 20px; border-radius: 8px;"><h3 style="color: #065f46;">✅ Shift Created Successfully</h3></div>');
            setTimeout(viewAllShifts, 1500);
          } else {
            displayResults(
              "shiftResults",
              `<p style="color: #ef4444;">Error: ${data.message}</p>`,
            );
          }
        });
    });
}

function viewAllShifts() {
  // Helper to format time
  const formatTime = (time) => {
    if (typeof time === "string" && time.includes(":")) return time;
    if (typeof time === "number" || !isNaN(time)) {
      const seconds = parseInt(time);
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    }
    return time;
  };

  fetch("/api/shifts/all")
    .then((r) => r.json())
    .then((data) => {
      if (data.success && data.shifts) {
        let html = "<h3>All Shifts</h3>";
        html +=
          '<table style="width: 100%; border-collapse: collapse;"><tr><th>Shift Name</th><th>Type</th><th>Timing</th><th>Break</th><th>Status</th></tr>';
        data.shifts.forEach((s) => {
          html += `<tr>
                        <td>${s.shift_name}</td>
                        <td>${s.shift_type}</td>
                        <td>${formatTime(s.start_time)} - ${formatTime(s.end_time)}</td>
                        <td>${s.break_duration} min</td>
                        <td>${s.is_active ? "✅ Active" : "❌ Inactive"}</td>
                    </tr>`;
        });
        html += "</table>";
        displayResults("shiftResults", html);
      } else {
        displayResults("shiftResults", "<p>No shifts found.</p>");
      }
    })
    .catch(() => { });
}

function assignShift() {
  const html = `
        <h3>Assign Shift to Employee</h3>
        <form id="assignShiftForm" style="max-width: 600px;">
            <div style="margin-bottom: 15px;">
                <label>Employee:</label>
                <select id="empId" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db;">
                    <option value="">Loading employees...</option>
                </select>
            </div>
            <div style="margin-bottom: 15px;">
                <label>Shift:</label>
                <select id="shiftId" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db;">
                    <option value="">Loading shifts...</option>
                </select>
            </div>
            <div style="margin-bottom: 15px;">
                <label>Effective Date:</label>
                <input type="date" id="effectiveDate" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db;">
            </div>
            <button type="submit" class="btn btn-primary">Assign Shift</button>
        </form>
    `;
  displayResults("shiftResults", html);

  // Load employees for dropdown
  fetch("/api/users")
    .then((r) => r.json())
    .then((data) => {
      if (data.success && data.users) {
        const select = document.getElementById("empId");
        select.innerHTML =
          '<option value="">Select Employee</option>' +
          data.users
            .map(
              (u) =>
                `<option value="${u.user_id}">${u.user_id} - ${u.full_name}</option>`)
            .join("");
      }
    });

  // Load shifts for dropdown
  fetch("/api/shifts/all")
    .then((r) => r.json())
    .then((data) => {
      if (data.success && data.shifts) {
        const select = document.getElementById("shiftId");
        select.innerHTML =
          '<option value="">Select Shift</option>' +
          data.shifts
            .map((s) => `<option value="${s.id}">${s.shift_name}</option>`)
            .join("");
      }
    })
    .catch(() => { });

  document
    .getElementById("assignShiftForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      fetch("/api/shifts/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: document.getElementById("empId").value,
          shift_id: document.getElementById("shiftId").value,
          effective_date: document.getElementById("effectiveDate").value,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            displayResults(
              "shiftResults",
              '<div style="background: #d1fae5; padding: 20px; border-radius: 8px;"><h3 style="color: #065f46;">✅ Shift Assigned Successfully</h3></div>');
          } else {
            displayResults(
              "shiftResults",
              `<p style="color: #ef4444;">Error: ${data.message}</p>`,
            );
          }
        });
    });
}

function viewMyShift() {
  const formatTime = (time) => {
    if (typeof time === "string" && time.includes(":")) return time;
    if (typeof time === "number" || !isNaN(time)) {
      const seconds = parseInt(time);
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    }
    return time;
  };

  fetch(`/api/shifts/employee/${currentUser.user_id}`)
    .then((r) => r.json())
    .then((data) => {
      if (data.success && (data.shift || data.shifts)) {
        // Handle both single shift and array of shifts
        const shifts = data.shifts || [data.shift];
        let html = "<h3>My Current Shift(s)</h3>";

        shifts.forEach((s) => {
          html += `
                        <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 20px; margin-bottom: 15px;">
                            <h4 style="color: #1e40af; margin: 0 0 12px 0;">${s.shift_name}</h4>
                            <p><strong>Type:</strong> ${s.shift_type}</p>
                            <p><strong>Timing:</strong> ${formatTime(s.start_time)} - ${formatTime(s.end_time)}</p>
                            <p><strong>Break:</strong> ${s.break_duration} minutes</p>
                            <p><strong>Effective From:</strong> ${s.effective_date || "N/A"}</p>
                        </div>
                    `;
        });
        displayResults("shiftResults", html);
      } else {
        displayResults("shiftResults", "<p>No shift assigned to you.</p>");
      }
    })
    .catch((err) => {
      displayResults(
        "shiftResults",
        '<p style="color: #ef4444;">Error loading shift data.</p>',
      );
    });
}

// ==================== ATTENDANCE REGULARIZATION FUNCTIONS ====================

function requestRegularization() {
  const html = `
        <h3>Request Attendance Regularization</h3>
        <form id="regularizationForm" style="max-width: 600px;">
            <div style="margin-bottom: 15px;">
                <label>Attendance Date:</label>
                <input type="date" id="attDate" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db;">
            </div>
            <div style="margin-bottom: 15px;">
                <label>Requested Check-In Time:</label>
                <input type="time" id="reqCheckIn" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db;">
            </div>
            <div style="margin-bottom: 15px;">
                <label>Requested Check-Out Time:</label>
                <input type="time" id="reqCheckOut" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db;">
            </div>
            <div style="margin-bottom: 15px;">
                <label>Reason:</label>
                <textarea id="reason" required rows="4" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db;"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Submit Request</button>
        </form>
    `;
  displayResults("regularizationResults", html);

  document
    .getElementById("regularizationForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      fetch("/api/attendance/regularization/request",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: currentUser.user_id,
            attendance_date: document.getElementById("attDate").value,
            requested_check_in: document.getElementById("reqCheckIn").value,
            requested_check_out: document.getElementById("reqCheckOut").value,
            reason: document.getElementById("reason").value,
          }),
        })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            displayResults(
              "regularizationResults",
              '<div style="background: #d1fae5; padding: 20px; border-radius: 8px;"><h3 style="color: #065f46;">✅ Regularization Request Submitted</h3><p>Your request will be reviewed by your manager.</p></div>',
            );
          } else {
            displayResults(
              "regularizationResults",
              `<p style="color: #ef4444;">Error: ${data.message}</p>`,
            );
          }
        });
    });
}

function viewPendingRegularizations() {
  fetch("/api/attendance/regularization/pending")
    .then((r) => r.json())
    .then((data) => {
      if (data.success && data.requests && data.requests.length > 0) {
        let html = "<h3>Pending Regularization Requests</h3>";
        html +=
          '<table style="width: 100%; border-collapse: collapse;"><tr><th>Employee</th><th>Date</th><th>Requested Time</th><th>Reason</th><th>Action</th></tr>';
        data.requests.forEach((r) => {
          html += `<tr>
                        <td>${r.employee_name || r.employee_id}</td>
                        <td>${r.attendance_date}</td>
                        <td>${r.requested_check_in} - ${r.requested_check_out}</td>
                        <td>${r.reason}</td>
                        <td><button onclick="approveRegularization(${r.id})" class="btn btn-sm btn-success">Approve</button></td>
                    </tr>`;
        });
        html += "</table>";
        displayResults("regularizationResults", html);
      } else {
        displayResults(
          "regularizationResults",
          "<p>No pending regularization requests.</p>",
        );
      }
    });
}

function approveRegularization(requestId) {
  if (confirm("Approve this regularization request?")) {
    fetch(`/api/attendance/regularization/approve/${requestId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved_by: currentUser.user_id,
          comments: "Approved",
        }),
      })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          alert("✅ Regularization approved successfully!");
          viewPendingRegularizations();
        } else {
          alert("Error: " + data.message);
        }
      });
  }
}

function viewMyRegularizations() {
  fetch(`/api/attendance/regularization/employee/${currentUser.user_id}`)
    .then((r) => r.json())
    .then((data) => {
      if (data.success && data.requests) {
        let html = "<h3>My Regularization Requests</h3>";
        html +=
          '<table style="width: 100%; border-collapse: collapse;"><tr><th>Date</th><th>Requested Time</th><th>Reason</th><th>Status</th></tr>';
        data.requests.forEach((r) => {
          const statusColor =
            r.status === "Approved"
              ? "#10b981"
              : r.status === "Rejected"
                ? "#ef4444"
                : "#f59e0b";
          html += `<tr>
                        <td>${r.attendance_date}</td>
                        <td>${r.requested_check_in} - ${r.requested_check_out}</td>
                        <td>${r.reason}</td>
                        <td style="color: ${statusColor}; font-weight: 600;">${r.status}</td>
                    </tr>`;
        });
        html += "</table>";
        displayResults("regularizationResults", html);
      } else {
        displayResults(
          "regularizationResults",
          "<p>No regularization requests found.</p>",
        );
      }
    });
}

// Aliases for HTML onclick handlers
function viewMyRegularizationRequests() {
  viewMyRegularizations();
}
function viewAllRegularizationRequests() {
  viewPendingRegularizations();
}
function viewPendingRegularizationRequests() {
  viewPendingRegularizations();
}

// Alias for My Shifts (employees)
function viewMyShifts() {
  viewMyShift();
}

// Additional aliases for shift management
function viewEmployeeShifts() {
  const formatTime = (time) => {
    if (typeof time === "string" && time.includes(":")) return time;
    if (typeof time === "number" || !isNaN(time)) {
      const seconds = parseInt(time);
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    }
    return time;
  };

  const empId = prompt("Enter Employee ID:");
  if (empId) {
    fetch(`/api/shifts/employee/${empId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && (data.shift || data.shifts)) {
          // Handle both single shift and array of shifts
          const shifts = data.shifts || [data.shift];
          let html = `<h3>Shift Details for ${empId}</h3>`;

          shifts.forEach((s) => {
            html += `
                            <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 20px; margin-bottom: 15px;">
                                <h4 style="color: #1e40af; margin: 0 0 12px 0;">${s.shift_name}</h4>
                                <p><strong>Type:</strong> ${s.shift_type}</p>
                                <p><strong>Timing:</strong> ${formatTime(s.start_time)} - ${formatTime(s.end_time)}</p>
                                <p><strong>Break:</strong> ${s.break_duration} minutes</p>
                                <p><strong>Effective From:</strong> ${s.effective_date || "N/A"}</p>
                            </div>
                        `;
          });
          displayResults("shiftResults", html);
        } else {
          displayResults(
            "shiftResults",
            "<p>No shift assigned to this employee.</p>");
        }
      })
      .catch((err) => {
        displayResults(
          "shiftResults",
          '<p style="color: #ef4444;">Error loading shift data.</p>',
        );
      });
  }
}
