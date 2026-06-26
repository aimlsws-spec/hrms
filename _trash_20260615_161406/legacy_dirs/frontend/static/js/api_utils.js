
// Resolve the backend base URL once at load time.
// Local dev  → http://127.0.0.1:8003
// Production → https://hrmsapi.seawindsolution.com
const _BACKEND = (['localhost', '127.0.0.1'].includes(window.location.hostname))
    ? 'http://127.0.0.1:8004'
    : 'https://hrmsapi.seawindsolution.com';

// Safe Global Fetch Interceptor — rewrites bare /api/... paths to the resolved backend.
(function () {
    if (window.__fetchInterceptorAttached) return;
    const originalFetch = window.fetch;
    window.fetch = function (resource, config) {
        if (typeof resource === 'string' && resource.startsWith('/api/')) {
            resource = _BACKEND + resource;
        }
        return originalFetch(resource, config);
    };
    window.__fetchInterceptorAttached = true;
})();

// Optimized API Utilities
const API = {
    baseUrl: _BACKEND + '/api',

    async request(endpoint, options = {}) {
        const config = {
            headers: { 'Content-Type': 'application/json' },
            ...options
        };

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, config);
            return await response.json();
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint);
    },

    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

// UI Utilities
const UI = {
    showLoading(show, elementId = 'loadingMessage') {
        const el = document.getElementById(elementId);
        if (el) el.style.display = show ? 'block' : 'none';
    },

    showMessage(type, message, elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = message;
            el.style.display = 'block';
            setTimeout(() => el.style.display = 'none', 5000);
        }
    },

    showError(message, elementId = 'errorMessage') {
        this.showMessage('error', message, elementId);
    },

    showSuccess(message, elementId = 'successMessage') {
        this.showMessage('success', message, elementId);
    },

    hideMessages() {
        ['errorMessage', 'successMessage', 'loadingMessage'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    },

    formatDate(date) {
        return new Date(date).toLocaleDateString();
    },

    formatTime(seconds) {
        if (!seconds && seconds !== 0) return '--:--';
        if (typeof seconds === 'string' && seconds.includes(':')) {
            const [h, m] = seconds.split(':');
            return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
        }
        const totalSeconds = parseInt(seconds);
        if (!isNaN(totalSeconds)) {
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        return '--:--';
    }
};

// Export
window.API = API;
window.UI = UI;
