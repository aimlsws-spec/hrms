
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

// ── Shared helpers ────────────────────────────────────────────────────────────

function _docShowResult(html) {
    displayResults('documentResults', html);
}

function _docLoading() {
    _docShowResult('<p style="color:#64748b;padding:16px;">Loading employees…</p>');
}

function _docError(msg) {
    _docShowResult('<p style="color:#ef4444;padding:16px;">' + msg + '</p>');
}

function _docCancel() {
    _docShowResult('<p style="color:#64748b;">Select a document type above to generate.</p>');
}

function _openDocWindow(html, title) {
    var w = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
    if (!w) { alert('Please allow pop-ups to view the document.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.document.title = title || 'Document';
}

function _empOptions(users) {
    var o = '<option value="">— Select Employee —</option>';
    (users || []).forEach(function(u) {
        var id   = u.user_id || u.employee_id || u.employee_code || '';
        var name = u.full_name || (u.first_name + ' ' + u.last_name) || id;
        o += '<option value="' + id + '">' + id + ' – ' + name + '</option>';
    });
    return o;
}

function _loadEmployees(callback) {
    _docLoading();
    fetch('/api/employees/search?query=')
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var emps = d.results || d.employees || [];
            if (!emps.length) { _docError('No employees found in the database.'); return; }
            callback(emps);
        })
        .catch(function(e) { _docError('Error loading employees: ' + e.message); });
}

function _btnStyle(color) {
    return 'background:' + color + ';color:#fff;border:none;padding:9px 20px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;margin-right:8px;';
}

// ── Generate Salary Slip ──────────────────────────────────────────────────────

window.generateSalarySlip = function() {
    _loadEmployees(function(emps) {
        var opts = _empOptions(emps);
        var now  = new Date().toISOString().slice(0, 7);
        _docShowResult(
            '<h3 style="margin-bottom:18px;color:#1e293b;">Generate Salary Slip</h3>' +
            '<form id="ssForm" style="display:grid;gap:14px;max-width:480px;">' +
            '  <div><label style="font-weight:600;font-size:13px;">Employee *</label><br>' +
            '    <select id="ssEmp" required style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">' + opts + '</select></div>' +
            '  <div><label style="font-weight:600;font-size:13px;">Month *</label><br>' +
            '    <input type="month" id="ssMonth" value="' + now + '" required style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></div>' +
            '  <div>' +
            '    <button type="submit" style="' + _btnStyle('#1e3a8a') + '">Generate</button>' +
            '    <button type="button" onclick="_docCancel()" style="' + _btnStyle('#94a3b8') + '">Cancel</button>' +
            '  </div>' +
            '</form>'
        );
        setTimeout(function() {
            var form = document.getElementById('ssForm');
            if (!form) return;
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                var empId = document.getElementById('ssEmp').value;
                var parts = document.getElementById('ssMonth').value.split('-');
                if (!empId) { alert('Please select an employee.'); return; }
                var btn = form.querySelector('button[type="submit"]');
                btn.textContent = 'Generating…'; btn.disabled = true;
                fetch('/api/documents/salary-slip', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({employee_id: empId, year: parseInt(parts[0]), month: parseInt(parts[1])})
                })
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    btn.textContent = 'Generate'; btn.disabled = false;
                    if (d.success) {
                        _openDocWindow(d.html, d.title);
                        if (typeof showToast === 'function') showToast('Salary slip generated!', 'success');
                        _docShowResult('<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:18px;"><b style="color:#15803d;">✓ Salary Slip Generated</b><br><p style="margin-top:8px;color:#166534;">Document opened in a new window. Use Print → Save as PDF.</p><button onclick="generateSalarySlip()" style="' + _btnStyle('#1e3a8a') + 'margin-top:12px;">Generate Another</button></div>');
                    } else {
                        _docError('Error: ' + (d.message || 'Failed to generate'));
                    }
                })
                .catch(function(e) { btn.textContent = 'Generate'; btn.disabled = false; _docError('Error: ' + e.message); });
            });
        }, 80);
    });
};

// ── Generate Offer Letter ─────────────────────────────────────────────────────

