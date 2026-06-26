
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
// Settings Module for HRMS Portal

// Load Settings Section
function loadSettingsSection() {
  const isAdmin = currentUser.role === "admin";
  const isHR = currentUser.role === "hr";

  const settingsHTML = `
        <div class="settings-tabs">
            ${isAdmin
      ? `
                <button class="settings-tab active" onclick="showSettingsTab('system')">
                    <i class="fas fa-cog"></i> System
                </button>
                <button class="settings-tab" onclick="showSettingsTab('holidays')">
                    <i class="fas fa-calendar"></i> Holidays
                </button>
                <button class="settings-tab" onclick="showSettingsTab('leave-policy')">
                    <i class="fas fa-umbrella-beach"></i> Leave Policy
                </button>
                <button class="settings-tab" onclick="showSettingsTab('attendance')">
                    <i class="fas fa-clock"></i> Attendance
                </button>
                <button class="settings-tab" onclick="showSettingsTab('notifications')">
                    <i class="fas fa-bell"></i> Notifications
                </button>
            `
      : ""
    }
            <button class="settings-tab ${!isAdmin ? "active" : ""}" onclick="showSettingsTab('profile')">
                <i class="fas fa-user"></i> Profile
            </button>
            <button class="settings-tab" onclick="showSettingsTab('security')">
                <i class="fas fa-shield-alt"></i> Security
            </button>
            <button class="settings-tab" onclick="showSettingsTab('preferences')">
                <i class="fas fa-palette"></i> Preferences
            </button>
        </div>
        
        <div id="settings-content" class="settings-content"></div>
    `;

  document.getElementById("settingsResults").innerHTML = settingsHTML;
  showSettingsTab(isAdmin ? "system" : "profile");
}

// Show Settings Tab
function showSettingsTab(tab) {
  document
    .querySelectorAll(".settings-tab")
    .forEach((t) => t.classList.remove("active"));
  event?.target?.classList.add("active");

  const content = document.getElementById("settings-content");

  switch (tab) {
    case "system":
      content.innerHTML = getSystemSettings();
      break;
    case "holidays":
      content.innerHTML = getHolidaySettings();
      loadHolidays();
      break;
    case "leave-policy":
      content.innerHTML = getLeavePolicySettings();
      break;
    case "attendance":
      content.innerHTML = getAttendanceSettings();
      break;
    case "notifications":
      content.innerHTML = getNotificationSettings();
      break;
    case "profile":
      content.innerHTML = getProfileSettings();
      break;
    case "security":
      content.innerHTML = getSecuritySettings();
      break;
    case "preferences":
      content.innerHTML = getPreferencesSettings();
      break;
  }
}

// System Settings
function getSystemSettings() {
  // Load saved settings
  fetch("/api/settings/system")
    .then((response) => response.json())
    .then((data) => {
      if (data.success && data.settings) {
        const s = data.settings;
        setTimeout(() => {
          const companyNameInput = document.querySelector(
            '[name="company_name"]');
          if (companyNameInput) {
            companyNameInput.value = s.company_name || "HRMS Enterprise";
          }
          const timezoneInput = document.querySelector('[name="timezone"]');
          if (timezoneInput) {
            timezoneInput.value = s.timezone || "Asia/Kolkata (IST)";
          }
          const currencyInput = document.querySelector('[name="currency"]');
          if (currencyInput) {
            currencyInput.value = s.currency || "INR (₹)";
          }
          const dateFormatInput = document.querySelector(
            '[name="date_format"]',
          );
          if (dateFormatInput) {
            dateFormatInput.value = s.date_format || "DD/MM/YYYY";
          }
          const workStartInput = document.querySelector('[name="work_start"]');
          if (workStartInput) {
            workStartInput.value = s.work_start || "09:00";
          }
          const workEndInput = document.querySelector('[name="work_end"]');
          if (workEndInput) {
            workEndInput.value = s.work_end || "18:00";
          }

          // Restore working days checkboxes
          const workDays = s.work_days || ["mon", "tue", "wed", "thu", "fri"];
          document.querySelectorAll('[name="work_days"]').forEach((cb) => {
            cb.checked = workDays.includes(cb.value);
          });
        }, 100);
      }
    })
    .catch((err) => console.error("Error loading system settings:", err));

  return `
        <div class="settings-section">
            <h3><i class="fas fa-building"></i> Company Information</h3>
            <div class="settings-grid">
                <div class="settings-field">
                    <label>Company Name</label>
                    <input type="text" name="company_name" value="HRMS Enterprise" class="settings-input">
                </div>
                <div class="settings-field">
                    <label>Timezone</label>
                    <select name="timezone" class="settings-input">
                        <option>Asia/Kolkata (IST)</option>
                        <option>America/New_York (EST)</option>
                        <option>Europe/London (GMT)</option>
                    </select>
                </div>
                <div class="settings-field">
                    <label>Currency</label>
                    <select name="currency" class="settings-input">
                        <option>INR (₹)</option>
                        <option>USD ($)</option>
                        <option>EUR (€)</option>
                    </select>
                </div>
                <div class="settings-field">
                    <label>Date Format</label>
                    <select name="date_format" class="settings-input">
                        <option>DD/MM/YYYY</option>
                        <option>MM/DD/YYYY</option>
                        <option>YYYY-MM-DD</option>
                    </select>
                </div>
            </div>
            
            <h3><i class="fas fa-clock"></i> Working Hours</h3>
            <div class="settings-grid">
                <div class="settings-field">
                    <label>Work Start Time</label>
                    <input type="time" name="work_start" value="09:00" class="settings-input">
                </div>
                <div class="settings-field">
                    <label>Work End Time</label>
                    <input type="time" name="work_end" value="18:00" class="settings-input">
                </div>
                <div class="settings-field">
                    <label>Working Days</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" name="work_days" value="mon" checked> Mon</label>
                        <label><input type="checkbox" name="work_days" value="tue" checked> Tue</label>
                        <label><input type="checkbox" name="work_days" value="wed" checked> Wed</label>
                        <label><input type="checkbox" name="work_days" value="thu" checked> Thu</label>
                        <label><input type="checkbox" name="work_days" value="fri" checked> Fri</label>
                        <label><input type="checkbox" name="work_days" value="sat"> Sat</label>
                        <label><input type="checkbox" name="work_days" value="sun"> Sun</label>
                    </div>
                </div>
            </div>
            
            <button class="btn btn-primary" onclick="saveSystemSettings()">
                <i class="fas fa-save"></i> Save Changes
            </button>
        </div>
    `;
}

