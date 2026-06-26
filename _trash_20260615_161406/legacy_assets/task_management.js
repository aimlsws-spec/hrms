// Task Management Functions - Fix for task counting and deletion

// Initialize task manager
function initializeTaskManager() {
    console.log('Initializing task manager...');
    loadTaskStats();
}

// Load task statistics
function loadTaskStats() {
    if (!currentUser) {
        console.log('No current user, skipping task stats');
        return;
    }
    
    console.log('Loading task stats for user:', currentUser.user_id);
    
    // Load all tasks to get counts
    fetch('/api/tasks/all')
        .then(response => {
            console.log('Task stats response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Task stats data:', data);
            if (data.success && data.tasks) {
                updateTaskStats(data.tasks);
            } else {
                console.error('Failed to load tasks:', data.message);
                // Set to 0 if no tasks
                updateTaskStats([]);
            }
        })
        .catch(error => {
            console.error('Error loading task stats:', error);
            // Set to 0 on error
            updateTaskStats([]);
        });
}

// Update task statistics in UI
function updateTaskStats(tasks) {
    console.log('Updating task stats with', tasks.length, 'tasks');
    
    const totalTasks = tasks.length;
    // Match tasks by both user ID and full name
    const myTasks = tasks.filter(task => 
        task.assigned_to === currentUser.user_id || 
        task.assigned_to === currentUser.full_name
    ).length;
    const inProgressTasks = tasks.filter(task => task.status === 'In Progress').length;
    const completedTasks = tasks.filter(task => task.status === 'Completed').length;
    
    console.log('Task counts - Total:', totalTasks, 'My:', myTasks, 'InProgress:', inProgressTasks, 'Completed:', completedTasks);
    
    // Update UI elements
    const totalTasksEl = document.getElementById('totalTasks');
    const myTasksEl = document.getElementById('myTasks');
    const inProgressTasksEl = document.getElementById('inProgressTasks');
    const completedTasksEl = document.getElementById('completedTasks');
    
    if (totalTasksEl) {
        totalTasksEl.textContent = totalTasks;
        console.log('Updated totalTasks element to:', totalTasks);
    } else {
        console.error('totalTasks element not found');
    }
    
    if (myTasksEl) {
        myTasksEl.textContent = myTasks;
        console.log('Updated myTasks element to:', myTasks);
    } else {
        console.error('myTasks element not found');
    }
    
    if (inProgressTasksEl) {
        inProgressTasksEl.textContent = inProgressTasks;
        console.log('Updated inProgressTasks element to:', inProgressTasks);
    } else {
        console.error('inProgressTasks element not found');
    }
    
    if (completedTasksEl) {
        completedTasksEl.textContent = completedTasks;
        console.log('Updated completedTasks element to:', completedTasks);
    } else {
        console.error('completedTasks element not found');
    }
}

// View my tasks
function viewMyTasks() {
    if (!currentUser) return;
    
    // Try both user_id and full_name for task assignment matching
    fetch('/api/tasks/all')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Filter tasks assigned to current user (by ID or name)
                const myTasks = data.tasks.filter(task => 
                    task.assigned_to === currentUser.user_id || 
                    task.assigned_to === currentUser.full_name
                );
                displayMyTasks(myTasks);
            } else {
                displayResults('taskResults', '<p style="color: #ef4444;">Error loading tasks: ' + data.message + '</p>');
            }
        })
        .catch(error => {
            console.error('Error loading my tasks:', error);
            displayResults('taskResults', '<p style="color: #ef4444;">Error loading tasks</p>');
        });
}

// Display my tasks
function displayMyTasks(tasks) {
    let html = `
        <h3 style="margin-bottom: 20px; color: #1e293b;">My Tasks</h3>
    `;
    
    if (!tasks || tasks.length === 0) {
        html += `
            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; text-align: center;">
                <h4 style="color: #b45309; margin: 0 0 8px 0;">No Tasks Found</h4>
                <p style="margin: 0; color: #92400e;">You don't have any tasks assigned yet.</p>
            </div>
        `;
    } else {
        html += '<div style="display: grid; gap: 12px;">';
        
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
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
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
        
        html += '</div>';
    }
    
    displayResults('taskResults', html);
}

// View all tasks (Admin/HR only)
function viewAllTasks() {
    if (currentUser.role !== 'admin' && currentUser.role !== 'hr') {
        alert('Access denied. Only Admin and HR can view all tasks.');
        return;
    }
    
    fetch('/api/tasks/all')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayAllTasks(data.tasks);
            } else {
                displayResults('taskResults', '<p style="color: #ef4444;">Error loading tasks: ' + data.message + '</p>');
            }
        })
        .catch(error => {
            console.error('Error loading all tasks:', error);
            displayResults('taskResults', '<p style="color: #ef4444;">Error loading tasks</p>');
        });
}

// Display all tasks
function displayAllTasks(tasks) {
    let html = `
        <h3 style="margin-bottom: 20px; color: #1e293b;">All Tasks</h3>
    `;
    
    if (!tasks || tasks.length === 0) {
        html += `
            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; text-align: center;">
                <h4 style="color: #b45309; margin: 0 0 8px 0;">No Tasks Found</h4>
                <p style="margin: 0; color: #92400e;">No tasks have been created yet.</p>
            </div>
        `;
    } else {
        html += '<div style="display: grid; gap: 12px;">';
        
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
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <h5 style="margin: 0; color: #1e293b; font-weight: 600;">${task.title}</h5>
                        <div style="display: flex; gap: 8px;">
                            <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">${task.status}</span>
                            <span style="background: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">${task.priority}</span>
                            ${currentUser.role === 'admin' ? `<button onclick="deleteTask('${task.task_id}')" style="background: #ef4444; color: white; border: none; padding: 2px 8px; border-radius: 12px; font-size: 12px; cursor: pointer;">Delete</button>` : ''}
                        </div>
                    </div>
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">${task.description || 'No description'}</p>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; font-size: 12px; color: #9ca3af;">
                        <span>Assigned to: ${task.assigned_to}</span>
                        <span>Category: ${task.category}</span>
                        <span>Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</span>
                        <span>Created: ${new Date(task.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    displayResults('taskResults', html);
}

// Delete task function
function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }
    
    fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Task deleted successfully');
            viewAllTasks(); // Refresh the task list
            loadTaskStats(); // Update stats
        } else {
            alert('Error deleting task: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error deleting task:', error);
        alert('Error deleting task');
    });
}

// Helper function to display results
function displayResults(containerId, html) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = html;
    }
}