window.generateOfferLetter = function() {
    _loadEmployees(function(emps) {
        var opts    = _empOptions(emps);
        var today   = new Date().toISOString().split('T')[0];
        _docShowResult(
            '<h3 style="margin-bottom:18px;color:#1e293b;">Generate Offer Letter</h3>' +
            '<form id="olForm" style="display:grid;gap:14px;max-width:480px;">' +
            '  <div><label style="font-weight:600;font-size:13px;">Employee *</label><br>' +
            '    <select id="olEmp" required style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">' + opts + '</select></div>' +
            '  <div><label style="font-weight:600;font-size:13px;">Position / Designation</label><br>' +
            '    <input type="text" id="olPos" placeholder="e.g. Software Engineer" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></div>' +
            '  <div><label style="font-weight:600;font-size:13px;">Annual CTC (₹)</label><br>' +
            '    <input type="number" id="olSal" placeholder="e.g. 600000" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></div>' +
            '  <div><label style="font-weight:600;font-size:13px;">Date of Joining *</label><br>' +
            '    <input type="date" id="olJoin" value="' + today + '" required style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></div>' +
            '  <div>' +
            '    <button type="submit" style="' + _btnStyle('#1e3a8a') + '">Generate</button>' +
            '    <button type="button" onclick="_docCancel()" style="' + _btnStyle('#94a3b8') + '">Cancel</button>' +
            '  </div>' +
            '</form>'
        );
        setTimeout(function() {
            var form = document.getElementById('olForm');
            if (!form) return;
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                var empId = document.getElementById('olEmp').value;
                if (!empId) { alert('Please select an employee.'); return; }
                var btn = form.querySelector('button[type="submit"]');
                btn.textContent = 'Generating…'; btn.disabled = true;
                fetch('/api/documents/offer-letter', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        employee_id: empId,
                        position: document.getElementById('olPos').value,
                        salary: parseFloat(document.getElementById('olSal').value) || 0,
                        joining_date: document.getElementById('olJoin').value
                    })
                })
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    btn.textContent = 'Generate'; btn.disabled = false;
                    if (d.success) {
                        _openDocWindow(d.html, d.title);
                        if (typeof showToast === 'function') showToast('Offer letter generated!', 'success');
                        _docShowResult('<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:18px;"><b style="color:#15803d;">✓ Offer Letter Generated</b><br><p style="margin-top:8px;color:#166534;">Document opened in a new window. Use Print → Save as PDF.</p><button onclick="generateOfferLetter()" style="' + _btnStyle('#1e3a8a') + 'margin-top:12px;">Generate Another</button></div>');
                    } else {
                        _docError('Error: ' + (d.message || 'Failed'));
                    }
                })
                .catch(function(e) { btn.textContent = 'Generate'; btn.disabled = false; _docError('Error: ' + e.message); });
            });
        }, 80);
    });
};

// ── Generate Relieving Letter ─────────────────────────────────────────────────

window.generateRelievingLetter = function() {
    _loadEmployees(function(emps) {
        var opts  = _empOptions(emps);
        var today = new Date().toISOString().split('T')[0];
        _docShowResult(
            '<h3 style="margin-bottom:18px;color:#1e293b;">Generate Relieving Letter</h3>' +
            '<form id="rlForm" style="display:grid;gap:14px;max-width:480px;">' +
            '  <div><label style="font-weight:600;font-size:13px;">Employee *</label><br>' +
            '    <select id="rlEmp" required style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">' + opts + '</select></div>' +
            '  <div><label style="font-weight:600;font-size:13px;">Last Working Day *</label><br>' +
            '    <input type="date" id="rlLast" value="' + today + '" required style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></div>' +
            '  <div><label style="font-weight:600;font-size:13px;">Reason</label><br>' +
            '    <select id="rlReason" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">' +
            '      <option value="resignation">Resignation</option>' +
            '      <option value="mutual separation">Mutual Separation</option>' +
            '      <option value="contract completion">Contract Completion</option>' +
            '    </select></div>' +
            '  <div>' +
            '    <button type="submit" style="' + _btnStyle('#1e3a8a') + '">Generate</button>' +
            '    <button type="button" onclick="_docCancel()" style="' + _btnStyle('#94a3b8') + '">Cancel</button>' +
            '  </div>' +
            '</form>'
        );
        setTimeout(function() {
            var form = document.getElementById('rlForm');
            if (!form) return;
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                var empId = document.getElementById('rlEmp').value;
                if (!empId) { alert('Please select an employee.'); return; }
                var btn = form.querySelector('button[type="submit"]');
                btn.textContent = 'Generating…'; btn.disabled = true;
                fetch('/api/documents/relieving-letter', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        employee_id: empId,
                        last_day: document.getElementById('rlLast').value,
                        reason: document.getElementById('rlReason').value
                    })
                })
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    btn.textContent = 'Generate'; btn.disabled = false;
                    if (d.success) {
                        _openDocWindow(d.html, d.title);
                        if (typeof showToast === 'function') showToast('Relieving letter generated!', 'success');
                        _docShowResult('<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:18px;"><b style="color:#15803d;">✓ Relieving Letter Generated</b><br><p style="margin-top:8px;color:#166534;">Document opened in a new window. Use Print → Save as PDF.</p><button onclick="generateRelievingLetter()" style="' + _btnStyle('#1e3a8a') + 'margin-top:12px;">Generate Another</button></div>');
                    } else {
                        _docError('Error: ' + (d.message || 'Failed'));
                    }
                })
                .catch(function(e) { btn.textContent = 'Generate'; btn.disabled = false; _docError('Error: ' + e.message); });
            });
        }, 80);
    });
};