// Holiday Settings
function getHolidaySettings() {
  return `
        <div class="settings-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3><i class="fas fa-calendar-alt"></i> Holiday Calendar ${new Date().getFullYear()}</h3>
                <button class="btn btn-primary" onclick="showAddHolidayModal()">
                    <i class="fas fa-plus"></i> Add Holiday
                </button>
            </div>
            
            <div id="holidaysList" class="holidays-list">
                <p style="color: #64748b;">Loading holidays...</p>
            </div>
        </div>
    `;
}

// Load Holidays
function loadHolidays() {
  // Use default holidays directly
  const holidays = [
    { id: 1, date: "2025-01-26", name: "Republic Day", type: "National" },
    { id: 2, date: "2025-03-14", name: "Holi", type: "Festival" },
    { id: 3, date: "2025-04-14", name: "Ambedkar Jayanti", type: "National" },
    { id: 4, date: "2025-08-15", name: "Independence Day", type: "National" },
    { id: 5, date: "2025-10-02", name: "Gandhi Jayanti", type: "National" },
    { id: 6, date: "2025-10-24", name: "Diwali", type: "Festival" },
    { id: 7, date: "2025-12-25", name: "Christmas", type: "Festival" },
  ];
  displayHolidays(holidays);
}

function displayHolidays(holidays) {
  const isAdmin = currentUser.role === "admin";
  const html = holidays
    .map(
      (h) => `
        <div class="holiday-card">
            <div class="holiday-date">
                <div class="holiday-day">${new Date(h.date).getDate()}</div>
                <div class="holiday-month">${new Date(h.date).toLocaleString("default", { month: "short" })}</div>
            </div>
            <div class="holiday-info">
                <h4>${h.name}</h4>
                <span class="holiday-type ${h.type.toLowerCase()}">${h.type}</span>
            </div>
            ${isAdmin
          ? `
            <div class="holiday-actions">
                <button class="btn-icon" onclick="editHoliday(${h.id}, '${h.date}', '${h.name}', '${h.type}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon" onclick="deleteHoliday(${h.id})"><i class="fas fa-trash"></i></button>
            </div>
            `
          : ""
        }
        </div>
    `,
    )
    .join("");

  document.getElementById("holidaysList").innerHTML = html;
}

// Leave Policy Settings
function getLeavePolicySettings() {
  return `
        <div class="settings-section">
            <h3><i class="fas fa-umbrella-beach"></i> Leave Types & Policies</h3>
            
            <div class="leave-types">
                <div class="leave-type-card">
                    <h4>Casual Leave</h4>
                    <div class="settings-grid">
                        <div class="settings-field">
                            <label>Annual Quota</label>
                            <input type="number" name="casual_quota" value="12" class="settings-input">
                        </div>
                        <div class="settings-field">
                            <label>Carry Forward</label>
                            <input type="number" name="casual_carry" value="5" class="settings-input">
                        </div>
                        <div class="settings-field">
                            <label>Min Notice (days)</label>
                            <input type="number" name="casual_notice" value="1" class="settings-input">
                        </div>
                    </div>
                </div>
                
                <div class="leave-type-card">
                    <h4>Sick Leave</h4>
                    <div class="settings-grid">
                        <div class="settings-field">
                            <label>Annual Quota</label>
                            <input type="number" name="sick_quota" value="10" class="settings-input">
                        </div>
                        <div class="settings-field">
                            <label>Carry Forward</label>
                            <input type="number" name="sick_carry" value="3" class="settings-input">
                        </div>
                        <div class="settings-field">
                            <label>Medical Certificate Required After</label>
                            <input type="number" name="sick_cert" value="3" class="settings-input"> days
                        </div>
                    </div>
                </div>
                
                <div class="leave-type-card">
                    <h4>Annual Leave</h4>
                    <div class="settings-grid">
                        <div class="settings-field">
                            <label>Annual Quota</label>
                            <input type="number" name="annual_quota" value="20" class="settings-input">
                        </div>
                        <div class="settings-field">
                            <label>Carry Forward</label>
                            <input type="number" name="annual_carry" value="10" class="settings-input">
                        </div>
                        <div class="settings-field">
                            <label>Min Notice (days)</label>
                            <input type="number" name="annual_notice" value="7" class="settings-input">
                        </div>
                    </div>
                </div>
            </div>
            
            <button class="btn btn-primary" onclick="saveLeavePolicies()">
                <i class="fas fa-save"></i> Save Policies
            </button>
        </div>
    `;
}

