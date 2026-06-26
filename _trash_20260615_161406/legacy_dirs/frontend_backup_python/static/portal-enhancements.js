
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
// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span style="font-size: 20px;">${icon}</span><span>${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// ==================== COUNT UP ANIMATION ====================
function animateCount(element, target, duration = 1000) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = Math.round(target);
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current);
        }
    }, 16);
}

// ==================== SCROLL ANIMATIONS ====================
function initScrollAnimations() {
    const elements = document.querySelectorAll('.fade-in-scroll');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });
    
    elements.forEach(el => observer.observe(el));
}

// ==================== LOADING SKELETON ====================
function showSkeleton(container, count = 3) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton skeleton-card';
        container.appendChild(skeleton);
    }
}

function hideSkeleton(container, content) {
    container.innerHTML = content;
}

// ==================== RIPPLE EFFECT ====================
function addRippleEffect(button) {
    button.classList.add('btn-ripple');
}

// ==================== MODAL HELPERS ====================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.querySelector('.modal-content')?.classList.add('scaleIn');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// ==================== PROGRESS BAR ====================
function updateProgress(elementId, percentage) {
    const progressFill = document.querySelector(`#${elementId} .progress-fill`);
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
}

// ==================== FORM VALIDATION ====================
function validateForm(formId) {
    const form = document.getElementById(formId);
    const inputs = form.querySelectorAll('input[required], select[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.style.borderColor = '#ff4757';
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 500);
            isValid = false;
        } else {
            input.style.borderColor = '#2ecc71';
        }
    });
    
    return isValid;
}

// ==================== AUTO-INIT ON PAGE LOAD ====================
document.addEventListener('DOMContentLoaded', function() {
    // Initialize scroll animations
    initScrollAnimations();
    
    // Add ripple to all buttons
    document.querySelectorAll('button').forEach(btn => addRippleEffect(btn));
    
    // Animate stat cards
    document.querySelectorAll('.stat-number').forEach(el => {
        const target = parseInt(el.textContent.replace(/,/g, ''));
        if (!isNaN(target)) {
            animateCount(el, target);
        }
    });
    
    // Add hover effects to cards
    document.querySelectorAll('.card').forEach(card => {
        card.style.cursor = 'pointer';
    });
});

// ==================== UTILITY FUNCTIONS ====================
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

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

// Export functions for global use
window.showToast = showToast;
window.animateCount = animateCount;
window.showSkeleton = showSkeleton;
window.hideSkeleton = hideSkeleton;
window.openModal = openModal;
window.closeModal = closeModal;
window.updateProgress = updateProgress;
window.validateForm = validateForm;
