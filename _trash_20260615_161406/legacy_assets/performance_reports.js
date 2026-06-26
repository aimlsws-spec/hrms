// Performance Reports JavaScript Functions
// Handles both Task Manager Performance Metrics (own reports) and Performance Reports (all employees)

// Function to view task performance for current user (Task Manager section)
function viewTaskPerformance() {
    if (!currentUser) {
        alert('User not authenticated');
        return;
    }
    
    displayResults('taskResults', '<p style="color: #64748b;">Loading your task performance...</p>');
    
    fetch(`/api/performance/my-tasks/${currentUser.user_id}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayMyTaskPerformance(data.data);
            } else {
                displayResults('taskResults', '<p style="color: #ef4444;">Error loading task performance: ' + (data.message || 'Unknown error') + '</p>');
            }
        })
        .catch(error => {
            console.error('Error loading task performance:', error);
            displayResults('taskResults', '<p style="color: #ef4444;">Error loading task performance: ' + error.message + '</p>');
        });
}

// Function to display individual task performance
function displayMyTaskPerformance(data) {
    const { tasks, metrics } = data;
    
    let html = `
        <h3 style="margin-bottom: 20px; color: #1e293b;">📊 My Task Performance Metrics</h3>
        
        <!-- Performance Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 30px;">
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; text-align: center;">
                <h4 style="color: #1d4ed8; margin: 0 0 8px 0;">📋 Total Tasks</h4>
                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1e293b;">${metrics.total_tasks}</p>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Assigned to me</p>
            </div>
            
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; text-align: center;">
                <h4 style="color: #15803d; margin: 0 0 8px 0;">✅ Completed</h4>
                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1e293b;">${metrics.completed_tasks}</p>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Finished tasks</p>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; text-align: center;">
                <h4 style="color: #b45309; margin: 0 0 8px 0;">🔄 In Progress</h4>
                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1e293b;">${metrics.in_progress_tasks}</p>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Active tasks</p>
            </div>
            
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; text-align: center;">
                <h4 style="color: #dc2626; margin: 0 0 8px 0;">⏳ Pending</h4>
                <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1e293b;">${metrics.pending_tasks}</p>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Not started</p>
            </div>
        </div>
        
        <!-- Performance Metrics -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h4 style="color: #1e293b; margin: 0 0 16px 0;">📈 Performance Metrics</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px;">
                    <h5 style="color: #3b82f6; margin: 0 0 8px 0;">Completion Rate</h5>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="flex: 1; background: #e2e8f0; border-radius: 4px; height: 8px;">
                            <div style="background: #22c55e; height: 100%; border-radius: 4px; width: ${metrics.completion_rate}%;"></div>
                        </div>
                        <span style="font-weight: 600; color: #1e293b;">${metrics.completion_rate}%</span>
                    </div>
                </div>
                
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px;">
                    <h5 style="color: #3b82f6; margin: 0 0 8px 0;">Average Completion Time</h5>
                    <p style="margin: 0; font-size: 24px; font-weight: 600; color: #1e293b;">${metrics.avg_completion_days} days</p>
                </div>
            </div>
        </div>
    `;
    
    // Add task list if there are tasks
    if (tasks && tasks.length > 0) {
        html += `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="padding: 20px; border-bottom: 1px solid #e2e8f0;">
                    <h4 style="margin: 0; color: #1e293b;">📋 My Tasks</h4>
                </div>
                <div style="max-height: 400px; overflow-y: auto;">
        `;
        
        tasks.forEach(task => {
            const statusColor = {
                'Completed': '#22c55e',
                'In Progress': '#f59e0b',
                'Pending': '#ef4444',
                'To Do': '#6b7280'
            }[task.status] || '#6b7280';
            
            const priorityColor = {
                'High': '#ef4444',
                'Medium': '#f59e0b',
                'Low': '#22c55e'
            }[task.priority] || '#6b7280';
            
            html += `
                <div style="padding: 16px; border-bottom: 1px solid #f1f5f9;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <h5 style="margin: 0; color: #1e293b; font-weight: 600;">${task.title}</h5>
                        <div style="display: flex; gap: 8px;">
                            <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">${task.status}</span>
                            <span style="background: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">${task.priority}</span>
                        </div>
                    </div>
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">${task.description || 'No description'}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #9ca3af;">
                        <span>Category: ${task.category}</span>
                        <span>Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</span>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    } else {
        html += `
            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; text-align: center;">
                <h4 style="color: #b45309; margin: 0 0 8px 0;">📋 No Tasks Found</h4>
                <p style="margin: 0; color: #92400e;">You don't have any tasks assigned yet.</p>
            </div>
        `;
    }
    
    displayResults('taskResults', html);
}