// Attendance Settings
function getAttendanceSettings() {
  return `
        <div class="settings-section">
            <h3><i class="fas fa-clock"></i> Attendance Rules</h3>
            <div class="settings-grid">
                <div class="settings-field">
                    <label>Grace Period (minutes)</label>
                    <input type="number" name="grace_period" value="15" class="settings-input">
                </div>
                <div class="settings-field">
                    <label>Half Day Hours</label>
                    <input type="number" name="half_day_hours" value="4" class="settings-input">
                </div>
                <div class="settings-field">
                    <label>Full Day Hours</label>
                    <input type="number" name="full_day_hours" value="8" class="settings-input">
                </div>
                <div class="settings-field">
                    <label>Overtime Rate</label>
                    <input type="number" name="overtime_rate" value="1.5" step="0.1" class="settings-input">x
                </div>
            </div>
            
            <h3><i class="fas fa-map-marker-alt"></i> GPS Attendance</h3>
            <div class="settings-grid">
                <div class="settings-field">
                    <label>Enable GPS Tracking</label>
                    <label class="switch">
                        <input type="checkbox" name="gps_enabled" checked>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="settings-field">
                    <label>Geofence Radius (meters)</label>
                    <input type="number" name="geofence_radius" value="100" class="settings-input">
                </div>
            </div>
            
            <button class="btn btn-primary" onclick="saveAttendanceSettings()">
                <i class="fas fa-save"></i> Save Settings
            </button>
        </div>
    `;
}

// Notification Settings
function getNotificationSettings() {
  return `
        <div class="settings-section">
            <h3><i class="fas fa-bell"></i> Notification Preferences</h3>
            
            <div class="notification-settings">
                <div class="notification-item">
                    <div>
                        <h4>Email Notifications</h4>
                        <p>Receive notifications via email</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" name="email_notif" checked>
                        <span class="slider"></span>
                    </label>
                </div>
                
                <div class="notification-item">
                    <div>
                        <h4>Leave Requests</h4>
                        <p>Notify when leave requests are submitted</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" name="leave_notif" checked>
                        <span class="slider"></span>
                    </label>
                </div>
                
                <div class="notification-item">
                    <div>
                        <h4>Task Assignments</h4>
                        <p>Notify when tasks are assigned</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" name="task_notif" checked>
                        <span class="slider"></span>
                    </label>
                </div>
                
                <div class="notification-item">
                    <div>
                        <h4>Announcements</h4>
                        <p>Notify about company announcements</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" name="announcement_notif" checked>
                        <span class="slider"></span>
                    </label>
                </div>
                
                <div class="notification-item">
                    <div>
                        <h4>Birthday Reminders</h4>
                        <p>Notify about team member birthdays</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" name="birthday_notif" checked>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
            
            <button class="btn btn-primary" onclick="saveNotificationSettings()">
                <i class="fas fa-save"></i> Save Preferences
            </button>
        </div>
    `;
}

// Profile Settings
function getProfileSettings() {
  // Use default holidays directly
  const holidays = [
    { id: 1, date: "2025-01-26", name: "Republic Day", type: "National" },
    { id: 2, date: "2025-03-14", name: "Holi", type: "Festival" },
    { id: 3, date: "2025-04-14", name: "Ambedkar Jayanti", type: "National" },
    { id: 4, date: "2025-08-15", name: "Independence Day", type: "National" },
    { id: 5, date: "2025-10-02", name: "Gandhi Jayanti", type: "National" },
    { id: 6, date: "2025-10-24", name: "Diwali", type: "Festival" },
    { id: 7, date: "2025-12-25", name: "Christmas", type: "Festival" },
  ];
  setTimeout(() => displayEmployeeHolidayCalendar(holidays), 100);

  // Load current profile picture
  setTimeout(() => {
    loadCurrentProfilePicture();
  }, 100);

  return `
        <div class="settings-section">
            <h3><i class="fas fa-user"></i> Personal Information</h3>
            <div class="settings-grid">
                <div class="settings-field">
                    <label>Full Name</label>
                    <input type="text" id="profile_full_name" value="${currentUser.full_name}" class="settings-input">
                </div>
                <div class="settings-field">
                    <label>Email</label>
                    <input type="email" value="${currentUser.username}" class="settings-input" disabled>
                </div>
                <div class="settings-field">
                    <label>Phone Number</label>
                    <input type="tel" id="profile_phone" placeholder="+91 XXXXX XXXXX" class="settings-input">
                </div>
                <div class="settings-field">
                    <label>Department</label>
                    <input type="text" value="${currentUser.department || "General"}" class="settings-input" disabled>
                </div>
            </div>
            
            <h3><i class="fas fa-camera"></i> Profile Picture</h3>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                    <div id="currentProfilePicture" style="width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #1d4ed8); display: flex; align-items: center; justify-content: center; color: white; font-size: 48px; font-weight: 600; cursor: pointer;" onclick="previewCurrentProfilePicture()">
                        ${currentUser?.full_name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <h4 style="margin: 0 0 8px 0; color: #1e293b;"><i class="fas fa-camera"></i> Change Photo</h4>
                        <p style="margin: 0 0 12px 0; color: #64748b; font-size: 14px;">Upload a new profile picture (JPG, PNG, max 5MB)</p>
                        <input type="file" id="profilePictureInput" accept="image/*" style="display: none;" onchange="handleProfilePictureUpload(event)">
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="document.getElementById('profilePictureInput').click()" style="font-size: 14px; padding: 8px 16px;">
                                <i class="fas fa-upload"></i> Choose Photo
                            </button>
                            <button class="btn btn-secondary" onclick="previewCurrentProfilePicture()" style="font-size: 14px; padding: 8px 16px;">
                                <i class="fas fa-eye"></i> Preview
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <h3><i class="fas fa-calendar"></i> Holiday Calendar ${new Date().getFullYear()}</h3>
            <div id="employeeHolidayCalendar" class="employee-holiday-calendar"></div>
            
            <button class="btn btn-primary" onclick="saveProfileSettings()">
                <i class="fas fa-save"></i> Save Changes
            </button>
        </div>
    `;
}