// ── Generate Experience Letter ────────────────────────────────────────────────

window.generateExperienceLetter = function() {
    _loadEmployees(function(emps) {
        var opts  = _empOptions(emps);
        var today = new Date().toISOString().split('T')[0];
        _docShowResult(
            '<h3 style="margin-bottom:18px;color:#1e293b;">Generate Experience Letter</h3>' +
            '<form id="elForm" style="display:grid;gap:14px;max-width:480px;">' +
            '  <div><label style="font-weight:600;font-size:13px;">Employee *</label><br>' +
            '    <select id="elEmp" required style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">' + opts + '</select></div>' +
            '  <div><label style="font-weight:600;font-size:13px;">Last Working Day</label><br>' +
            '    <input type="date" id="elLast" value="' + today + '" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></div>' +
            '  <div>' +
            '    <button type="submit" style="' + _btnStyle('#1e3a8a') + '">Generate</button>' +
            '    <button type="button" onclick="_docCancel()" style="' + _btnStyle('#94a3b8') + '">Cancel</button>' +
            '  </div>' +
            '</form>'
        );
        setTimeout(function() {
            var form = document.getElementById('elForm');
            if (!form) return;
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                var empId = document.getElementById('elEmp').value;
                if (!empId) { alert('Please select an employee.'); return; }
                var btn = form.querySelector('button[type="submit"]');
                btn.textContent = 'Generating…'; btn.disabled = true;
                fetch('/api/documents/experience-letter', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        employee_id: empId,
                        last_day: document.getElementById('elLast').value
                    })
                })
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    btn.textContent = 'Generate'; btn.disabled = false;
                    if (d.success) {
                        _openDocWindow(d.html, d.title);
                        if (typeof showToast === 'function') showToast('Experience letter generated!', 'success');
                        _docShowResult('<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:18px;"><b style="color:#15803d;">✓ Experience Letter Generated</b><br><p style="margin-top:8px;color:#166534;">Document opened in a new window. Use Print → Save as PDF.</p><button onclick="generateExperienceLetter()" style="' + _btnStyle('#1e3a8a') + 'margin-top:12px;">Generate Another</button></div>');
                    } else {
                        _docError('Error: ' + (d.message || 'Failed'));
                    }
                })
                .catch(function(e) { btn.textContent = 'Generate'; btn.disabled = false; _docError('Error: ' + e.message); });
            });
        }, 80);
    });
};

// ── Employee download (for employee role) ────────────────────────────────────

window.downloadDocument = function(docType) {
    var user = JSON.parse(localStorage.getItem('hrms_user') || '{}');
    if (!user.user_id) { alert('Please login first'); return; }
    var typeMap = {salary_slip: 'salary-slip', offer_letter: 'offer-letter', experience_letter: 'experience-letter'};
    var endpoint = typeMap[docType];
    if (!endpoint) { alert('Unknown document type'); return; }
    fetch('/api/documents/' + endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({employee_id: user.user_id})
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) {
            _openDocWindow(d.html, d.title);
        } else {
            _docError('Could not generate document: ' + (d.message || 'Contact HR'));
        }
    })
    .catch(function(e) { _docError('Error: ' + e.message); });
};