// Function to view all performance reports (HR/Admin only)
function viewAllPerformanceReports() {
    if (currentUser.role !== 'admin' && currentUser.role !== 'hr') {
        alert('Access Denied: Only HR and Admin can view all performance reports.');
        return;
    }
    
    displayResults('taskResults', '<p style="color: #64748b;">Loading all employee performance reports...</p>');
    
    fetch('/api/performance/reports/all')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayAllPerformanceReports(data.data);
            } else {
                displayResults('taskResults', '<p style="color: #ef4444;">Error loading performance reports: ' + (data.message || 'Unknown error') + '</p>');
            }
        })
        .catch(error => {
            console.error('Error loading performance reports:', error);
            displayResults('taskResults', '<p style="color: #ef4444;">Error loading performance reports: ' + error.message + '</p>');
        });
}

// Function to display all employee performance reports
function displayAllPerformanceReports(employees) {
    let html = `
        <h3 style="margin-bottom: 20px; color: #1e293b;">📊 All Employee Performance Reports</h3>
        <p style="margin-bottom: 20px; color: #64748b;">Comprehensive performance overview including task completion and performance reviews</p>
    `;
    
    if (!employees || employees.length === 0) {
        html += `
            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; text-align: center;">
                <h4 style="color: #b45309; margin: 0 0 8px 0;">📋 No Performance Data</h4>
                <p style="margin: 0; color: #92400e;">No employee performance data found.</p>
            </div>
        `;
        displayResults('taskResults', html);
        return;
    }
    
    // Add filter and sort options
    html += `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Filter by Department:</label>
                    <select id="departmentFilter" onchange="filterPerformanceReports()" style="padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px;">
                        <option value="">All Departments</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Sort by:</label>
                    <select id="sortBy" onchange="sortPerformanceReports()" style="padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px;">
                        <option value="name">Name</option>
                        <option value="completion_rate">Completion Rate</option>
                        <option value="total_tasks">Total Tasks</option>
                        <option value="latest_rating">Latest Rating</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    
    // Create employee performance cards
    html += '<div id="performanceReportsContainer" style="display: grid; gap: 16px;">';
    
    // Get unique departments for filter
    const departments = [...new Set(employees.map(emp => emp.department).filter(dept => dept))];
    
    employees.forEach(employee => {
        const completionRate = employee.completion_rate || 0;
        const totalTasks = employee.total_tasks || 0;
        const completedTasks = employee.completed_tasks || 0;
        const latestRating = employee.latest_rating || 'N/A';
        
        // Determine performance color based on completion rate
        let performanceColor = '#ef4444'; // Red for poor
        if (completionRate >= 80) performanceColor = '#22c55e'; // Green for excellent
        else if (completionRate >= 60) performanceColor = '#f59e0b'; // Yellow for good
        
        html += `
            <div class="performance-report-card" data-department="${employee.department || ''}" style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                    <div>
                        <h4 style="margin: 0 0 4px 0; color: #1e293b; font-weight: 600;">${employee.name}</h4>
                        <p style="margin: 0; color: #64748b; font-size: 14px;">${employee.title} • ${employee.department || 'No Department'}</p>
                    </div>
                    <button onclick="viewEmployeeDetailedReport('${employee.employee_id}')" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">View Details</button>
                </div>
                
                <!-- Task Performance Metrics -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px;">
                    <div style="text-align: center; padding: 12px; background: #f8fafc; border-radius: 6px;">
                        <p style="margin: 0; font-size: 20px; font-weight: 700; color: #1e293b;">${totalTasks}</p>
                        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Total Tasks</p>
                    </div>
                    <div style="text-align: center; padding: 12px; background: #f0fdf4; border-radius: 6px;">
                        <p style="margin: 0; font-size: 20px; font-weight: 700; color: #15803d;">${completedTasks}</p>
                        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Completed</p>
                    </div>
                    <div style="text-align: center; padding: 12px; background: #eff6ff; border-radius: 6px;">
                        <p style="margin: 0; font-size: 20px; font-weight: 700; color: ${performanceColor};">${completionRate}%</p>
                        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Completion Rate</p>
                    </div>
                    <div style="text-align: center; padding: 12px; background: #faf5ff; border-radius: 6px;">
                        <p style="margin: 0; font-size: 20px; font-weight: 700; color: #8b5cf6;">${latestRating}</p>
                        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Latest Rating</p>
                    </div>
                </div>
                
                <!-- Performance Progress Bar -->
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-size: 14px; font-weight: 500; color: #374151;">Overall Performance</span>
                        <span style="font-size: 14px; font-weight: 600; color: ${performanceColor};">${completionRate}%</span>
                    </div>
                    <div style="background: #e2e8f0; border-radius: 4px; height: 8px;">
                        <div style="background: ${performanceColor}; height: 100%; border-radius: 4px; width: ${completionRate}%;"></div>
                    </div>
                </div>
                
                <!-- Recent Reviews -->
                ${employee.recent_reviews && employee.recent_reviews.length > 0 ? `
                    <div style="border-top: 1px solid #f1f5f9; padding-top: 12px;">
                        <h6 style="margin: 0 0 8px 0; color: #374151; font-size: 14px;">Recent Reviews:</h6>
                        ${employee.recent_reviews.slice(0, 2).map(review => `
                            <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">
                                ${review.review_period}: ${review.overall_rating}/5.0 (${review.status})
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    
    displayResults('taskResults', html);
    
    // Populate department filter
    setTimeout(() => {
        const departmentFilter = document.getElementById('departmentFilter');
        if (departmentFilter) {
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept;
                option.textContent = dept;
                departmentFilter.appendChild(option);
            });
        }
    }, 100);
}

