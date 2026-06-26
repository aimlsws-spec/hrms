// Final Settlement (F&F) UI Functions

function showFnFSection() {
    const content = `
        <div class="section-header">
            <h2>Final Settlement (F&F) Calculation</h2>
        </div>
        
        <div class="fnf-tabs">
            <button class="tab-btn active" onclick="showFnFCalculator()">Calculate F&F</button>
            <button class="tab-btn" onclick="showFnFHistory()">Settlement History</button>
        </div>
        
        <div id="fnfContent"></div>
    `;
    
    document.getElementById('mainContent').innerHTML = content;
    showFnFCalculator();
}

function showFnFCalculator() {
    const content = `
        <div class="form-container">
            <h3>Calculate Final Settlement</h3>
            <form id="fnfForm" onsubmit="calculateFnF(event)">
                <div class="form-group">
                    <label>Employee ID *</label>
                    <input type="text" id="fnf_employee_id" required>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Resignation Date *</label>
                        <input type="date" id="fnf_resignation_date" required>
                    </div>
                    <div class="form-group">
                        <label>Last Working Day *</label>
                        <input type="date" id="fnf_last_working_day" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Notice Period Served (Days) *</label>
                        <input type="number" id="fnf_notice_days" min="0" required>
                    </div>
                    <div class="form-group">
                        <label>Earned Leave Days *</label>
                        <input type="number" id="fnf_leave_days" min="0" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Advance Recovery (₹)</label>
                        <input type="number" id="fnf_advance" min="0" step="0.01" value="0">
                    </div>
                    <div class="form-group">
                        <label>Other Deductions (₹)</label>
                        <input type="number" id="fnf_other_deductions" min="0" step="0.01" value="0">
                    </div>
                </div>
                
                <button type="submit" class="btn-primary">Calculate Settlement</button>
            </form>
            
            <div id="fnfResult" style="display:none; margin-top: 20px;"></div>
        </div>
    `;
    
    document.getElementById('fnfContent').innerHTML = content;
    setActiveTab(0);
}

function showFnFHistory() {
    setActiveTab(1);
    fetch('/api/payroll/fnf/all')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                displayFnFHistory(data.data);
            }
        })
        .catch(err => console.error('Error:', err));
}

function calculateFnF(event) {
    event.preventDefault();
    
    const formData = {
        employee_id: document.getElementById('fnf_employee_id').value,
        resignation_date: document.getElementById('fnf_resignation_date').value,
        last_working_day: document.getElementById('fnf_last_working_day').value,
        notice_period_days: parseInt(document.getElementById('fnf_notice_days').value),
        earned_leave_days: parseInt(document.getElementById('fnf_leave_days').value),
        advance_recovery: parseFloat(document.getElementById('fnf_advance').value) || 0,
        other_deductions: parseFloat(document.getElementById('fnf_other_deductions').value) || 0,
        processed_by: currentUser.employee_id
    };
    
    fetch('/api/payroll/fnf/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            displayFnFResult(data.data);
            showNotification('F&F settlement calculated successfully!', 'success');
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    })
    .catch(err => {
        showNotification('Error calculating settlement', 'error');
        console.error('Error:', err);
    });
}

function displayFnFResult(data) {
    const resultDiv = document.getElementById('fnfResult');
    resultDiv.style.display = 'block';
    
    resultDiv.innerHTML = `
        <div class="fnf-result-card">
            <h3>Settlement Calculation - ${data.employee_id}</h3>
            
            <div class="fnf-section">
                <h4>Earnings</h4>
                <table class="fnf-table">
                    <tr>
                        <td>Pending Salary</td>
                        <td class="amount">₹${data.pending_salary.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Leave Encashment</td>
                        <td class="amount">₹${data.leave_encashment.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Bonus/Incentives</td>
                        <td class="amount">₹${data.bonus_amount.toFixed(2)}</td>
                    </tr>
                    <tr class="total-row">
                        <td><strong>Gross Amount</strong></td>
                        <td class="amount"><strong>₹${data.gross_amount.toFixed(2)}</strong></td>
                    </tr>
                </table>
            </div>
            
            <div class="fnf-section">
                <h4>Deductions</h4>
                <table class="fnf-table">
                    <tr>
                        <td>Notice Period Recovery</td>
                        <td class="amount">₹${data.notice_recovery.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Advance Recovery</td>
                        <td class="amount">₹${data.advance_recovery.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Other Deductions</td>
                        <td class="amount">₹${data.other_deductions.toFixed(2)}</td>
                    </tr>
                    <tr class="total-row">
                        <td><strong>Total Deductions</strong></td>
                        <td class="amount"><strong>₹${data.total_deductions.toFixed(2)}</strong></td>
                    </tr>
                </table>
            </div>
            
            <div class="fnf-net-settlement">
                <h3>Net Settlement Amount: ₹${data.net_settlement.toFixed(2)}</h3>
            </div>
        </div>
    `;
}

function displayFnFHistory(settlements) {
    let html = `
        <div class="table-container">
            <h3>Settlement History</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Employee ID</th>
                        <th>Employee Name</th>
                        <th>Last Working Day</th>
                        <th>Gross Amount</th>
                        <th>Deductions</th>
                        <th>Net Settlement</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    settlements.forEach(s => {
        html += `
            <tr>
                <td>${s.employee_id}</td>
                <td>${s.employee_name || 'N/A'}</td>
                <td>${s.last_working_day}</td>
                <td>₹${parseFloat(s.gross_amount).toFixed(2)}</td>
                <td>₹${parseFloat(s.total_deductions).toFixed(2)}</td>
                <td><strong>₹${parseFloat(s.net_settlement).toFixed(2)}</strong></td>
                <td><span class="status-badge ${s.status.toLowerCase()}">${s.status}</span></td>
                <td><button class="btn-small" onclick="viewFnFDetails('${s.employee_id}')">View</button></td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    document.getElementById('fnfContent').innerHTML = html;
}

function viewFnFDetails(employeeId) {
    fetch(`/api/payroll/fnf/${employeeId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                displayFnFResult(data.data);
            }
        })
        .catch(err => console.error('Error:', err));
}

function setActiveTab(index) {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
    });
}