function displayEmployeeHolidayCalendar(holidays) {
  const html = holidays
    .map(
      (h) => `
        <div class="holiday-card" style="margin-bottom: 10px;">
            <div class="holiday-date">
                <div class="holiday-day">${new Date(h.date).getDate()}</div>
                <div class="holiday-month">${new Date(h.date).toLocaleString("default", { month: "short" })}</div>
            </div>
            <div class="holiday-info">
                <h4>${h.name}</h4>
                <span class="holiday-type ${h.type.toLowerCase()}">${h.type}</span>
            </div>
        </div>
    `,
    )
    .join("");

  const calendar = document.getElementById("employeeHolidayCalendar");
  if (calendar) {
    calendar.innerHTML =
      html || '<p style="color: #64748b;">No holidays found</p>';
  }
}

// Security Settings
function getSecuritySettings() {
  const isAdmin = currentUser.role === "admin";
  const isHR = currentUser.role === "hr";
  const canChangePassword = isAdmin || isHR;

  // Load 2FA status
  setTimeout(() => load2FAStatus(), 100);

  return `
        <div class="settings-section">
            <h3><i class="fas fa-key"></i> Change Password</h3>
            ${!canChangePassword
      ? `
                <div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin-bottom: 16px; border-left: 4px solid #ffc107;">
                    <i class="fas fa-info-circle"></i> Only Admin and HR can change passwords. Please contact your administrator.
                </div>
            `
      : ""
    }
            <div class="settings-grid">
                <div class="settings-field">
                    <label>Current Password</label>
                    <input type="password" id="current_password" class="settings-input" ${!canChangePassword ? "disabled" : ""}>
                </div>
                <div class="settings-field">
                    <label>New Password</label>
                    <input type="password" id="new_password" class="settings-input" ${!canChangePassword ? "disabled" : ""}>
                </div>
                <div class="settings-field">
                    <label>Confirm Password</label>
                    <input type="password" id="confirm_password" class="settings-input" ${!canChangePassword ? "disabled" : ""}>
                </div>
            </div>
            ${canChangePassword
      ? `
                <button class="btn btn-primary" onclick="changePassword()" style="margin-top: 12px;">
                    <i class="fas fa-key"></i> Change Password
                </button>
            `
      : ""
    }
            
            <h3 style="margin-top: 24px;"><i class="fas fa-shield-alt"></i> Two-Factor Authentication</h3>
            <div class="notification-item">
                <div>
                    <h4>Enable 2FA</h4>
                    <p>Add an extra layer of security to your account</p>
                    <p id="2fa-status" style="font-size: 12px; color: #64748b; margin-top: 4px;">Loading...</p>
                </div>
                <label class="switch">
                    <input type="checkbox" id="2fa-toggle" onchange="toggle2FA(this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            
            <div id="2fa-setup" style="display: none; margin-top: 16px; padding: 16px; background: #f8fafc; border-radius: 8px;">
                <h4>Setup 2FA</h4>
                <p>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
                <div id="qr-code" style="text-align: center; margin: 16px 0;"></div>
                <p style="font-size: 12px; color: #64748b;">Or enter this key manually: <code id="manual-key" style="background: white; padding: 4px 8px; border-radius: 4px;"></code></p>
                <div style="margin-top: 16px;">
                    <label>Enter verification code to confirm:</label>
                    <input type="text" id="2fa-verify-code" class="settings-input" placeholder="000000" maxlength="6" style="max-width: 200px;">
                    <button class="btn btn-primary" onclick="verify2FASetup()" style="margin-left: 8px;">
                        <i class="fas fa-check"></i> Verify
                    </button>
                </div>
            </div>
            
            <h3 style="margin-top: 24px;"><i class="fas fa-history"></i> Active Sessions</h3>
            <div class="sessions-list">
                <div class="session-item">
                    <i class="fas fa-desktop"></i>
                    <div>
                        <h4>Current Session</h4>
                        <p>Windows • Chrome • ${new Date().toLocaleString()}</p>
                    </div>
                    <span class="badge-success">Active</span>
                </div>
            </div>
        </div>
    `;
}

