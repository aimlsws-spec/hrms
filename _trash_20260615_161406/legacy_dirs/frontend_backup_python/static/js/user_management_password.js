
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
// User Management - Password Change Functions

function showChangePasswordModal(userId, userName) {
  const modal = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 500px;">
                <h3>Change Password for ${userName}</h3>
                <p style="color: #64748b; margin-bottom: 20px;">User ID: ${userId}</p>
                
                <div class="settings-field" style="margin-bottom: 16px;">
                    <label>New Password</label>
                    <input type="password" id="admin_new_password" class="settings-input" placeholder="Enter new password">
                </div>
                
                <div class="settings-field" style="margin-bottom: 16px;">
                    <label>Confirm Password</label>
                    <input type="password" id="admin_confirm_password" class="settings-input" placeholder="Confirm new password">
                </div>
                
                <div style="background: #fff3cd; padding: 12px; border-radius: 6px; margin-bottom: 16px; border-left: 4px solid #ffc107;">
                    <i class="fas fa-info-circle"></i> The password will be updated in both the database and credentials file.
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="adminChangePassword('${userId}', '${userName}')">
                        <i class="fas fa-key"></i> Change Password
                    </button>
                    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </div>
        </div>
    `;
  document.body.insertAdjacentHTML("beforeend", modal);
}

function adminChangePassword(userId, userName) {
  const newPassword = document.getElementById("admin_new_password").value;
  const confirmPassword = document.getElementById(
    "admin_confirm_password",
  ).value;

  if (!newPassword || !confirmPassword) {
    alert("Please fill all fields");
    return;
  }

  if (newPassword !== confirmPassword) {
    alert("Passwords do not match");
    return;
  }

  if (newPassword.length < 6) {
    alert("Password must be at least 6 characters long");
    return;
  }

  if (!confirm(`Are you sure you want to change password for ${userName}?`)) {
    return;
  }

  fetch("/api/security/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      current_user_id: currentUser.user_id,
      current_user_role: currentUser.role,
      new_password: newPassword,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert(`Password changed successfully for ${userName}!`);
        closeModal();
        // Reload credentials if on that page
        if (typeof loadCredentials === "function") {
          loadCredentials();
        }
      } else {
        alert("Error: " + (data.message || "Failed to change password"));
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error changing password");
    });
}

// Add this to user management table actions
function addPasswordChangeButton(userId, userName) {
  const isAdmin = currentUser.role === "admin";
  const isHR = currentUser.role === "hr";

  if (isAdmin || isHR) {
    return `
            <button class="btn-icon" onclick="showChangePasswordModal('${userId}', '${userName}')" title="Change Password">
                <i class="fas fa-key"></i>
            </button>
        `;
  }
  return "";
}
