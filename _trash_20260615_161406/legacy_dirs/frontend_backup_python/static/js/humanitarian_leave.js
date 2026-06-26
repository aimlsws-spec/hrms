
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
// Add humanitarian leave approval checkbox to existing leave management interface
function addHumanitarianOption() {
  // Find all leave request action areas
  const actionAreas = document.querySelectorAll(
    ".approve-section, .action-buttons, .leave-actions",
  );

  actionAreas.forEach((area) => {
    // Skip if already added
    if (area.querySelector(".humanitarian-checkbox")) return;

    // Create humanitarian checkbox
    const humanitarianDiv = document.createElement("div");
    humanitarianDiv.className = "humanitarian-checkbox";
    humanitarianDiv.innerHTML = `
            <label style="display: flex; align-items: center; margin: 10px 0; font-size: 14px;">
                <input type="checkbox" id="deductSalary" checked style="margin-right: 8px;">
                Deduct salary for this leave
            </label>
            <div style="font-size: 12px; color: #666; margin-left: 20px;">
                Uncheck for humanitarian cases where salary should not be deducted
            </div>
        `;

    // Insert before action buttons
    const buttons = area.querySelector("button, .approve-btn");
    if (buttons) {
      area.insertBefore(humanitarianDiv, buttons.parentElement || buttons);
    } else {
      area.appendChild(humanitarianDiv);
    }
  });
}

// Enhanced approve function that includes humanitarian option
function approveLeaveWithHumanitarian(requestId) {
  const actionArea = event.target.closest(
    ".approve-section, .action-buttons, .leave-actions",
  );
  const deductSalaryCheckbox = actionArea.querySelector("#deductSalary");
  const commentsField = actionArea.querySelector(
    'textarea, input[name="comments"]',
  );

  const data = {
    approved_by: "HR Manager",
    comments: commentsField ? commentsField.value : "",
    deduct_salary: deductSalaryCheckbox ? deductSalaryCheckbox.checked : true,
  };

  fetch(`/api/leave_requests/${requestId}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    .then((response) => response.json())
    .then((result) => {
      if (result.success) {
        alert(result.message);
        if (result.approval_letter_url) {
          window.open(result.approval_letter_url, "_blank");
        }
        location.reload();
      } else {
        alert("Error: " + result.message);
      }
    });
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", addHumanitarianOption);
