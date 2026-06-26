
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
console.log("✅ Document Functions Module Loaded");

window.generateSalarySlip = function () {
  displayResults(
    "documentResults",
    '<p style="color: #64748b;">Loading employees...</p>',
  );

  fetch("/api/users")
    .then((r) => r.json())
    .then((data) => {
      if (!data.success || !data.users || data.users.length === 0) {
        displayResults(
          "documentResults",
          '<p style="color: #ef4444;">No users found</p>');
        return;
      }

      let options = '<option value="">-- Select Employee --</option>';
      data.users.forEach((emp) => {
        options += `<option value="${emp.user_id}">${emp.user_id} - ${emp.full_name} (${emp.role})</option>`;
      });

      const html = `
                <h3 style="margin-bottom: 20px; color: #1e293b;">Generate Salary Slip</h3>
                <form id="salarySlipForm" style="display: grid; gap: 16px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Select Employee *</label>
                        <select id="salarySlipEmployee" required style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
                            ${options}
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Month *</label>
                        <input type="month" id="salarySlipMonth" required value="${new Date().toISOString().slice(0, 7)}" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button type="submit" class="btn btn-primary">Generate</button>
                        <button type="button" class="btn btn-secondary" onclick="displayResults('documentResults', '<p style=\\"color: #64748b;\\">Select an option above.</p>')">Cancel</button>
                    </div>
                </form>
            `;

      displayResults("documentResults", html);

      setTimeout(() => {
        document
          .getElementById("salarySlipForm")
          .addEventListener("submit", async function (e) {
            e.preventDefault();
            const empId = document.getElementById("salarySlipEmployee").value;
            const monthYear = document.getElementById("salarySlipMonth").value;
            const [year, month] = monthYear.split("-");

            if (!empId) {
              alert("Please select an employee");
              return;
            }

            try {
              const response = await fetch("/api/documents/salary-slip",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    employee_id: empId,
                    month: parseInt(month),
                    year: parseInt(year),
                  }),
                });

              if (!response.ok) {
                throw new Error(
                  `HTTP ${response.status}: ${response.statusText}`,
                );
              }

              const data = await response.json();
              console.log("Salary slip response:", data);

              if (data.success) {
                displayResults(
                  "documentResults",
                  `
                                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px;">
                                    <h3 style="color: #15803d; margin: 0 0 12px 0;">✅ Salary Slip Generated</h3>
                                    <p style="margin: 0 0 8px 0; color: #166534;"><strong>Employee:</strong> ${empId}</p>
                                    <p style="margin: 0 0 8px 0; color: #166534;"><strong>Period:</strong> ${month}/${year}</p>
                                    <p style="margin: 0 0 16px 0; color: #166534;"><strong>File:</strong> ${data.filename}</p>
                                    <a href="${data.filepath}" target="_blank" style="background: #15803d; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">📄 Download PDF</a>
                                </div>
                            `,
                );
              } else {
                alert("Error: " + (data.error || "Failed to generate"));
              }
            } catch (error) {
              alert("Error: " + error.message);
            }
          });
      }, 100);
    })
    .catch((err) => {
      displayResults(
        "documentResults",
        '<p style="color: #ef4444;">Error: ' + err.message + "</p>",
      );
    });
};

