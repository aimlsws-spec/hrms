
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
// Confetti Animation System
class ConfettiCelebration {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.confetti = [];
        this.animationId = null;
    }

    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '99999';
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
    }

    createConfetti(count = 150) {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe', '#fd79a8', '#fdcb6e'];
        for (let i = 0; i < count; i++) {
            this.confetti.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height - this.canvas.height,
                r: Math.random() * 6 + 4,
                d: Math.random() * count,
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.floor(Math.random() * 10) - 10,
                tiltAngleIncremental: Math.random() * 0.07 + 0.05,
                tiltAngle: 0
            });
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.confetti.forEach((c, i) => {
            this.ctx.beginPath();
            this.ctx.lineWidth = c.r / 2;
            this.ctx.strokeStyle = c.color;
            this.ctx.moveTo(c.x + c.tilt + c.r, c.y);
            this.ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r);
            this.ctx.stroke();

            c.tiltAngle += c.tiltAngleIncremental;
            c.y += (Math.cos(c.d) + 3 + c.r / 2) / 2;
            c.tilt = Math.sin(c.tiltAngle - i / 3) * 15;

            if (c.y > this.canvas.height) {
                this.confetti.splice(i, 1);
            }
        });

        if (this.confetti.length > 0) {
            this.animationId = requestAnimationFrame(() => this.draw());
        } else {
            this.cleanup();
        }
    }

    cleanup() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }

    celebrate() {
        this.createCanvas();
        this.createConfetti();
        this.draw();
    }
}

// Global function to trigger confetti
window.showConfetti = function(duration = 3000) {
    const celebration = new ConfettiCelebration();
    celebration.celebrate();
    setTimeout(() => celebration.cleanup(), duration);
};

// Auto-trigger confetti on success events
document.addEventListener('DOMContentLoaded', function() {
    // Task completion
    const originalSubmitTask = window.submitTask;
    if (originalSubmitTask) {
        window.submitTask = function() {
            originalSubmitTask.apply(this, arguments);
            setTimeout(() => window.showConfetti(), 500);
        };
    }

    // Leave approval
    const originalApproveLeave = window.approveLeave;
    if (originalApproveLeave) {
        window.approveLeave = function() {
            const result = originalApproveLeave.apply(this, arguments);
            if (result !== false) {
                setTimeout(() => window.showConfetti(), 500);
            }
            return result;
        };
    }

    // Document generation success
    document.addEventListener('documentGenerated', function() {
        window.showConfetti();
    });
});
