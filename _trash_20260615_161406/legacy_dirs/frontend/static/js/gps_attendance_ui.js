
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
// GPS Attendance UI Functions
console.log("GPS Attendance UI loaded successfully");

// Mark GPS Attendance
function markGPSAttendance() {
  console.log("markGPSAttendance called");
  const userData = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  if (userData.role === "admin") {
    document.getElementById("gpsResults").innerHTML = `
            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px;">
                <h3 style="color: #b45309; margin: 0 0 12px 0;">⚠️ Access Restricted</h3>
                <p style="margin: 0; color: #92400e;">Administrators cannot mark attendance. This feature is only available for employees and HR staff.</p>
            </div>
        `;
    return;
  }

  const empId = userData.user_id || userData.username || "";

  const html = `
        <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
            <h3 style="margin: 0 0 20px 0; color: #1e293b;"><i class="fas fa-map-marker-alt"></i> Mark GPS Attendance</h3>
            <div id="gpsStatus" style="padding: 12px; background: #eff6ff; border-radius: 6px; margin-bottom: 16px;">
                <p style="margin: 0; color: #1d4ed8;">🔄 Getting your location...</p>
            </div>
            <form id="gpsAttendanceForm" style="display: grid; gap: 16px; display: none;">
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Employee ID *</label>
                    <input type="text" id="gpsEmpId" value="${empId}" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Latitude</label>
                        <input type="text" id="latitude" readonly style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f9fafb;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Longitude</label>
                        <input type="text" id="longitude" readonly style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f9fafb;">
                    </div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Attendance Type *</label>
                    <select id="attendanceType" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <option value="in">Check In</option>
                        <option value="out">Check Out</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary">Mark Attendance</button>
            </form>
        </div>
    `;

  document.getElementById("gpsResults").innerHTML = html;

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        document.getElementById("latitude").value =
          position.coords.latitude.toFixed(6);
        document.getElementById("longitude").value =
          position.coords.longitude.toFixed(6);
        document.getElementById("gpsStatus").innerHTML =
          '<p style="margin: 0; color: #15803d;">✅ Location obtained successfully!</p>';
        document.getElementById("gpsAttendanceForm").style.display = "grid";
      },
      (error) => {
        document.getElementById("gpsStatus").innerHTML =
          '<p style="margin: 0; color: #dc2626;">❌ Error getting location: ' +
          error.message +
          "</p>";
      },
    );
  } else {
    document.getElementById("gpsStatus").innerHTML =
      '<p style="margin: 0; color: #dc2626;">❌ Geolocation not supported by browser</p>';
  }

  setTimeout(() => {
    const form = document.getElementById("gpsAttendanceForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {
          employee_id: document.getElementById("gpsEmpId").value.toLowerCase(),
          latitude: parseFloat(document.getElementById("latitude").value),
          longitude: parseFloat(document.getElementById("longitude").value),
          punch_type: document
            .getElementById("attendanceType")
            .value.toUpperCase(),
          device_info: navigator.userAgent,
        };

        try {
          const response = await fetch("/api/gps-attendance/punch",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
          const result = await response.json();

          if (result.success) {
            alert("✅ Attendance marked successfully!");
            viewMyGPSAttendance();
          } else {
            alert("❌ Error: " + result.message);
          }
        } catch (error) {
          alert("❌ Error: " + error.message);
        }
      });
    }
  }, 100);
}

async function viewGPSAttendance() {
  console.log("viewGPSAttendance called");
  alert("Admin view called");
  document.getElementById("gpsResults").innerHTML =
    '<p style="color: #64748b;">Loading GPS attendance records...</p>';

  try {
    const response = await fetch("/api/gps-attendance/history/all");
    const result = await response.json();

    if (result.success && result.records && result.records.length > 0) {
      let html = `
                <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 20px 0;"><i class="fas fa-map-marker-alt"></i> GPS Attendance Records</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 12px; text-align: left;">Employee ID</th>
                                <th style="padding: 12px; text-align: left;">Date</th>
                                <th style="padding: 12px; text-align: left;">Time</th>
                                <th style="padding: 12px; text-align: left;">Type</th>
                                <th style="padding: 12px; text-align: left;">Location</th>
                                <th style="padding: 12px; text-align: left;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

      result.records.forEach((record) => {
        const statusColor = record.is_valid ? "#22c55e" : "#ef4444";
        const statusBg = record.is_valid ? "#dcfce7" : "#fee2e2";

        html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px; font-weight: 600;">${record.employee_id}</td>
                        <td style="padding: 12px;">${new Date(record.punch_time).toLocaleDateString()}</td>
                        <td style="padding: 12px;">${new Date(record.punch_time).toLocaleTimeString()}</td>
                        <td style="padding: 12px;">${record.punch_type}</td>
                        <td style="padding: 12px; font-size: 11px;">${record.latitude}, ${record.longitude}</td>
                        <td style="padding: 12px;">
                            <span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                ${record.is_valid ? "Valid" : "Out of Range"}
                            </span>
                        </td>
                    </tr>
                `;
      });

      html += "</tbody></table></div>";
      document.getElementById("gpsResults").innerHTML = html;
    } else {
      document.getElementById("gpsResults").innerHTML =
        '<p style="color: #64748b;">No GPS attendance records found.</p>';
    }
  } catch (error) {
    document.getElementById("gpsResults").innerHTML =
      '<p style="color: #ef4444;">Error loading records: ' +
      error.message +
      "</p>";
  }
}