// Function to view detailed employee performance report
function viewEmployeeDetailedReport(employeeId) {
    fetch(`/api/performance/reports/employee/${employeeId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showEmployeeDetailModal(data.data);
            } else {
                alert('Error loading employee details: ' + (data.message || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error loading employee details:', error);
            alert('Error loading employee details: ' + error.message);
        });
}

// Function to show detailed employee performance modal
function showEmployeeDetailModal(data) {
    const { employee, tasks, reviews, goals, metrics } = data;
    
    const html = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; display: flex; align-items: center; justify-content: center; overflow-y: auto;" onclick="closeDetailModal(event)">
            <div style="background: white; border-radius: 12px; padding: 30px; width: 95%; max-width: 1000px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.2); margin: 20px;" onclick="event.stopPropagation()">
                <h3 style="margin: 0 0 20px 0; color: #1e293b;">📊 Detailed Performance Report: ${employee.name}</h3>
                
                <!-- Employee Basic Info -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                        <div><strong>Employee ID:</strong> ${employee.employee_id}</div>
                        <div><strong>Department:</strong> ${employee.department || 'N/A'}</div>
                        <div><strong>Title:</strong> ${employee.title}</div>
                        <div><strong>Email:</strong> ${employee.email}</div>
                    </div>
                </div>
                
                <!-- Performance Summary -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 20px;">
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; text-align: center;">
                        <h4 style="color: #1d4ed8; margin: 0 0 8px 0;">Total Tasks</h4>
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b;">${metrics.total_tasks}</p>
                    </div>
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; text-align: center;">
                        <h4 style="color: #15803d; margin: 0 0 8px 0;">Completed</h4>
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b;">${metrics.completed_tasks}</p>
                    </div>
                    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; text-align: center;">
                        <h4 style="color: #b45309; margin: 0 0 8px 0;">Completion Rate</h4>
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b;">${metrics.completion_rate}%</p>
                    </div>
                    <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 16px; text-align: center;">
                        <h4 style="color: #8b5cf6; margin: 0 0 8px 0;">Latest Rating</h4>
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b;">${metrics.latest_rating || 'N/A'}</p>
                    </div>
                </div>
                
                <!-- Tabs for different sections -->
                <div style="border-bottom: 1px solid #e2e8f0; margin-bottom: 20px;">
                    <div style="display: flex; gap: 20px;">
                        <button onclick="showDetailTab('tasks')" id="tasksTab" class="detail-tab active" style="background: none; border: none; padding: 12px 0; border-bottom: 2px solid #3b82f6; color: #3b82f6; font-weight: 600; cursor: pointer;">Tasks</button>
                        <button onclick="showDetailTab('reviews')" id="reviewsTab" class="detail-tab" style="background: none; border: none; padding: 12px 0; border-bottom: 2px solid transparent; color: #64748b; font-weight: 600; cursor: pointer;">Reviews</button>
                        <button onclick="showDetailTab('goals')" id="goalsTab" class="detail-tab" style="background: none; border: none; padding: 12px 0; border-bottom: 2px solid transparent; color: #64748b; font-weight: 600; cursor: pointer;">Goals</button>
                    </div>
                </div>
                
                <!-- Tab Content -->
                <div id="detailTabContent">
                    ${generateTasksTabContent(tasks)}
                </div>
                
                <div style="display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end;">
                    <button onclick="closeDetailModal()" class="btn btn-secondary">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Store data for tab switching
    window.employeeDetailData = { tasks, reviews, goals };
}

// Function to generate tasks tab content
function generateTasksTabContent(tasks) {
    if (!tasks || tasks.length === 0) {
        return '<p style="color: #64748b; text-align: center; padding: 20px;">No tasks found for this employee.</p>';
    }
    
    let html = '<div style="max-height: 400px; overflow-y: auto;">';
    
    tasks.forEach(task => {
        const statusColor = {
            'Completed': '#22c55e',
            'In Progress': '#f59e0b',
            'Pending': '#ef4444',
            'To Do': '#6b7280'
        }[task.status] || '#6b7280';
        
        const priorityColor = {
            'High': '#ef4444',
            'Medium': '#f59e0b',
            'Low': '#22c55e'
        }[task.priority] || '#6b7280';
        
        html += `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <h5 style="margin: 0; color: #1e293b; font-weight: 600;">${task.title}</h5>
                    <div style="display: flex; gap: 8px;">
                        <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">${task.status}</span>
                        <span style="background: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">${task.priority}</span>
                    </div>
                </div>
                <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">${task.description || 'No description'}</p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; font-size: 12px; color: #9ca3af;">
                    <span>Category: ${task.category}</span>
                    <span>Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</span>
                    <span>Created: ${new Date(task.created_at).toLocaleDateString()}</span>
                    ${task.custom_weightage ? `<span>Weight: ${task.custom_weightage}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Function to show different tabs in detail modal
function showDetailTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.detail-tab').forEach(tab => {
        tab.style.borderBottomColor = 'transparent';
        tab.style.color = '#64748b';
    });
    
    const activeTab = document.getElementById(tabName + 'Tab');
    if (activeTab) {
        activeTab.style.borderBottomColor = '#3b82f6';
        activeTab.style.color = '#3b82f6';
    }
    
    // Update content
    const contentDiv = document.getElementById('detailTabContent');
    if (!contentDiv || !window.employeeDetailData) return;
    
    const { tasks, reviews, goals } = window.employeeDetailData;
    
    switch (tabName) {
        case 'tasks':
            contentDiv.innerHTML = generateTasksTabContent(tasks);
            break;
        case 'reviews':
            contentDiv.innerHTML = generateReviewsTabContent(reviews);
            break;
        case 'goals':
            contentDiv.innerHTML = generateGoalsTabContent(goals);
            break;
    }
}

// Function to generate reviews tab content
function generateReviewsTabContent(reviews) {
    if (!reviews || reviews.length === 0) {
        return '<p style="color: #64748b; text-align: center; padding: 20px;">No performance reviews found for this employee.</p>';
    }
    
    let html = '<div style="max-height: 400px; overflow-y: auto;">';
    
    reviews.forEach(review => {
        const ratingColor = review.overall_rating >= 4 ? '#22c55e' : review.overall_rating >= 3 ? '#f59e0b' : '#ef4444';
        
        html += `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div>
                        <h5 style="margin: 0 0 4px 0; color: #1e293b; font-weight: 600;">${review.review_period}</h5>
                        <p style="margin: 0; color: #64748b; font-size: 14px;">Reviewed by: ${review.reviewer_name || 'N/A'}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="background: ${ratingColor}; color: white; padding: 4px 12px; border-radius: 16px; font-weight: 600; margin-bottom: 4px;">
                            ${review.overall_rating}/5.0
                        </div>
                        <span style="font-size: 12px; color: #64748b;">${review.status}</span>
                    </div>
                </div>
                
                ${review.strengths ? `
                    <div style="margin-bottom: 8px;">
                        <strong style="color: #15803d;">Strengths:</strong>
                        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">${review.strengths}</p>
                    </div>
                ` : ''}
                
                ${review.areas_for_improvement ? `
                    <div style="margin-bottom: 8px;">
                        <strong style="color: #dc2626;">Areas for Improvement:</strong>
                        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">${review.areas_for_improvement}</p>
                    </div>
                ` : ''}
                
                <div style="font-size: 12px; color: #9ca3af; text-align: right;">
                    Completed: ${review.completed_at ? new Date(review.completed_at).toLocaleDateString() : 'N/A'}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Function to generate goals tab content
function generateGoalsTabContent(goals) {
    if (!goals || goals.length === 0) {
        return '<p style="color: #64748b; text-align: center; padding: 20px;">No goals found for this employee.</p>';
    }
    
    let html = '<div style="max-height: 400px; overflow-y: auto;">';
    
    goals.forEach(goal => {
        const statusColor = {
            'COMPLETED': '#22c55e',
            'IN_PROGRESS': '#f59e0b',
            'NOT_STARTED': '#6b7280'
        }[goal.status] || '#6b7280';
        
        html += `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <h5 style="margin: 0; color: #1e293b; font-weight: 600;">${goal.goal_title}</h5>
                    <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">${goal.status}</span>
                </div>
                <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">${goal.description}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #9ca3af;">
                    <span>Target: ${goal.target_date ? new Date(goal.target_date).toLocaleDateString() : 'No target date'}</span>
                    <span>Progress: ${goal.progress || 0}%</span>
                </div>
                ${goal.progress ? `
                    <div style="margin-top: 8px;">
                        <div style="background: #e2e8f0; border-radius: 4px; height: 6px;">
                            <div style="background: ${statusColor}; height: 100%; border-radius: 4px; width: ${goal.progress}%;"></div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Function to close detail modal
function closeDetailModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.querySelector('[style*="position: fixed"]');
    if (modal) {
        modal.remove();
        delete window.employeeDetailData;
    }
}

// Function to filter performance reports
function filterPerformanceReports() {
    const departmentFilter = document.getElementById('departmentFilter');
    const selectedDepartment = departmentFilter ? departmentFilter.value : '';
    
    const cards = document.querySelectorAll('.performance-report-card');
    cards.forEach(card => {
        const cardDepartment = card.getAttribute('data-department');
        if (!selectedDepartment || cardDepartment === selectedDepartment) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Function to sort performance reports
function sortPerformanceReports() {
    const sortBy = document.getElementById('sortBy');
    const sortValue = sortBy ? sortBy.value : 'name';
    
    const container = document.getElementById('performanceReportsContainer');
    if (!container) return;
    
    const cards = Array.from(container.querySelectorAll('.performance-report-card'));
    
    cards.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortValue) {
            case 'name':
                aValue = a.querySelector('h4').textContent.toLowerCase();
                bValue = b.querySelector('h4').textContent.toLowerCase();
                return aValue.localeCompare(bValue);
            case 'completion_rate':
                aValue = parseFloat(a.querySelector('[style*="color: #ef4444"], [style*="color: #f59e0b"], [style*="color: #22c55e"]').textContent);
                bValue = parseFloat(b.querySelector('[style*="color: #ef4444"], [style*="color: #f59e0b"], [style*="color: #22c55e"]').textContent);
                return bValue - aValue; // Descending order
            case 'total_tasks':
                aValue = parseInt(a.querySelector('p[style*="font-size: 20px"]').textContent);
                bValue = parseInt(b.querySelector('p[style*="font-size: 20px"]').textContent);
                return bValue - aValue; // Descending order
            case 'latest_rating':
                aValue = a.querySelector('[style*="color: #8b5cf6"]').textContent;
                bValue = b.querySelector('[style*="color: #8b5cf6"]').textContent;
                if (aValue === 'N/A') aValue = 0;
                if (bValue === 'N/A') bValue = 0;
                return parseFloat(bValue) - parseFloat(aValue); // Descending order
            default:
                return 0;
        }
    });
    
    // Re-append sorted cards
    cards.forEach(card => container.appendChild(card));
}

// Helper function to display results (should be available globally)
function displayResults(containerId, html) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = html;
    }
}