// Preferences Settings
function getPreferencesSettings() {
  const savedTheme = localStorage.getItem("hrms_theme") || "light";

  return `
        <div class="settings-section">
            <h3><i class="fas fa-palette"></i> Display Preferences</h3>
            
            <div class="settings-grid">
                <div class="settings-field">
                    <label>Theme</label>
                    <select class="settings-input" onchange="changeTheme(this.value)">
                        <option value="light" ${savedTheme === "light" ? "selected" : ""}>Light</option>
                        <option value="dark" ${savedTheme === "dark" ? "selected" : ""}>Dark</option>
                        <option value="auto" ${savedTheme === "auto" ? "selected" : ""}>Auto</option>
                    </select>
                </div>
                <div class="settings-field">
                    <label>Language</label>
                    <select class="settings-input">
                        <option value="en">English</option>
                        <option value="hi">हिंदी</option>
                        <option value="gu">ગુજરાતી</option>
                    </select>
                </div>
                <div class="settings-field">
                    <label>Date Format</label>
                    <select class="settings-input">
                        <option>DD/MM/YYYY</option>
                        <option>MM/DD/YYYY</option>
                        <option>YYYY-MM-DD</option>
                    </select>
                </div>
                <div class="settings-field">
                    <label>Time Format</label>
                    <select class="settings-input">
                        <option>12 Hour</option>
                        <option>24 Hour</option>
                    </select>
                </div>
            </div>
            
            <button class="btn btn-primary" onclick="savePreferences()">
                <i class="fas fa-save"></i> Save Preferences
            </button>
        </div>
    `;
}

// Save Functions
function saveSystemSettings() {
  const settings = {
    company_name: document.querySelector('[name="company_name"]').value,
    timezone: document.querySelector('[name="timezone"]').value,
    currency: document.querySelector('[name="currency"]').value,
    date_format: document.querySelector('[name="date_format"]').value,
    work_start: document.querySelector('[name="work_start"]').value,
    work_end: document.querySelector('[name="work_end"]').value,
    work_days: Array.from(
      document.querySelectorAll('[name="work_days"]:checked'),
    ).map((cb) => cb.value),
  };

  fetch("/api/settings/system", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("System settings saved successfully!");
        // Update logo text immediately
        updateCompanyName(settings.company_name);
        // Store in localStorage for persistence
        localStorage.setItem("hrms_company_name", settings.company_name);
        localStorage.setItem("hrms_settings", JSON.stringify(settings));
      } else {
        alert("Error: " + (data.message || "Failed to save settings"));
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error saving settings");
    });
}

// Helper function to update company name in header
function updateCompanyName(companyName) {
  const logoText = document.querySelector(".logo");
  if (logoText) {
    // Preserve bicolor branding and ensure no icon is present
    logoText.innerHTML = `<span class="brand-seawind">Seawind</span><span class="brand-hrms">HRMS</span>`;
  }
}

function saveLeavePolicies() {
  const policies = {
    casual_leave: {
      quota: document.querySelector('[name="casual_quota"]').value,
      carry_forward: document.querySelector('[name="casual_carry"]').value,
      min_notice: document.querySelector('[name="casual_notice"]').value,
    },
    sick_leave: {
      quota: document.querySelector('[name="sick_quota"]').value,
      carry_forward: document.querySelector('[name="sick_carry"]').value,
      medical_cert_after: document.querySelector('[name="sick_cert"]').value,
    },
    annual_leave: {
      quota: document.querySelector('[name="annual_quota"]').value,
      carry_forward: document.querySelector('[name="annual_carry"]').value,
      min_notice: document.querySelector('[name="annual_notice"]').value,
    },
  };

  fetch("/api/settings/leave-policies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(policies),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("Leave policies saved successfully!");
        localStorage.setItem("hrms_leave_policies", JSON.stringify(policies));
      } else {
        alert("Error: " + (data.message || "Failed to save"));
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error saving leave policies");
    });
}

function saveAttendanceSettings() {
  const settings = {
    grace_period: document.querySelector('[name="grace_period"]').value,
    half_day_hours: document.querySelector('[name="half_day_hours"]').value,
    full_day_hours: document.querySelector('[name="full_day_hours"]').value,
    overtime_rate: document.querySelector('[name="overtime_rate"]').value,
    gps_enabled: document.querySelector('[name="gps_enabled"]').checked,
    geofence_radius: document.querySelector('[name="geofence_radius"]').value,
  };

  fetch("/api/settings/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("Attendance settings saved successfully!");
        localStorage.setItem(
          "hrms_attendance_settings",
          JSON.stringify(settings));
      } else {
        alert("Error: " + (data.message || "Failed to save"));
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error saving attendance settings");
    });
}

function saveNotificationSettings() {
  const settings = {
    email_notifications: document.querySelector('[name="email_notif"]').checked,
    leave_requests: document.querySelector('[name="leave_notif"]').checked,
    task_assignments: document.querySelector('[name="task_notif"]').checked,
    announcements: document.querySelector('[name="announcement_notif"]')
      .checked,
    birthday_reminders: document.querySelector('[name="birthday_notif"]')
      .checked,
  };

  fetch("/api/settings/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("Notification preferences saved successfully!");
        localStorage.setItem(
          "hrms_notification_settings",
          JSON.stringify(settings));
      } else {
        alert("Error: " + (data.message || "Failed to save"));
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error saving notification settings");
    });
}

