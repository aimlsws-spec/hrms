
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
// Add this to enterprise_portal.html after the createTask function

// Store this globally for task attachments
window.taskAttachmentFiles = [];

// Modified createTask function with file attachment
function createTaskWithAttachment() {
    const html = `
        <h3 style="margin-bottom: 20px; color: #1e293b;">Create New Task</h3>
        <form id="createTaskForm" style="display: grid; gap: 16px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Task Title *</label>
                    <input type="text" id="taskTitle" required style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Priority</label>
                    <select id="taskPriority" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;" onchange="updateWeightageField()">
                        <option value="Low">Low</option>
                        <option value="Medium" selected>Medium</option>
                        <option value="High">High</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Custom Weightage (Optional)</label>
                    <input type="number" id="taskWeightage" step="0.1" min="0.1" max="5.0" placeholder="Auto" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
                    <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Leave empty for default: High=1.5x, Medium=1.0x, Low=0.5x</p>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Target Start Date *</label>
                    <input type="date" id="taskAssignedStartDate" required style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Target End Date *</label>
                    <input type="date" id="taskAssignedEndDate" required style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Assign To *</label>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" id="assignToDeptBtn" onclick="selectAssignmentType('department')" style="flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: #f8fafc; cursor: pointer;">Department</button>
                        <button type="button" id="assignToEmpBtn" onclick="selectAssignmentType('employee')" style="flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: #f8fafc; cursor: pointer;">Employee</button>
                    </div>
                </div>
            </div>
            <div id="assignmentDropdown" style="display: none;">
                <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;" id="assignmentLabel">Select Assignment</label>
                <select id="assignmentSelect" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
                    <option value="">Please select assignment type first</option>
                </select>
            </div>
            <div>
                <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Description</label>
                <textarea id="taskDescription" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; height: 80px;" placeholder="Enter task description"></textarea>
            </div>
            
            <!-- FILE ATTACHMENT SECTION -->
            <div style="border: 2px dashed #d1d5db; border-radius: 8px; padding: 20px; background: #f9fafb;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">📎 Attach Files (Optional)</label>
                <input type="file" id="taskAttachmentInput" multiple style="display: none;">
                <div id="taskAttachmentZone" onclick="document.getElementById('taskAttachmentInput').click()" style="padding: 20px; text-align: center; cursor: pointer; border-radius: 6px; background: white;">
                    <p style="margin: 0; color: #64748b;">Click to select files or drag & drop here</p>
                </div>
                <div id="taskAttachmentList" style="margin-top: 12px;"></div>
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 16px;">
                <button type="submit" class="btn btn-primary">Create Task</button>
                <button type="button" class="btn btn-secondary" onclick="displayResults('taskResults', '<p style=\\"color: #64748b;\\">Select an action above to manage tasks.</p>')">Cancel</button>
            </div>
        </form>
    `;
    
    displayResults('taskResults', html);
    
    setTimeout(() => {
        // Setup file attachment
        const attachmentInput = document.getElementById('taskAttachmentInput');
        const attachmentZone = document.getElementById('taskAttachmentZone');
        const attachmentList = document.getElementById('taskAttachmentList');
        
        window.taskAttachmentFiles = [];
        
        attachmentInput.onchange = (e) => {
            Array.from(e.target.files).forEach(file => {
                window.taskAttachmentFiles.push(file);
                updateAttachmentList();
            });
        };
        
        // Drag and drop
        attachmentZone.ondragover = (e) => {
            e.preventDefault();
            attachmentZone.style.background = '#eff6ff';
            attachmentZone.style.borderColor = '#3b82f6';
        };
        
        attachmentZone.ondragleave = () => {
            attachmentZone.style.background = 'white';
        };
        
        attachmentZone.ondrop = (e) => {
            e.preventDefault();
            attachmentZone.style.background = 'white';
            Array.from(e.dataTransfer.files).forEach(file => {
                window.taskAttachmentFiles.push(file);
            });
            updateAttachmentList();
        };
        
        function updateAttachmentList() {
            if (window.taskAttachmentFiles.length === 0) {
                attachmentList.innerHTML = '';
                return;
            }
            
            attachmentList.innerHTML = window.taskAttachmentFiles.map((file, index) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; margin-top: 8px;">
                    <span style="color: #374151;">📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>
                    <button type="button" onclick="removeAttachment(${index})" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove</button>
                </div>
            `).join('');
        }
        
        window.removeAttachment = (index) => {
            window.taskAttachmentFiles.splice(index, 1);
            updateAttachmentList();
        };
        
        document.getElementById('createTaskForm').addEventListener('submit', function(e) {
            e.preventDefault();
            submitTask();
        });
    }, 100);
}

// Override the original createTask
window.createTask = createTaskWithAttachment;
