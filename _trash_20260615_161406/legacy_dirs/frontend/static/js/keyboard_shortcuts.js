
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
// Keyboard Shortcuts System
class KeyboardShortcuts {
    constructor() {
        this.shortcuts = {
            // Navigation
            'g d': { action: () => this.navigate('dashboard'), description: 'Go to Dashboard' },
            'g e': { action: () => this.navigate('employees'), description: 'Go to Employees' },
            'g l': { action: () => this.navigate('leaves'), description: 'Go to Leave Management' },
            'g t': { action: () => this.navigate('tasks'), description: 'Go to Tasks' },
            'g a': { action: () => this.navigate('analytics'), description: 'Go to Analytics' },
            'g r': { action: () => this.navigate('reports'), description: 'Go to Reports' },
            'g s': { action: () => this.navigate('settings'), description: 'Go to Settings' },
            
            // Actions
            'n t': { action: () => this.createTask(), description: 'New Task' },
            'n l': { action: () => this.applyLeave(), description: 'Apply Leave' },
            'a i': { action: () => this.checkIn(), description: 'Attendance Check In' },
            
            // Search & UI
            '/': { action: () => this.focusSearch(), description: 'Focus Search' },
            '?': { action: () => this.showHelp(), description: 'Show Shortcuts Help' },
            'Escape': { action: () => this.closeModals(), description: 'Close Modals' },
            
            // Export
            'e x': { action: () => this.exportToExcel(), description: 'Export to Excel' },
            'e p': { action: () => this.exportToPDF(), description: 'Export to PDF' },
            
            // Quick Actions
            'Alt+n': { action: () => this.toggleNotifications(), description: 'Toggle Notifications' },
            'Alt+p': { action: () => this.showProfile(), description: 'Show Profile' },
            'Alt+m': { action: () => this.toggleMobileMenu(), description: 'Toggle Menu' }
        };
        
        this.keySequence = [];
        this.sequenceTimeout = null;
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        this.createHelpModal();
    }

    handleKeyPress(e) {
        // Ignore if typing in input/textarea
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
            if (e.key === 'Escape') {
                e.target.blur();
            }
            return;
        }

        // Handle single key shortcuts
        if (this.shortcuts[e.key]) {
            e.preventDefault();
            this.shortcuts[e.key].action();
            return;
        }

        // Handle Alt combinations
        if (e.altKey) {
            const combo = `Alt+${e.key}`;
            if (this.shortcuts[combo]) {
                e.preventDefault();
                this.shortcuts[combo].action();
                return;
            }
        }

        // Handle key sequences (like 'g d')
        clearTimeout(this.sequenceTimeout);
        this.keySequence.push(e.key.toLowerCase());
        