async function viewMyGPSAttendance() {
  console.log("viewMyGPSAttendance called");
  alert("Function called - checking data...");
  const userData = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  const empId = (userData.user_id || userData.username || "").toLowerCase();

  console.log("User data:", userData);
  console.log("Employee ID (lowercase):", empId);

  if (!empId) {
    alert("Employee ID not found in localStorage");
    return;
  }

  document.getElementById("gpsResults").innerHTML =
    '<p style="color: #64748b;">Loading attendance for: ' + empId + "...</p>";

  try {
    const response = await fetch(`/api/attendance/gps/employee/${empId}`);
    const result = await response.json();

    if (result.success && result.records && result.records.length > 0) {
      let html = `
                <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 20px 0;"><i class="fas fa-map-marker-alt"></i> My GPS Attendance</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f5f9;">
                                <th style="padding: 12px; text-align: left;">Date</th>
                                <th style="padding: 12px; text-align: left;">Time</th>
                                <th style="padding: 12px; text-align: left;">Type</th>
                                <th style="padding: 12px; text-align: left;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

      result.records.forEach((record) => {
        const statusColor = record.is_valid ? "#22c55e" : "#ef4444";
        const statusBg = record.is_valid ? "#dcfce7" : "#fee2e2";
        const punchTime = record.punch_time
          ? new Date(record.punch_time)
          : null;

        html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px;">${punchTime ? punchTime.toLocaleDateString() : "N/A"}</td>
                        <td style="padding: 12px;">${punchTime ? punchTime.toLocaleTimeString() : "N/A"}</td>
                        <td style="padding: 12px;">${record.punch_type || "N/A"}</td>
                        <td style="padding: 12px;">
                            <span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                ${record.is_valid ? "✅ Valid" : "❌ Out of Range"}
                            </span>
                        </td>
                    </tr>
                `;
      });

      html += "</tbody></table></div>";
      document.getElementById("gpsResults").innerHTML = html;
    } else {
      document.getElementById("gpsResults").innerHTML = `
                <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px;">
                    <h3 style="color: #b45309; margin: 0 0 12px 0;">⚠️ No Records Found</h3>
                    <p style="margin: 0 0 8px 0; color: #92400e;">No GPS attendance records found for: <strong>${empId}</strong></p>
                    <p style="margin: 0; color: #92400e; font-size: 13px;">Please mark your attendance first using "Mark Attendance".</p>
                </div>
            `;
    }
  } catch (error) {
    document.getElementById("gpsResults").innerHTML =
      '<p style="color: #ef4444;">Error loading records: ' +
      error.message +
      "</p>";
  }
}

function manageOfficeLocations() {
  const html = `
        <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
            <h3 style="margin: 0 0 20px 0;"><i class="fas fa-building"></i> Manage Office Locations</h3>
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 12px 0; color: #1e40af;"><i class="fas fa-map-marker-alt"></i> Quick Setup</h4>
                <p style="margin: 0 0 12px 0; color: #1e3a8a; font-size: 14px;">Set your current location as Head Office (100m radius)</p>
                <button onclick="setCurrentAsOffice()" class="btn btn-primary" style="background: #10b981; margin-right: 10px;">
                    <i class="fas fa-map-marker-alt"></i> Use My Current Location
                </button>
                <button onclick="manualLocationInput()" class="btn btn-secondary">
                    <i class="fas fa-keyboard"></i> Enter Manually
                </button>
            </div>
            <form id="officeLocationForm" style="display: grid; gap: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Location Name *</label>
                    <input type="text" id="locationName" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Latitude *</label>
                        <input type="number" step="0.000001" id="locLatitude" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Longitude *</label>
                        <input type="number" step="0.000001" id="locLongitude" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    </div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Radius (meters) *</label>
                    <input type="number" id="radius" value="100" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                </div>
                <button type="submit" class="btn btn-primary">Add Location</button>
            </form>
        </div>
    `;

  document.getElementById("gpsResults").innerHTML = html;

  document
    .getElementById("officeLocationForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        location_name: document.getElementById("locationName").value,
        latitude: parseFloat(document.getElementById("locLatitude").value),
        longitude: parseFloat(document.getElementById("locLongitude").value),
        radius: parseInt(document.getElementById("radius").value),
      };

      try {
        const response = await fetch("/api/gps-attendance/location/add",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
        const result = await response.json();

        if (result.success) {
          alert("✅ Office location added successfully!");
          viewOfficeLocations();
        } else {
          alert("❌ Error: " + result.message);
        }
      } catch (error) {
        alert("❌ Error: " + error.message);
      }
    });
}

