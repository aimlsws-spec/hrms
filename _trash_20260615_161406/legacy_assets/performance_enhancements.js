// Performance Weightage Configuration (Admin Only)
let performanceWeights = {
    high: 1.5,
    medium: 1.0,
    low: 0.5
};

// Load saved weights
function loadPerformanceWeights() {
    const saved = localStorage.getItem('hrms_performance_weights');
    if (saved) {
        performanceWeights = JSON.parse(saved);
    }
}

// Save weights
function savePerformanceWeights() {
    localStorage.setItem('hrms_performance_weights', JSON.stringify(performanceWeights));
}

// Configure Performance Weights (Admin Only)
function configurePerformanceWeights() {
    if (currentUser.role !== 'admin') {
        alert('Access Denied: Only Admin can configure performance weights.');
        return;
    }

    const html = `
        <h3 style="margin-bottom: 20px; color: #1e293b;">Configure Performance Weights</h3>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <h4 style="color: #1d4ed8; margin: 0 0 8px 0;">⚙️ Priority Weightage System</h4>
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
                Adjust how much each priority level affects performance scores. Higher weight = more impact on score.
            </p>
        </div>
        <form id="weightsForm" style="display: grid; gap: 16px;">
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">High Priority Weight</label>
                <input type="number" id="highWeight" value="${performanceWeights.high}" step="0.1" min="0.1" max="3.0" 
                    style="width: 100%; padding: 12px; border: 2px solid #d1d5db; border-radius: 8px; font-size: 16px;">
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Default: 1.5 (High priority tasks worth 50% more)</p>
            </div>
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Medium Priority Weight</label>
                <input type="number" id="mediumWeight" value="${performanceWeights.medium}" step="0.1" min="0.1" max="3.0" 
                    style="width: 100%; padding: 12px; border: 2px solid #d1d5db; border-radius: 8px; font-size: 16px;">
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Default: 1.0 (Standard weight)</p>
            </div>
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Low Priority Weight</label>
                <input type="number" id="lowWeight" value="${performanceWeights.low}" step="0.1" min="0.1" max="3.0" 
                    style="width: 100%; padding: 12px; border: 2px solid #d1d5db; border-radius: 8px; font-size: 16px;">
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Default: 0.5 (Low priority tasks worth 50% less)</p>
            </div>
            <div style="display: flex; gap: 12px; margin-top: 16px;">
                <button type="submit" class="btn btn-primary">Save Weights</button>
                <button type="button" class="btn btn-secondary" onclick="resetDefaultWeights()">Reset to Default</button>
                <button type="button" class="btn btn-secondary" onclick="displayResults('taskResults', '<p style=\\"color: #64748b;\\">Select an action above.</p>')">Cancel</button>
            </div>
        </form>
    `;

    displayResults('taskResults', html);

    setTimeout(() => {
        document.getElementById('weightsForm').addEventListener('submit', function(e) {
            e.preventDefault();
            performanceWeights.high = parseFloat(document.getElementById('highWeight').value);
            performanceWeights.medium = parseFloat(document.getElementById('mediumWeight').value);
            performanceWeights.low = parseFloat(document.getElementById('lowWeight').value);
            savePerformanceWeights();
            
            displayResults('taskResults', `
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px;">
                    <h3 style="color: #15803d; margin: 0 0 8px 0;">✓ Weights Updated Successfully!</h3>
                    <p style="margin: 4px 0; color: #166534;"><strong>High Priority:</strong> ${performanceWeights.high}x</p>
                    <p style="margin: 4px 0; color: #166534;"><strong>Medium Priority:</strong> ${performanceWeights.medium}x</p>
                    <p style="margin: 4px 0; color: #166534;"><strong>Low Priority:</strong> ${performanceWeights.low}x</p>
                    <button onclick="viewTaskPerformance()" class="btn btn-primary" style="margin-top: 12px;">View Performance</button>
                </div>
            `);
        });
    }, 100);
}

function resetDefaultWeights() {
    document.getElementById('highWeight').value = 1.5;
    document.getElementById('mediumWeight').value = 1.0;
    document.getElementById('lowWeight').value = 0.5;
}

// Start Task (Track actual start time)
function startTask(taskId) {
    const taskIndex = tasks.findIndex(t => t.task_id === taskId);
    if (taskIndex !== -1) {
        const task = tasks[taskIndex];
        if (task.status === 'Pending') {
            task.status = 'In Progress';
            task.actual_start_date = new Date().toISOString();
            saveTasks();
            alert('Task started! Timer is now tracking.');
            viewMyTasks();
        } else {
            alert('Task already started or completed.');
        }
    }
}