function saveProfileSettings() {
  const newName = document.getElementById("profile_full_name").value.trim();

  if (!newName) {
    alert("Please enter a valid name");
    return;
  }

  fetch("/api/users/" + currentUser.user_id,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: newName }),
    })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Update localStorage
        currentUser.full_name = newName;
        localStorage.setItem("hrms_user", JSON.stringify(currentUser));

        // Update UI
        document.getElementById("userName").textContent = newName;
        document.getElementById("userAvatar").textContent = newName
          .charAt(0)
          .toUpperCase();

        alert("Profile updated successfully!");
      } else {
        alert("Error: " + (data.message || "Failed to update profile"));
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error updating profile");
    });
}

function changePassword() {
  const currentPassword = document.getElementById("current_password").value;
  const newPassword = document.getElementById("new_password").value;
  const confirmPassword = document.getElementById("confirm_password").value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    alert("Please fill all password fields");
    return;
  }

  if (newPassword !== confirmPassword) {
    alert("New password and confirm password do not match");
    return;
  }

  if (newPassword.length < 6) {
    alert("Password must be at least 6 characters long");
    return;
  }

  fetch("/api/security/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: currentUser.user_id,
      current_user_id: currentUser.user_id,
      current_user_role: currentUser.role,
      current_password: currentPassword,
      new_password: newPassword,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("Password changed successfully!");
        document.getElementById("current_password").value = "";
        document.getElementById("new_password").value = "";
        document.getElementById("confirm_password").value = "";
      } else {
        alert("Error: " + (data.message || "Failed to change password"));
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error changing password");
    });
}

function load2FAStatus() {
  fetch(`/api/security/2fa/status/${currentUser.user_id}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const toggle = document.getElementById("2fa-toggle");
        const status = document.getElementById("2fa-status");
        if (toggle && status) {
          toggle.checked = data.enabled;
          status.textContent = data.enabled
            ? "Status: Enabled ✓"
            : "Status: Disabled";
          status.style.color = data.enabled ? "#10b981" : "#64748b";
        }
      }
    })
    .catch((err) => console.error("Error loading 2FA status:", err));
}

function toggle2FA(enabled) {
  if (enabled) {
    fetch("/api/security/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: currentUser.user_id }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const setupDiv = document.getElementById("2fa-setup");
          const qrCode = document.getElementById("qr-code");
          const manualKey = document.getElementById("manual-key");

          if (setupDiv && qrCode && manualKey) {
            qrCode.innerHTML = `<img src="${data.qr_code}" alt="QR Code" style="max-width: 250px;">`;
            manualKey.textContent = data.secret;
            setupDiv.style.display = "block";
          }
        } else {
          alert("Error: " + (data.message || "Failed to enable 2FA"));
          document.getElementById("2fa-toggle").checked = false;
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        alert("Error enabling 2FA");
        document.getElementById("2fa-toggle").checked = false;
      });
  } else {
    const password = prompt("Enter your password to disable 2FA:");
    if (!password) {
      document.getElementById("2fa-toggle").checked = true;
      return;
    }

    fetch("/api/security/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: currentUser.user_id,
        password: password,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          alert("2FA disabled successfully");
          document.getElementById("2fa-setup").style.display = "none";
          load2FAStatus();
        } else {
          alert("Error: " + (data.message || "Failed to disable 2FA"));
          document.getElementById("2fa-toggle").checked = true;
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        alert("Error disabling 2FA");
        document.getElementById("2fa-toggle").checked = true;
      });
  }
}

function verify2FASetup() {
  const code = document.getElementById("2fa-verify-code").value;

  if (!code || code.length !== 6) {
    alert("Please enter a valid 6-digit code");
    return;
  }

  fetch("/api/security/2fa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: currentUser.user_id,
      code: code,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("2FA setup completed successfully!");
        document.getElementById("2fa-setup").style.display = "none";
        document.getElementById("2fa-verify-code").value = "";
        load2FAStatus();
      } else {
        alert("Error: " + (data.message || "Invalid code"));
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error verifying code");
    });
}

function savePreferences() {
  alert("Preferences saved successfully!");
}

// Theme Change
function changeTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark-theme");
    localStorage.setItem("hrms_theme", "dark");
  } else if (theme === "light") {
    document.body.classList.remove("dark-theme");
    localStorage.setItem("hrms_theme", "light");
  } else if (theme === "auto") {
    // Auto mode based on system preference
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      document.body.classList.add("dark-theme");
    } else {
      document.body.classList.remove("dark-theme");
    }
    localStorage.setItem("hrms_theme", "auto");
  }
}

// Holiday Modal
function showAddHolidayModal() {
  const modal = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <h3>Add Holiday</h3>
                <div class="settings-grid">
                    <div class="settings-field">
                        <label>Holiday Name</label>
                        <input type="text" id="holidayName" class="settings-input">
                    </div>
                    <div class="settings-field">
                        <label>Date</label>
                        <input type="date" id="holidayDate" class="settings-input">
                    </div>
                    <div class="settings-field">
                        <label>Type</label>
                        <select id="holidayType" class="settings-input">
                            <option>National</option>
                            <option>Regional</option>
                            <option>Company</option>
                        </select>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="addHoliday()">Add Holiday</button>
                    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </div>
        </div>
    `;
  document.body.insertAdjacentHTML("beforeend", modal);
}

function addHoliday() {
  const name = document.getElementById("holidayName").value;
  const date = document.getElementById("holidayDate").value;
  const type = document.getElementById("holidayType").value;

  if (!name || !date) {
    alert("Please fill all fields");
    return;
  }

  fetch("/api/settings/holidays", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, date, type }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("Holiday added successfully!");
        closeModal();
        loadHolidays();
      } else {
        alert("Error: " + (data.message || "Failed to add holiday"));
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error adding holiday");
    });
}