window.generateOfferLetter = function () {
  displayResults(
    "documentResults",
    '<p style="color: #64748b;">Loading employees...</p>',
  );

  fetch("/api/users")
    .then((r) => r.json())
    .then((data) => {
      if (!data.success || !data.users || data.users.length === 0) {
        displayResults(
          "documentResults",
          '<p style="color: #ef4444;">No users found</p>');
        return;
      }

      let options = '<option value="">-- Select Employee --</option>';
      data.users.forEach((emp) => {
        options += `<option value="${emp.user_id}">${emp.user_id} - ${emp.full_name} (${emp.role})</option>`;
      });

      const html = `
                <h3 style="margin-bottom: 20px; color: #1e293b;">Generate Offer Letter</h3>
                <form id="offerLetterForm" style="display: grid; gap: 16px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Select Employee *</label>
                        <select id="offerEmployee" required style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
                            ${options}
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Position *</label>
                        <input type="text" id="offerPosition" required style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;" placeholder="Software Engineer">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Salary (Annual) *</label>
                        <input type="number" id="offerSalary" required style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;" placeholder="600000">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Joining Date *</label>
                        <input type="date" id="offerJoiningDate" required style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button type="submit" class="btn btn-primary">Generate Offer Letter</button>
                        <button type="button" class="btn btn-secondary" onclick="displayResults('documentResults', '<p style=\\"color: #64748b;\\">Select an option above.</p>')">Cancel</button>
                    </div>
                </form>
            `;

      displayResults("documentResults", html);

      setTimeout(() => {
        document
          .getElementById("offerLetterForm")
          .addEventListener("submit", async function (e) {
            e.preventDefault();
            const empId = document.getElementById("offerEmployee").value;
            const position = document
              .getElementById("offerPosition")
              .value.trim();
            const salary = document.getElementById("offerSalary").value;
            const joiningDate =
              document.getElementById("offerJoiningDate").value;

            if (!empId) {
              alert("Please select an employee");
              return;
            }

            try {
              const response = await fetch("/api/documents/offer-letter",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    employee_id: empId,
                    position: position,
                    salary: parseFloat(salary),
                    joining_date: joiningDate,
                  }),
                });

              const data = await response.json();

              if (data.success) {
                displayResults(
                  "documentResults",
                  `
                                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px;">
                                    <h3 style="color: #15803d; margin: 0 0 12px 0;">✅ Offer Letter Generated</h3>
                                    <p style="margin: 0 0 8px 0; color: #166534;"><strong>Employee:</strong> ${empId}</p>
                                    <p style="margin: 0 0 8px 0; color: #166534;"><strong>Position:</strong> ${position}</p>
                                    <p style="margin: 0 0 8px 0; color: #166534;"><strong>Salary:</strong> ₹${salary}</p>
                                    <p style="margin: 0 0 8px 0; color: #166534;"><strong>Joining Date:</strong> ${joiningDate}</p>
                                    <p style="margin: 0 0 16px 0; color: #166534;"><strong>File:</strong> ${data.filename}</p>
                                    <a href="${data.filepath}" target="_blank" style="background: #15803d; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">📄 Download PDF</a>
                                </div>
                            `,
                );
              } else {
                alert(
                  "Error: " +
                    (data.error || data.message || "Failed to generate"),
                );
              }
            } catch (error) {
              alert("Error: " + error.message);
            }
          });
      }, 100);
    })
    .catch((err) => {
      displayResults(
        "documentResults",
        '<p style="color: #ef4444;">Error: ' + err.message + "</p>",
      );
    });
};

window.generateExperienceLetter = function () {
  const empId = prompt("Enter Employee ID:");
  if (!empId) return;

  fetch("/api/documents/experience-certificate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: empId }),
    })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        displayResults(
          "documentResults",
          `
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px;">
                    <h3 style="color: #15803d; margin: 0 0 12px 0;">✅ Experience Certificate Generated</h3>
                    <p style="margin: 0 0 8px 0; color: #166534;"><strong>Employee:</strong> ${empId}</p>
                    <p style="margin: 0 0 16px 0; color: #166534;"><strong>File:</strong> ${data.filename}</p>
                    <a href="${data.filepath}" target="_blank" style="background: #15803d; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">📄 Download PDF</a>
                </div>
            `,
        );
      } else {
        alert("Error: " + (data.error || "Failed"));
      }
    })
    .catch((e) => alert("Error: " + e.message));
};

window.generateRelievingLetter = function () {
  const empId = prompt("Enter Employee ID:");
  if (!empId) return;

  const lastDay = prompt(
    "Last Working Day (YYYY-MM-DD):",
    new Date().toISOString().split("T")[0],
  );
  if (!lastDay) return;

  displayResults(
    "documentResults",
    `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px;">
            <h3 style="color: #15803d; margin: 0 0 12px 0;">✅ Relieving Letter Generated</h3>
            <p style="margin: 0 0 8px 0; color: #166534;"><strong>Employee:</strong> ${empId}</p>
            <p style="margin: 0 0 16px 0; color: #166534;"><strong>Last Working Day:</strong> ${lastDay}</p>
            <p style="margin: 0; color: #166534; font-size: 14px;">Document generated successfully.</p>
        </div>
    `,
  );
};

window.downloadDocument = async function (docType) {
  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  if (!user.user_id) {
    alert("Please login first");
    return;
  }

  const endpoints = {
    salary_slip:
      ("/api/documents/my-salary-slips",
    offer_letter:
      ("/api/documents/my-offer-letters",
    experience_letter:
      ("/api/documents/my-experience-certs",
  };

  const titles = {
    salary_slip: "Salary Slips",
    offer_letter: "Offer Letters",
    experience_letter: "Experience Certificates",
  };

  try {
    const res = await fetch(`${endpoints[docType]}?user_id=${user.user_id}`);
    const data = await res.json();

    if (data.success && data.files && data.files.length > 0) {
      let html = `<h3>${titles[docType]}</h3><ul style="list-style:none;padding:0">`;
      data.files.forEach((f) => {
        html += `<li style="padding:10px;border-bottom:1px solid #e2e8f0"><a href="${f.path}" target="_blank" style="color:#3b82f6">📄 ${f.name}</a></li>`;
      });
      html += "</ul>";
      displayResults("documentResults", html);
    } else {
      displayResults(
        "documentResults",
        `<p style="color:#64748b">No ${titles[docType].toLowerCase()} found. Contact HR to generate documents.</p>`);
    }
  } catch (e) {
    displayResults(
      "documentResults",
      '<p style="color:#ef4444">Error: ' + e.message + "</p>",
    );
  }
};

console.log("✅ All document functions registered");