function setCurrentAsOffice() {
  if (!navigator.geolocation) {
    alert("❌ Geolocation not supported by your browser");
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting location...';

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      try {
        const response = await fetch("/api/gps-attendance/set-current-as-office",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: lat, longitude: lon }),
          });
        const result = await response.json();

        if (result.success) {
          alert(
            `✅ Head Office location set successfully!\n\nLatitude: ${lat.toFixed(6)}\nLongitude: ${lon.toFixed(6)}\nRadius: 100 meters\n\nEmployees within 100m can now mark attendance.`,
          );
          viewOfficeLocations();
        } else {
          alert("❌ Error: " + result.message);
          btn.disabled = false;
          btn.innerHTML =
            '<i class="fas fa-map-marker-alt"></i> Use My Current Location';
        }
      } catch (error) {
        alert("❌ Error: " + error.message);
        btn.disabled = false;
        btn.innerHTML =
          '<i class="fas fa-map-marker-alt"></i> Use My Current Location';
      }
    },
    (error) => {
      alert("❌ Error getting location: " + error.message);
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fas fa-map-marker-alt"></i> Use My Current Location';
    },
  );
}

function manualLocationInput() {
  const lat = prompt("Enter Latitude (e.g., 28.6139):");
  if (!lat) return;

  const lon = prompt("Enter Longitude (e.g., 77.2090):");
  if (!lon) return;

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    alert("❌ Invalid coordinates. Please enter valid numbers.");
    return;
  }

  fetch("/api/gps-attendance/set-current-as-office",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: latitude, longitude: longitude }),
    })
    .then((response) => response.json())
    .then((result) => {
      if (result.success) {
        alert(
          `✅ Head Office location set successfully!\n\nLatitude: ${latitude.toFixed(6)}\nLongitude: ${longitude.toFixed(6)}\nRadius: 100 meters\n\nEmployees within 100m can now mark attendance.`,
        );
        viewOfficeLocations();
      } else {
        alert("❌ Error: " + result.message);
      }
    })
    .catch((error) => {
      alert("❌ Error: " + error.message);
    });
}

async function viewOfficeLocations() {
  document.getElementById("gpsResults").innerHTML =
    '<p style="color: #64748b;">Loading office locations...</p>';

  try {
    const response = await fetch("/api/gps-attendance/locations");
    const result = await response.json();

    let html = `
            <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                <h3 style="margin: 0 0 20px 0;"><i class="fas fa-building"></i> Office Locations</h3>
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: #1e40af;"><i class="fas fa-map-marker-alt"></i> Quick Setup</h4>
                    <p style="margin: 0 0 12px 0; color: #1e3a8a; font-size: 14px;">Set your current location as Head Office (100m radius)</p>
                    <button onclick="setCurrentAsOffice()" class="btn btn-primary" style="background: #10b981; margin-right: 10px;">
                        <i class="fas fa-map-marker-alt"></i> Use My Current Location
                    </button>
                    <button onclick="manualLocationInput()" class="btn btn-secondary">
                        <i class="fas fa-keyboard"></i> Enter Manually
                    </button>
                </div>
        `;

    if (result.success && result.locations.length > 0) {
      html += `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 12px; text-align: left;">Location Name</th>
                            <th style="padding: 12px; text-align: left;">Latitude</th>
                            <th style="padding: 12px; text-align: left;">Longitude</th>
                            <th style="padding: 12px; text-align: left;">Radius (m)</th>
                            <th style="padding: 12px; text-align: left;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

      result.locations.forEach((loc) => {
        html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px; font-weight: 600;">${loc.location_name}</td>
                        <td style="padding: 12px;">${loc.latitude}</td>
                        <td style="padding: 12px;">${loc.longitude}</td>
                        <td style="padding: 12px;">${loc.radius_meters || loc.radius}</td>
                        <td style="padding: 12px;">
                            <span style="background: ${loc.is_active ? "#dcfce7" : "#fee2e2"}; color: ${loc.is_active ? "#15803d" : "#991b1b"}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                ${loc.is_active ? "✅ Active" : "Inactive"}
                            </span>
                        </td>
                    </tr>
                `;
      });

      html += "</tbody></table>";
    } else {
      html +=
        '<p style="color: #64748b; margin-top: 20px;">No office locations found. Use the button above to set one.</p>';
    }

    html += "</div>";
    document.getElementById("gpsResults").innerHTML = html;
  } catch (error) {
    document.getElementById("gpsResults").innerHTML =
      '<p style="color: #ef4444;">Error loading locations.</p>';
  }
}