function editHoliday(id, date, name, type) {
  const modal = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <h3>Edit Holiday</h3>
                <div class="settings-grid">
                    <div class="settings-field">
                        <label>Holiday Name</label>
                        <input type="text" id="editHolidayName" value="${name}" class="settings-input">
                    </div>
                    <div class="settings-field">
                        <label>Date</label>
                        <input type="date" id="editHolidayDate" value="${date}" class="settings-input">
                    </div>
                    <div class="settings-field">
                        <label>Type</label>
                        <select id="editHolidayType" class="settings-input">
                            <option ${type === "National" ? "selected" : ""}>National</option>
                            <option ${type === "Regional" ? "selected" : ""}>Regional</option>
                            <option ${type === "Company" ? "selected" : ""}>Company</option>
                        </select>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="updateHoliday(${id})">Update Holiday</button>
                    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </div>
        </div>
    `;
  document.body.insertAdjacentHTML("beforeend", modal);
}

function updateHoliday(id) {
  const name = document.getElementById("editHolidayName").value;
  const date = document.getElementById("editHolidayDate").value;
  const type = document.getElementById("editHolidayType").value;

  fetch(`/api/settings/holidays/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, date, type }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("Holiday updated successfully!");
        closeModal();
        loadHolidays();
      } else {
        alert("Error: " + (data.message || "Failed to update holiday"));
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error updating holiday");
    });
}

function deleteHoliday(id) {
  if (confirm("Delete this holiday?")) {
    fetch(`/api/settings/holidays/${id}`, {
      method: "DELETE",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          alert("Holiday deleted!");
          loadHolidays();
        } else {
          alert("Error: " + (data.message || "Failed to delete holiday"));
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        alert("Error deleting holiday");
      });
  }
}

function closeModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.querySelector(".modal-overlay")?.remove();
}

// Profile Picture Functions
function loadCurrentProfilePicture() {
  fetch(`/api/profile/picture-simple/${currentUser.user_id}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success && data.picture && data.picture.file_path) {
        const pictureDiv = document.getElementById("currentProfilePicture");
        if (pictureDiv) {
          pictureDiv.innerHTML = `<img src="/${data.picture.file_path}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" alt="Profile Picture">`;
        }
        // Update header avatar
        updateHeaderAvatar(data.picture.file_path);
      }
    })
    .catch((err) => console.error("Error loading profile picture:", err));
}

function handleProfilePictureUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file
  if (!file.type.startsWith("image/")) {
    alert("Please select an image file");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("File size must be less than 5MB");
    return;
  }

  // Show preview immediately
  const reader = new FileReader();
  reader.onload = function (e) {
    const pictureDiv = document.getElementById("currentProfilePicture");
    if (pictureDiv) {
      pictureDiv.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" alt="Profile Picture">`;
    }
  };
  reader.readAsDataURL(file);

  // Upload to server
  const formData = new FormData();
  formData.append("file", file);
  formData.append("user_id", currentUser.user_id);

  fetch("/api/profile/upload-picture-simple",
    {
      method: "POST",
      body: formData,
    })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("Profile picture updated successfully!");
        // Update header avatar
        updateHeaderAvatar(data.file_path);
      } else {
        alert("Error: " + (data.message || "Failed to upload picture"));
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error uploading picture");
    });
}

function previewCurrentProfilePicture() {
  fetch(`/api/profile/picture-simple/${currentUser.user_id}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success && data.picture && data.picture.file_path) {
        previewImage("/" + data.picture.file_path, "Profile Picture");
      } else {
        alert("No profile picture uploaded yet");
      }
    })
    .catch((err) => {
      console.error("Error:", err);
      alert("Error loading profile picture");
    });
}

function updateHeaderAvatar(filePath) {
  const avatarDiv = document.getElementById("userAvatar");
  if (avatarDiv && filePath) {
    avatarDiv.innerHTML = `<img src="/${filePath}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" alt="Avatar">`;
  }
}

// Load profile picture on page load
if (typeof currentUser !== "undefined" && currentUser && currentUser.user_id) {
  setTimeout(() => {
    fetch(`/api/profile/picture-simple/${currentUser.user_id}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.picture && data.picture.file_path) {
          updateHeaderAvatar(data.picture.file_path);
        }
      })
      .catch((err) => console.error("Error loading header avatar:", err));
  }, 500);
}

