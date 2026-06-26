
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
// Skeleton Loader Helper Functions
class SkeletonLoader {
    // Show skeleton for table
    static showTableSkeleton(container, rows = 5, columns = 4) {
        let html = '<div class="skeleton-table">';
        for (let i = 0; i < rows; i++) {
            html += '<div class="skeleton-table-row">';
            for (let j = 0; j < columns; j++) {
                html += '<div class="skeleton skeleton-text"></div>';
            }
            html += '</div>';
        }
        html += '</div>';
        
        if (typeof container === 'string') {
            document.getElementById(container).innerHTML = html;
        } else {
            container.innerHTML = html;
        }
    }

    // Show skeleton for cards
    static showCardSkeleton(container, count = 3) {
        let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;">';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="skeleton-card skeleton-shimmer">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text" style="width:80%;"></div>
                    <div class="skeleton skeleton-text" style="width:60%;"></div>
                    <div class="skeleton skeleton-button" style="margin-top:16px;"></div>
                </div>
            `;
        }
        html += '</div>';
        
        if (typeof container === 'string') {
            document.getElementById(container).innerHTML = html;
        } else {
            container.innerHTML = html;
        }
    }

    // Show skeleton for list
    static showListSkeleton(container, items = 5) {
        let html = '<div style="display:grid;gap:12px;">';
        for (let i = 0; i < items; i++) {
            html += `
                <div style="display:flex;align-items:center;gap:12px;padding:12px;background:white;border-radius:8px;">
                    <div class="skeleton skeleton-avatar"></div>
                    <div style="flex:1;">
                        <div class="skeleton skeleton-text" style="width:40%;margin-bottom:8px;"></div>
                        <div class="skeleton skeleton-text" style="width:60%;"></div>
                    </div>
                </div>
            `;
        }
        html += '</div>';
        
        if (typeof container === 'string') {
            document.getElementById(container).innerHTML = html;
        } else {
            container.innerHTML = html;
        }
    }

    // Show skeleton for chart
    static showChartSkeleton(container) {
        const html = '<div class="skeleton skeleton-chart skeleton-shimmer"></div>';
        
        if (typeof container === 'string') {
            document.getElementById(container).innerHTML = html;
        } else {
            container.innerHTML = html;
        }
    }

    // Show skeleton for stats
    static showStatsSkeleton(container, count = 4) {
        let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;">';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="skeleton-card skeleton-shimmer">
                    <div class="skeleton skeleton-text" style="width:50%;margin-bottom:16px;"></div>
                    <div class="skeleton skeleton-title" style="width:30%;margin-bottom:8px;"></div>
                    <div class="skeleton skeleton-text" style="width:40%;"></div>
                </div>
            `;
        }
        html += '</div>';
        
        if (typeof container === 'string') {
            document.getElementById(container).innerHTML = html;
        } else {
            container.innerHTML = html;
        }
    }
}

// Global helper functions
window.showSkeletonLoader = function(type, container, options = {}) {
    switch(type) {
        case 'table':
            SkeletonLoader.showTableSkeleton(container, options.rows, options.columns);
            break;
        case 'cards':
            SkeletonLoader.showCardSkeleton(container, options.count);
            break;
        case 'list':
            SkeletonLoader.showListSkeleton(container, options.items);
            break;
        case 'chart':
            SkeletonLoader.showChartSkeleton(container);
            break;
        case 'stats':
            SkeletonLoader.showStatsSkeleton(container, options.count);
            break;
    }
};

// Auto-replace loading text with skeletons
document.addEventListener('DOMContentLoaded', function() {
    // Replace "Loading..." text with appropriate skeletons
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    const loadingText = node.textContent?.trim().toLowerCase();
                    
                    if (loadingText === 'loading...' || loadingText === 'loading') {
                        const parent = node.parentElement;
                        
                        // Determine what type of skeleton to show based on context
                        if (parent?.querySelector('table') || parent?.id?.includes('Table')) {
                            SkeletonLoader.showTableSkeleton(parent);
                        } else if (parent?.classList?.contains('stats-grid')) {
                            SkeletonLoader.showStatsSkeleton(parent);
                        } else if (parent?.classList?.contains('card-content')) {
                            SkeletonLoader.showListSkeleton(parent);
                        }
                    }
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});
