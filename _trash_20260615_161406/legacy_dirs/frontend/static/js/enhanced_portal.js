
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
// 🎨 ENHANCED PORTAL UI JAVASCRIPT
// Modern charts, animations, and interactions

// Toast Notification System
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type} fade-in`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <div style="font-size: 20px;">${icons[type]}</div>
        <div>${message}</div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toast-slide-in 0.3s reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Replace all alert() calls with toast notifications
window.alert = function(message) {
    showToast(message, 'info');
};

// Enhanced Number Counter Animation
function animateValue(element, start, end, duration) {
    // Skip if element doesn't exist or value is 'Loading...'
    if (!element || element.textContent === 'Loading...' || element.textContent === 'Error') return;
    
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 16);
}

// Initialize stat counters with animation - ONLY if value is already loaded
function initializeStatCounters() {
    document.querySelectorAll('.stat-value').forEach(el => {
        const currentText = el.textContent.trim();
        // Skip if still loading or has error
        if (currentText === 'Loading...' || currentText === 'Error' || currentText === '') return;
        
        const value = parseInt(currentText) || 0;
        // Only animate if value is greater than 0
        if (value > 0) {
            el.textContent = '0';
            setTimeout(() => animateValue(el, 0, value, 1000), 100);
        }
    });
}

// Create Progress Bar
function createProgressBar(percentage, color = '#3b82f6') {
    return `
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%; background: linear-gradient(90deg, ${color}, ${adjustColor(color, 20)})"></div>
        </div>
    `;
}

// Adjust color brightness
function adjustColor(color, amount) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

// Create Donut Chart using Chart.js
function createDonutChart(canvasId, data, labels, colors) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: { size: 12 },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 }
                }
            },
            cutout: '70%',
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// Create Line Chart for Trends
function createLineChart(canvasId, labels, data, label, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                borderColor: color,
                backgroundColor: `${color}20`,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: color,
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f1f5f9',
                        drawBorder: false
                    },
                    ticks: { font: { size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                }
            },
            animation: {
                duration: 1500,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// Create Bar Chart
function createBarChart(canvasId, labels, data, label, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                backgroundColor: color,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f1f5f9',
                        drawBorder: false
                    }
                },
                x: {
                    grid: { display: false }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// Enhanced Dashboard with Charts
function enhanceDashboard() {
    // Add charts to stat cards
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach((card, index) => {
        const value = card.querySelector('.stat-value');
        if (value) {
            const numValue = parseInt(value.textContent) || 0;
            const maxValue = numValue * 1.2;
            const percentage = (numValue / maxValue) * 100;
            
            // Add mini progress bar
            const progressBar = createProgressBar(percentage);
            if (!card.querySelector('.progress-bar')) {
                card.insertAdjacentHTML('beforeend', progressBar);
            }
        }
    });
    
    // Initialize counters
    initializeStatCounters();
}

// Skeleton Loading
function showSkeleton(container) {
    container.innerHTML = `
        <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 10px;"></div>
        <div class="skeleton" style="height: 40px; width: 40%; margin-bottom: 10px;"></div>
        <div class="skeleton" style="height: 15px; width: 80%;"></div>
    `;
}

// Enhanced Search with Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add search highlighting
function highlightSearchResults(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark style="background: #fef3c7; padding: 2px 4px; border-radius: 3px;">$1</mark>');
}

// Smooth Scroll to Element
function smoothScrollTo(element) {
    element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// Add Ripple Effect to Buttons
function addRippleEffect(e) {
    const button = e.currentTarget;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.5);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
    `;
    
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

// Add ripple animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize ripple effect on all buttons
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn, .action-card').forEach(btn => {
        btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        btn.addEventListener('click', addRippleEffect);
    });
});

// Enhanced Table Sorting
function makeTableSortable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';
        header.addEventListener('click', () => sortTable(table, index));
    });
}

function sortTable(table, column) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const isAscending = table.dataset.sortOrder !== 'asc';
    
    rows.sort((a, b) => {
        const aValue = a.cells[column].textContent.trim();
        const bValue = b.cells[column].textContent.trim();
        
        if (!isNaN(aValue) && !isNaN(bValue)) {
            return isAscending ? aValue - bValue : bValue - aValue;
        }
        
        return isAscending ? 
            aValue.localeCompare(bValue) : 
            bValue.localeCompare(aValue);
    });
    
    rows.forEach(row => tbody.appendChild(row));
    table.dataset.sortOrder = isAscending ? 'asc' : 'desc';
}

// Export Table to CSV
function exportTableToCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('td, th');
        const csvRow = Array.from(cols).map(col => 
            `"${col.textContent.trim().replace(/"/g, '""')}"`
        ).join(',');
        csv.push(csvRow);
    });
    
    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    
    showToast('Table exported successfully!', 'success');
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="search"], input[type="text"]');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        const modal = document.querySelector('[style*="position: fixed"]');
        if (modal) modal.remove();
    }
});

// Auto-save Form Data
function enableAutoSave(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        input.addEventListener('input', debounce(() => {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            localStorage.setItem(`autosave_${formId}`, JSON.stringify(data));
            
            // Show save indicator
            const indicator = document.createElement('span');
            indicator.textContent = '✓ Saved';
            indicator.style.cssText = 'color: #10b981; font-size: 12px; margin-left: 8px;';
            input.parentElement.appendChild(indicator);
            setTimeout(() => indicator.remove(), 2000);
        }, 1000));
    });
}

// Restore Auto-saved Data
function restoreAutoSave(formId) {
    const saved = localStorage.getItem(`autosave_${formId}`);
    if (!saved) return;
    
    const data = JSON.parse(saved);
    const form = document.getElementById(formId);
    if (!form) return;
    
    Object.keys(data).forEach(key => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) input.value = data[key];
    });
    
    showToast('Draft restored', 'info');
}

// Initialize Enhanced Features - ONLY on enterprise portal
window.addEventListener('load', () => {
    // Check if we're on the enterprise portal page (not accountant or other dashboards)
    const isEnterprisePortal = document.querySelector('.portal-container') !== null;
    if (!isEnterprisePortal) {
        console.log('Enhanced UI: Skipping - not on enterprise portal');
        return;
    }
    
    console.log('Enhanced UI: Initializing for enterprise portal');
    
    // Enhance dashboard AFTER data loads - wait longer
    setTimeout(enhanceDashboard, 2000);
    
    // Make tables sortable
    document.querySelectorAll('table').forEach(table => {
        if (table.id) makeTableSortable(table.id);
    });
    
    // Add fade-in animation to cards
    document.querySelectorAll('.card, .stat-card').forEach((card, index) => {
        card.style.opacity = '0';
        setTimeout(() => {
            card.classList.add('fade-in');
            card.style.opacity = '1';
        }, index * 50);
    });
});

// Export functions for global use
window.showToast = showToast;
window.createDonutChart = createDonutChart;
window.createLineChart = createLineChart;
window.createBarChart = createBarChart;
window.exportTableToCSV = exportTableToCSV;
window.enhanceDashboard = enhanceDashboard;