// Monthly/Quarterly Performance Review
function viewPerformanceByPeriod() {
    if (currentUser.role !== 'admin') {
        alert('Access Denied: Only Admin can view period-based performance.');
        return;
    }

    const html = `
        <h3 style="margin-bottom: 20px; color: #1e293b;">Performance Review by Period</h3>
        <form id="periodForm" style="display: grid; gap: 16px; max-width: 500px;">
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Select Period</label>
                <select id="periodType" style="width: 100%; padding: 12px; border: 2px solid #d1d5db; border-radius: 8px;">
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                    <option value="year">This Year</option>
                    <option value="custom">Custom Range</option>
                </select>
            </div>
            <div id="customDates" style="display: none;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Start Date</label>
                <input type="date" id="startDate" style="width: 100%; padding: 12px; border: 2px solid #d1d5db; border-radius: 8px;">
                <label style="display: block; margin: 12px 0 8px 0; font-weight: 600; color: #374151;">End Date</label>
                <input type="date" id="endDate" style="width: 100%; padding: 12px; border: 2px solid #d1d5db; border-radius: 8px;">
            </div>
            <button type="submit" class="btn btn-primary">Generate Report</button>
        </form>
    `;

    displayResults('taskResults', html);

    setTimeout(() => {
        document.getElementById('periodType').addEventListener('change', function() {
            document.getElementById('customDates').style.display = this.value === 'custom' ? 'block' : 'none';
        });

        document.getElementById('periodForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const periodType = document.getElementById('periodType').value;
            let startDate, endDate;

            const now = new Date();
            if (periodType === 'month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            } else if (periodType === 'quarter') {
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1);
                endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
            } else if (periodType === 'year') {
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
            } else {
                startDate = new Date(document.getElementById('startDate').value);
                endDate = new Date(document.getElementById('endDate').value);
            }

            generatePeriodPerformance(startDate, endDate, periodType);
        });
    }, 100);
}

function generatePeriodPerformance(startDate, endDate, periodType) {
    const filteredTasks = tasks.filter(task => {
        const taskDate = new Date(task.created_at || task.assigned_date);
        return taskDate >= startDate && taskDate <= endDate;
    });

    if (filteredTasks.length === 0) {
        displayResults('taskResults', '<p style="color: #64748b;">No tasks found in this period.</p>');
        return;
    }

    const employeePerformance = {};

    filteredTasks.forEach(task => {
        const empId = task.assigned_to;
        if (!employeePerformance[empId]) {
            employeePerformance[empId] = {
                name: empId,
                totalTasks: 0,
                completedTasks: 0,
                onTimeTasks: 0,
                delayedTasks: 0,
                weightedScore: 0,
                totalWeight: 0
            };
        }

        const perf = employeePerformance[empId];
        const weight = performanceWeights[task.priority.toLowerCase()] || 1.0;
        
        perf.totalTasks++;
        perf.totalWeight += weight;

        if (task.status === 'Completed') {
            perf.completedTasks++;
            perf.weightedScore += weight;

            if (task.assigned_end_date && task.actual_end_date) {
                const targetEnd = new Date(task.assigned_end_date);
                const actualEnd = new Date(task.actual_end_date);
                if (actualEnd <= targetEnd) {
                    perf.onTimeTasks++;
                } else {
                    perf.delayedTasks++;
                }
            }
        }
    });

    let html = `
        <h3 style="margin-bottom: 20px; color: #1e293b;">Performance Report: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</h3>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #1e40af;"><strong>Period:</strong> ${periodType.toUpperCase()}</p>
            <p style="margin: 4px 0 0 0; color: #1e40af;"><strong>Total Tasks:</strong> ${filteredTasks.length}</p>
        </div>
    `;

    Object.values(employeePerformance).forEach(perf => {
        const completionRate = perf.totalTasks > 0 ? ((perf.completedTasks / perf.totalTasks) * 100).toFixed(1) : 0;
        const onTimeRate = perf.completedTasks > 0 ? ((perf.onTimeTasks / perf.completedTasks) * 100).toFixed(1) : 0;
        const weightedPerformance = perf.totalWeight > 0 ? ((perf.weightedScore / perf.totalWeight) * 100).toFixed(1) : 0;

        html += `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                <h4 style="margin: 0 0 12px 0; color: #1e293b;">${perf.name}</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                    <div>
                        <p style="margin: 0; color: #64748b; font-size: 13px;">Total Tasks</p>
                        <p style="margin: 4px 0 0 0; color: #1e293b; font-size: 20px; font-weight: 700;">${perf.totalTasks}</p>
                    </div>
                    <div>
                        <p style="margin: 0; color: #64748b; font-size: 13px;">Completed</p>
                        <p style="margin: 4px 0 0 0; color: #22c55e; font-size: 20px; font-weight: 700;">${perf.completedTasks} (${completionRate}%)</p>
                    </div>
                    <div>
                        <p style="margin: 0; color: #64748b; font-size: 13px;">On-Time</p>
                        <p style="margin: 4px 0 0 0; color: #3b82f6; font-size: 20px; font-weight: 700;">${perf.onTimeTasks} (${onTimeRate}%)</p>
                    </div>
                    <div>
                        <p style="margin: 0; color: #64748b; font-size: 13px;">Weighted Score</p>
                        <p style="margin: 4px 0 0 0; color: #8b5cf6; font-size: 20px; font-weight: 700;">${weightedPerformance}%</p>
                    </div>
                </div>
            </div>
        `;
    });

    displayResults('taskResults', html);
}

// Initialize on load
loadPerformanceWeights();
