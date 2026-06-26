
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
// Charts Initialization for Analytics and Reports Sections

// Initialize all charts when Analytics section is loaded
function initializeAnalyticsCharts() {
    initDepartmentChart();
    initEmployeeGrowthChart();
    initLeaveStatusChart();
    initTaskCompletionChart();
}

// Initialize all charts when Reports section is loaded
function initializeReportsCharts() {
    initAttendanceTrendChart();
    initLeaveTypeChart();
}

// Initialize Leave Management charts
function initializeLeaveCharts() {
    initLeaveBalanceChart();
    initLeaveRequestsChart();
}

// Initialize Task Manager charts
function initializeTaskCharts() {
    initTaskStatusChart();
    initTaskPriorityChart();
}

// Initialize Employee Management charts
function initializeEmployeeCharts() {
    initEmployeeDeptChart();
    initEmployeeStatusChart();
}

// Department Distribution Chart (Doughnut)
function initDepartmentChart() {
    const ctx = document.getElementById('departmentChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['IT', 'HR', 'Finance', 'Operations', 'Sales', 'Marketing'],
            datasets: [{
                data: [25, 15, 12, 20, 18, 10],
                backgroundColor: [
                    '#3b82f6',
                    '#10b981',
                    '#f59e0b',
                    '#8b5cf6',
                    '#ef4444',
                    '#06b6d4'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed + ' employees';
                        }
                    }
                }
            }
        }
    });
}

// Employee Growth Trend Chart (Line)
function initEmployeeGrowthChart() {
    const ctx = document.getElementById('employeeGrowthChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Total Employees',
                data: [85, 88, 90, 92, 95, 97, 98, 100, 102, 105, 108, 110],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        stepSize: 5
                    }
                }
            }
        }
    });
}

// Leave Status Overview Chart (Bar)
function initLeaveStatusChart() {
    const ctx = document.getElementById('leaveStatusChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Approved', 'Pending', 'Rejected'],
            datasets: [{
                label: 'Leave Requests',
                data: [45, 12, 8],
                backgroundColor: [
                    '#10b981',
                    '#f59e0b',
                    '#ef4444'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 10
                    }
                }
            }
        }
    });
}

// Task Completion Rate Chart (Doughnut)
function initTaskCompletionChart() {
    const ctx = document.getElementById('taskCompletionChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'In Progress', 'To Do'],
            datasets: [{
                data: [65, 25, 10],
                backgroundColor: [
                    '#10b981',
                    '#3b82f6',
                    '#f59e0b'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed + '%';
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
}

// Monthly Attendance Trend Chart (Line)
function initAttendanceTrendChart() {
    const ctx = document.getElementById('attendanceTrendChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Attendance Rate (%)',
                data: [92, 94, 93, 95, 94, 96, 95, 94, 93, 95, 96, 94],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 85,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

// Leave Type Distribution Chart (Pie)
function initLeaveTypeChart() {
    const ctx = document.getElementById('leaveTypeChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Sick Leave', 'Casual Leave', 'Paid Leave', 'Emergency Leave'],
            datasets: [{
                data: [30, 35, 25, 10],
                backgroundColor: [
                    '#ef4444',
                    '#3b82f6',
                    '#10b981',
                    '#f59e0b'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed + ' days';
                        }
                    }
                }
            }
        }
    });
}

// Auto-initialize charts when sections are shown
document.addEventListener('DOMContentLoaded', function() {
    // Listen for section changes
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.target.id === 'analytics-section' && mutation.target.classList.contains('active')) {
                setTimeout(initializeAnalyticsCharts, 100);
            }
            if (mutation.target.id === 'reports-section' && mutation.target.classList.contains('active')) {
                setTimeout(initializeReportsCharts, 100);
            }
        });
    });
    
    // Observe all section elements
    document.querySelectorAll('.section-content').forEach(function(section) {
        observer.observe(section, { attributes: true, attributeFilter: ['class'] });
    });
});


// Leave Balance Chart (Horizontal Bar)
function initLeaveBalanceChart() {
    const ctx = document.getElementById('leaveBalanceChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Sick Leave', 'Casual Leave', 'Paid Leave'],
            datasets: [{
                label: 'Days Available',
                data: [6, 6, 6],
                backgroundColor: ['#ef4444', '#3b82f6', '#10b981'],
                borderWidth: 0
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 10
                }
            }
        }
    });
}

// Leave Requests Chart (Line)
function initLeaveRequestsChart() {
    const ctx = document.getElementById('leaveRequestsChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Leave Requests',
                data: [8, 6, 10, 7, 9, 12, 8, 6, 7, 9, 11, 10],
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 5 }
                }
            }
        }
    });
}

// Task Status Chart (Doughnut)
function initTaskStatusChart() {
    const ctx = document.getElementById('taskStatusChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['To Do', 'In Progress', 'Completed'],
            datasets: [{
                data: [15, 25, 60],
                backgroundColor: ['#f59e0b', '#3b82f6', '#10b981'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 15, font: { size: 12 } }
                }
            },
            cutout: '60%'
        }
    });
}

// Task Priority Chart (Bar)
function initTaskPriorityChart() {
    const ctx = document.getElementById('taskPriorityChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['High', 'Medium', 'Low'],
            datasets: [{
                label: 'Tasks',
                data: [12, 28, 18],
                backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 10 }
                }
            }
        }
    });
}

// Employee Department Chart (Bar)
function initEmployeeDeptChart() {
    const ctx = document.getElementById('employeeDeptChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['IT', 'HR', 'Finance', 'Operations', 'Sales', 'Marketing'],
            datasets: [{
                label: 'Employees',
                data: [25, 15, 12, 20, 18, 10],
                backgroundColor: '#3b82f6',
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 5 }
                }
            }
        }
    });
}

// Employee Status Chart (Pie)
function initEmployeeStatusChart() {
    const ctx = document.getElementById('employeeStatusChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Active', 'On Leave', 'Inactive'],
            datasets: [{
                data: [85, 10, 5],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 15, font: { size: 12 } }
                }
            }
        }
    });
}

// Auto-initialize charts when sections are shown
document.addEventListener('DOMContentLoaded', function() {
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.target.id === 'analytics-section' && mutation.target.classList.contains('active')) {
                setTimeout(initializeAnalyticsCharts, 100);
            }
            if (mutation.target.id === 'reports-section' && mutation.target.classList.contains('active')) {
                setTimeout(initializeReportsCharts, 100);
            }
            // Removed leaves, tasks, employees - handled by section_charts.js
        });
    });
    
    document.querySelectorAll('.section-content').forEach(function(section) {
        observer.observe(section, { attributes: true, attributeFilter: ['class'] });
    });
});