// Dashboard Profile Picture Widget
function createDashboardProfileWidget() {
  // Check if widget already exists
  if (document.getElementById("dashboardProfileWidget")) return;

  // Find the dashboard section
  const dashboardSection = document.getElementById("dashboard-section");
  if (!dashboardSection) return;

  // Create widget HTML
  const widgetHTML = `
        <div id="dashboardProfileWidget" class="card" style="margin-top: 20px;">
            <div class="card-header">
                <div class="card-title">👤 Profile Picture</div>
            </div>
            <div class="card-content">
                <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                    <div id="dashboardProfilePicture" style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #1d4ed8); display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; font-weight: 600; cursor: pointer; transition: transform 0.2s;" title="Click to preview" onclick="previewProfilePic()">
                        ${currentUser?.full_name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <h4 style="margin: 0 0 8px 0; color: #1e293b;"><i class="fas fa-camera"></i> Change Photo</h4>
                        <p style="margin: 0 0 12px 0; color: #64748b; font-size: 14px;">Click on photo to preview or upload new</p>
                        <input type="file" id="dashboardProfilePictureInput" accept="image/*" style="display: none;" onchange="handleDashboardProfilePictureUpload(event)">
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="document.getElementById('dashboardProfilePictureInput').click()" style="font-size: 14px; padding: 8px 16px;">
                                <i class="fas fa-upload"></i> Upload
                            </button>
                            <button class="btn btn-secondary" onclick="previewDashboardProfilePicture()" style="font-size: 14px; padding: 8px 16px;">
                                <i class="fas fa-eye"></i> Preview
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

  // Insert widget after stats grid
  const statsGrid = dashboardSection.querySelector(".stats-grid");
  if (statsGrid) {
    statsGrid.insertAdjacentHTML("afterend", widgetHTML);
    // Load current picture
    loadDashboardProfilePicture();
  }
}

function loadDashboardProfilePicture() {
  fetch(`/api/profile/picture-simple/${currentUser.user_id}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success && data.picture && data.picture.file_path) {
        const pictureDiv = document.getElementById("dashboardProfilePicture");
        if (pictureDiv) {
          const imgPath = "/" + data.picture.file_path;
          pictureDiv.innerHTML = `<img src="${imgPath}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; cursor: pointer;" alt="Profile Picture" title="Click to preview">`;

          // Add click event listener
          pictureDiv.addEventListener("click", function () {
            // Create preview modal
            const modal = document.createElement("div");
            modal.style.cssText =
              "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999; display: flex; align-items: center; justify-content: center; cursor: pointer;";
            modal.innerHTML = `<img src="${imgPath}" style="max-width: 90%; max-height: 90%; border-radius: 8px;" alt="Profile Picture Preview">`;
            modal.onclick = function () {
              modal.remove();
            };
            document.body.appendChild(modal);
          });
        }
      }
    })
    .catch((err) =>
      console.error("Error loading dashboard profile picture:", err),
    );
}

function handleDashboardProfilePictureUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select an image file");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("File size must be less than 5MB");
    return;
  }

  // Show preview immediately
  const reader = new FileReader();
  reader.onload = function (e) {
    const pictureDiv = document.getElementById("dashboardProfilePicture");
    if (pictureDiv) {
      const imgSrc = e.target.result;
      pictureDiv.innerHTML = `<img src="${imgSrc}" onclick="previewImage('${imgSrc}', 'Profile Picture')" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; cursor: pointer;" alt="Profile Picture" title="Click to preview">`;
    }
  };
  reader.readAsDataURL(file);

  // Upload to server
  const formData = new FormData();
  formData.append("file", file);
  formData.append("user_id", currentUser.user_id);

  fetch("/api/profile/upload-picture-simple",
    {
      method: "POST",
      body: formData,
    })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("Profile picture updated successfully!");
        updateHeaderAvatar(data.file_path);
      } else {
        alert("Error: " + (data.message || "Failed to upload picture"));
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error uploading picture");
    });
}

function previewDashboardProfilePicture() {
  // This function is now just a fallback - the image has its own onclick
  fetch(`/api/profile/picture-simple/${currentUser.user_id}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success && data.picture && data.picture.file_path) {
        previewImage("/" + data.picture.file_path, "Profile Picture");
      } else {
        if (
          confirm(
            "No profile picture uploaded yet. Would you like to upload one now?",
          )
        ) {
          document.getElementById("dashboardProfilePictureInput").click();
        }
      }
    })
    .catch((err) => {
      console.error("Error:", err);
      if (
        confirm("No profile picture found. Would you like to upload one now?")
      ) {
        document.getElementById("dashboardProfilePictureInput").click();
      }
    });
}

// Auto-create dashboard widget when dashboard is shown
if (typeof window !== "undefined") {
  const originalShowSection = window.showSection;
  if (originalShowSection) {
    window.showSection = function (sectionName) {
      originalShowSection(sectionName);
      if (sectionName === "dashboard") {
        setTimeout(createDashboardProfileWidget, 500);
      }
    };
  }
}

// Create widget on page load if on dashboard
setTimeout(() => {
  const dashboardSection = document.getElementById("dashboard-section");
  if (dashboardSection && dashboardSection.classList.contains("active")) {
    createDashboardProfileWidget();
  }
}, 1000);

// Load company name on page load
window.addEventListener("DOMContentLoaded", function () {
  // Try localStorage first
  const savedName = localStorage.getItem("hrms_company_name");
  if (savedName) {
    updateCompanyName(savedName);
  }

  // Then load from server
  fetch("/api/settings/system")
    .then((response) => response.json())
    .then((data) => {
      if (data.success && data.settings && data.settings.company_name) {
        updateCompanyName(data.settings.company_name);
        localStorage.setItem("hrms_company_name", data.settings.company_name);
      }
    })
    .catch((err) => console.error("Error loading company name:", err));
});