        const sequence = this.keySequence.join(' ');
        if (this.shortcuts[sequence]) {
            e.preventDefault();
            this.shortcuts[sequence].action();
            this.keySequence = [];
        } else {
            this.sequenceTimeout = setTimeout(() => {
                this.keySequence = [];
            }, 1000);
        }
    }

    navigate(section) {
        if (typeof showSection === 'function') {
            showSection(section);
            this.showToast(`Navigated to ${section}`);
        }
    }

    createTask() {
        // Navigate to tasks section and trigger create task
        if (typeof showSection === 'function') {
            showSection('tasks');
            setTimeout(() => {
                // Look for create task button and click it
                const createBtn = document.getElementById('create-task-card');
                if (createBtn && createBtn.style.display !== 'none') {
                    createBtn.click();
                    this.showToast('Create Task opened');
                } else {
                    // If button not visible, show the section anyway
                    this.showToast('Tasks section opened');
                }
            }, 300);
        }
    }

    applyLeave() {
        // Navigate to leaves section and trigger apply leave
        if (typeof showSection === 'function') {
            showSection('leaves');
            setTimeout(() => {
                // Look for apply leave button and click it
                const applyBtn = document.getElementById('apply-leave-card');
                if (applyBtn && applyBtn.style.display !== 'none') {
                    applyBtn.click();
                    this.showToast('Apply Leave opened');
                } else {
                    // Alternative: open leave application page
                    window.open('leave_application.html', '_blank');
                    this.showToast('Leave application opened');
                }
            }, 300);
        }
    }

    checkIn() {
        this.navigate('gps-attendance');
        this.showToast('GPS Attendance opened');
    }

    focusSearch() {
        const searchInput = document.getElementById('employeeSearch') || 
                          document.querySelector('input[type="text"]');
        if (searchInput) {
            searchInput.focus();
            this.showToast('Search focused');
        }
    }

    closeModals() {
        const modals = document.querySelectorAll('[style*="position: fixed"]');
        modals.forEach(modal => {
            if (modal.style.display !== 'none') {
                modal.remove();
            }
        });
        this.showToast('Modals closed');
    }

    exportToExcel() {
        if (typeof window.exportTableToExcel === 'function') {
            window.exportTableToExcel();
        } else {
            this.showToast('Export feature loading...');
        }
    }

    exportToPDF() {
        const exporter = new ExcelExporter();
        exporter.exportToPDF();
    }

    toggleNotifications() {
        if (typeof toggleNotifications === 'function') {
            toggleNotifications();
        }
    }

    showProfile() {
        if (typeof showUserProfile === 'function') {
            showUserProfile();
        }
    }

    toggleMobileMenu() {
        if (typeof toggleMobileMenu === 'function') {
            toggleMobileMenu();
        }
    }

    showHelp() {
        const modal = document.getElementById('shortcutsHelpModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    createHelpModal() {
        const modal = document.createElement('div');
        modal.id = 'shortcutsHelpModal';
        modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;align-items:center;justify-content:center;padding:20px;';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

        const content = document.createElement('div');
        content.style.cssText = 'background:white;border-radius:16px;padding:32px;max-width:600px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
                <h2 style="margin:0;color:#1e293b;">⌨️ Keyboard Shortcuts</h2>
                <button onclick="this.closest('div').parentElement.parentElement.style.display='none'" style="background:#f1f5f9;border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:20px;color:#64748b;">×</button>
            </div>
            <div style="display:grid;gap:16px;">
        `;

        const categories = {
            'Navigation': ['g d', 'g e', 'g l', 'g t', 'g a', 'g r', 'g s'],
            'Actions': ['n t', 'n l', 'a i'],
            'Search & UI': ['/', '?', 'Escape'],
            'Export': ['e x', 'e p'],
            'Quick Actions': ['Alt+n', 'Alt+p', 'Alt+m']
        };

        Object.entries(categories).forEach(([category, keys]) => {
            html += `<div style="margin-bottom:16px;">
                <h3 style="font-size:14px;color:#64748b;text-transform:uppercase;margin:0 0 8px 0;">${category}</h3>
                <div style="display:grid;gap:8px;">`;
            
            keys.forEach(key => {
                if (this.shortcuts[key]) {
                    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f8fafc;border-radius:6px;">
                        <span style="color:#1e293b;">${this.shortcuts[key].description}</span>
                        <kbd style="background:#1e3a8a;color:white;padding:4px 8px;border-radius:4px;font-size:12px;font-family:monospace;">${key}</kbd>
                    </div>`;
                }
            });
            
            html += `</div></div>`;
        });

        html += `</div>
            <div style="margin-top:24px;padding:16px;background:#eff6ff;border-radius:8px;font-size:13px;color:#1e40af;">
                <strong>💡 Tip:</strong> Press <kbd style="background:#1e3a8a;color:white;padding:2px 6px;border-radius:3px;">?</kbd> anytime to see this help
            </div>`;

        content.innerHTML = html;
        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1e3a8a;color:white;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:10001;animation:slideInUp 0.3s;';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutDown 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

// Initialize keyboard shortcuts
document.addEventListener('DOMContentLoaded', () => {
    window.keyboardShortcuts = new KeyboardShortcuts();
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInUp {
            from { transform: translateY(100px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideOutDown {
            from { transform: translateY(0); opacity: 1; }
            to { transform: translateY(100px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
});
