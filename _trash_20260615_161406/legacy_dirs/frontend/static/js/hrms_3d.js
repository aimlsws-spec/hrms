
// Safe Global Fetch Interceptor for Production
(function () {
    if (window.__fetchInterceptorAttached) return;
    const originalFetch = window.fetch;
    window.fetch = function (resource, config) {
        if (typeof resource === 'string' && resource.startsWith('/api/') && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
            resource = 'https://hrmsapi.seawindsolution.com' + resource;
        }
        return originalFetch(resource, config);
    };
    window.__fetchInterceptorAttached = true;
})();
class HRMS3D {
    constructor() {
        this.currentSection = 'chat';
        this.chatHistory = [];
        this.userId = 'user_' + Date.now();
        this.init();
    }

    init() {
        this.initElements();
        this.initEventListeners();
        this.initAnimations();
        this.loadChatHistory();
    }

    initElements() {
        // Navigation elements
        this.navBtns = document.querySelectorAll('.nav-btn');
        this.sections = document.querySelectorAll('.section');

        // Chat elements
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.chatHistory = document.getElementById('chatHistory');

        // Other elements
        this.fabBtn = document.getElementById('fabBtn');
        this.actionCards = document.querySelectorAll('.action-card');
    }

    initEventListeners() {
        // Navigation
        this.navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.dataset.section;
                this.switchSection(section);
            });
        });

        // Chat functionality
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.newChatBtn.addEventListener('click', () => this.startNewChat());

        // Quick action cards
        this.actionCards.forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.dataset.prompt;
                this.chatInput.value = prompt;
                this.sendMessage();
            });
        });

        // FAB button
        this.fabBtn.addEventListener('click', () => {
            this.switchSection('chat');
            this.chatInput.focus();
        });

        // Auto-resize textarea
        this.chatInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });

        // 3D mouse effects
        this.init3DEffects();
    }

    initAnimations() {
        // Stagger animation for cards
        const cards = document.querySelectorAll('.action-card, .doc-card-3d, .stat-card-3d');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
            card.classList.add('animate-in');
        });

        // Parallax effect for floating cubes
        this.initParallax();
    }

    init3DEffects() {
        // Add 3D tilt effect to cards
        const tiltElements = document.querySelectorAll('.action-card, .doc-card-3d, .stat-card-3d, .message-content');

        tiltElements.forEach(element => {
            element.addEventListener('mousemove', (e) => {
                const rect = element.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = (y - centerY) / 10;
                const rotateY = (centerX - x) / 10;

                element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
            });

            element.addEventListener('mouseleave', () => {
                element.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
            });
        });
    }

    initParallax() {
        const floatingCubes = document.querySelectorAll('.floating-cube');

        document.addEventListener('mousemove', (e) => {
            const mouseX = e.clientX / window.innerWidth;
            const mouseY = e.clientY / window.innerHeight;

            floatingCubes.forEach((cube, index) => {
                const speed = (index + 1) * 0.5;
                const x = (mouseX - 0.5) * speed * 50;
                const y = (mouseY - 0.5) * speed * 50;

                cube.style.transform = `translate(${x}px, ${y}px) rotateX(${x}deg) rotateY(${y}deg)`;
            });
        });
    }

    switchSection(sectionName) {
        // Update navigation
        this.navBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.section === sectionName) {
                btn.classList.add('active');
            }
        });

        // Update sections
        this.sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === sectionName) {
                section.classList.add('active');
            }
        });

        this.currentSection = sectionName;

        // Load section-specific data
        this.loadSectionData(sectionName);
    }

    loadSectionData(section) {
        switch (section) {
            case 'employees':
                this.loadEmployees();
                break;
            case 'documents':
                this.loadDocuments();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }

    async loadEmployees() {
        const grid = document.getElementById('employeeGrid');
        if (!grid) return;

        try {
            const response = await fetch('/api/employees/search?q=&limit=20');
            const data = await response.json();

            // Handle different possible data structures
            const employees = data.employees || data.results || [];

            // Update the section title with actual count
            const sectionTitle = document.querySelector('#employees h2');
            if (sectionTitle) {
                sectionTitle.textContent = `All Employees (${data.total || employees.length})`;
            }

            grid.innerHTML = '';
            employees.forEach(emp => {
                const card = this.createEmployeeCard(emp);
                grid.appendChild(card);
            });
        } catch (error) {
            console.error('Error loading employees:', error);
        }
    }

    createEmployeeCard(employee) {
        const card = document.createElement('div');
        card.className = 'employee-card-3d';

        // Fix for undefined name issue
        const name = employee.full_name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Unknown';

        card.innerHTML = `
            <div class="emp-avatar">${name.charAt(0)}</div>
            <h3>${name}</h3>
            <p class="emp-title">${employee.title || 'N/A'}</p>
            <p class="emp-dept">${employee.department || 'N/A'}</p>
            <p class="emp-location">${employee.city || 'N/A'}, ${employee.state || 'N/A'}</p>
        `;
        return card;
    }

    loadDocuments() {
        // Add document generation functionality
        const docCards = document.querySelectorAll('.doc-card-3d');
        docCards.forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.type;
                this.generateDocument(type);
            });
        });
    }

    generateDocument(type) {
        let prompt = '';
        switch (type) {
            case 'salary':
                prompt = 'Generate salary slip for John Doe';
                break;
            case 'offer':
                prompt = 'Generate offer letter for Jane Smith';
                break;
            case 'relieving':
                prompt = 'Generate relieving letter for Mike Johnson';
                break;
        }

        this.switchSection('chat');
        this.chatInput.value = prompt;
        this.sendMessage();
    }

    loadAnalytics() {
        // Animate statistics
        const statNumbers = document.querySelectorAll('.stat-number');
        statNumbers.forEach(stat => {
            this.animateNumber(stat);
        });
    }

    animateNumber(element) {
        const target = parseInt(element.textContent);
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }

            if (element.textContent.includes('%')) {
                element.textContent = Math.floor(current) + '%';
            } else {
                element.textContent = Math.floor(current);
            }
        }, 16);
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        this.chatInput.value = '';
        this.sendBtn.disabled = true;

        // Remove welcome screen
        const welcomeScreen = document.querySelector('.welcome-screen-3d');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }

        this.addMessage('user', message);
        this.showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: this.userId,
                    message: message
                })
            });

            const data = await response.json();
            this.removeTypingIndicator();

            this.addMessage('assistant', data.reply, {
                intent: data.intent,
                employees: data.trace?.employees,
                pdf_filename: data.trace?.pdf_filename
            });

            // Handle download links
            setTimeout(() => {
                this.setupDownloadLinks();
            }, 100);

            this.saveChatMessage(message, data.reply);

        } catch (error) {
            this.removeTypingIndicator();
            this.addMessage('assistant', 'Sorry, there was an error processing your request.');
        }

        this.sendBtn.disabled = false;
        this.chatInput.focus();
    }

    addMessage(role, content, meta = {}) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = role === 'user' ? 'U' : 'AI';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (meta.employees && meta.employees.length > 0) {
            contentDiv.innerHTML = this.formatEmployeeResponse(content, meta.employees);
        } else {
            contentDiv.innerHTML = this.formatContent(content);
        }

        if (meta.intent) {
            const metaDiv = document.createElement('div');
            metaDiv.className = 'message-meta';
            metaDiv.textContent = `Intent: ${meta.intent}`;
            metaDiv.style.fontSize = '0.8rem';
            metaDiv.style.opacity = '0.7';
            metaDiv.style.marginTop = '10px';
            contentDiv.appendChild(metaDiv);
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        // Add 3D effect to new message
        setTimeout(() => {
            this.add3DEffectToMessage(messageDiv);
        }, 100);
    }

    add3DEffectToMessage(messageDiv) {
        const content = messageDiv.querySelector('.message-content');
        content.addEventListener('mousemove', (e) => {
            const rect = content.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;

            content.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(5px)`;
        });

        content.addEventListener('mouseleave', () => {
            content.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
        });
    }

    formatContent(content) {
        // Convert markdown-style links to actual download links
        let formatted = content.replace(/\[📥 Download PDF [^\]]+\]\(([^)]+)\)/g,
            '<a href="$1" target="_blank" class="download-link-3d">📥 Download PDF</a>');

        formatted = formatted.replace(/\[Click here to download\]\(([^)]+)\)/g,
            '<a href="$1" target="_blank" class="download-link-3d">📄 Download PDF</a>');

        // Convert **text** to bold
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Convert line breaks
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    formatEmployeeResponse(content, employees) {
        let html = `<p>${content}</p>`;

        if (employees && employees.length > 0 && employees.length <= 5) {
            employees.forEach(emp => {
                // Fix for undefined name in chat response
                const name = emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown';

                html += `
                    <div class="employee-card-inline">
                        <div class="emp-avatar-inline">${name.charAt(0)}</div>
                        <div class="emp-details">
                            <h4>${name}</h4>
                            <p><strong>Title:</strong> ${emp.title || 'N/A'}</p>
                            <p><strong>Department:</strong> ${emp.department || 'N/A'}</p>
                            <p><strong>Email:</strong> ${emp.email || 'N/A'}</p>
                            ${emp.city ? `<p><strong>Location:</strong> ${emp.city}, ${emp.state}</p>` : ''}
                        </div>
                    </div>
                `;
            });
        }

        return html;
    }

    setupDownloadLinks() {
        document.querySelectorAll('.download-link-3d').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                window.open(link.href, '_blank');
            });
        });
    }

    showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message assistant typing';
        indicator.id = 'typingIndicator';
        indicator.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-content">
                <div class="typing-indicator-3d">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        this.chatMessages.appendChild(indicator);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    removeTypingIndicator() {
        document.getElementById('typingIndicator')?.remove();
    }

    autoResizeTextarea() {
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
    }

    startNewChat() {
        this.chatMessages.innerHTML = `
            <div class="welcome-screen-3d">
                <div class="welcome-cube">
                    <div class="cube-face front">🤖</div>
                    <div class="cube-face back">💼</div>
                    <div class="cube-face right">📊</div>
                    <div class="cube-face left">👥</div>
                    <div class="cube-face top">🎯</div>
                    <div class="cube-face bottom">⚡</div>
                </div>
                <h2>Welcome to HRMS AI</h2>
                <p>Your intelligent HR assistant in 3D</p>
                
                <div class="quick-actions-3d">
                    <div class="action-card" data-prompt="employees from gj">
                        <div class="card-icon">👥</div>
                        <h3>Find Employees</h3>
                        <p>Search by location, department, or name</p>
                    </div>
                    <div class="action-card" data-prompt="What is the parental leave policy?">
                        <div class="card-icon">📋</div>
                        <h3>HR Policies</h3>
                        <p>Get instant policy information</p>
                    </div>
                    <div class="action-card" data-prompt="generate offer letter for John Doe">
                        <div class="card-icon">📄</div>
                        <h3>Generate Documents</h3>
                        <p>Create salary slips, offer letters</p>
                    </div>
                    <div class="action-card" data-prompt="show my leave balance">
                        <div class="card-icon">🏖️</div>
                        <h3>Leave Management</h3>
                        <p>Check balance, apply for leave</p>
                    </div>
                </div>
            </div>
        `;

        // Re-attach event listeners to new action cards
        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.dataset.prompt;
                this.chatInput.value = prompt;
                this.sendMessage();
            });
        });
    }

    saveChatMessage(userMsg, assistantMsg) {
        // Save to localStorage for persistence
        const chat = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            messages: [
                { role: 'user', content: userMsg },
                { role: 'assistant', content: assistantMsg }
            ]
        };

        this.chatHistory.unshift(chat);
        localStorage.setItem('hrms_3d_chat_history', JSON.stringify(this.chatHistory));
        this.updateChatHistorySidebar();
    }

    loadChatHistory() {
        const saved = localStorage.getItem('hrms_3d_chat_history');
        if (saved) {
            this.chatHistory = JSON.parse(saved);
            this.updateChatHistorySidebar();
        }
    }

    updateChatHistorySidebar() {
        const historyContainer = document.getElementById('chatHistory');
        if (!historyContainer) return;

        historyContainer.innerHTML = '';

        this.chatHistory.slice(0, 10).forEach(chat => {
            const item = document.createElement('div');
            item.className = 'history-item-3d';
            const preview = chat.messages[0].content.substring(0, 30);
            item.textContent = preview + (preview.length < chat.messages[0].content.length ? '...' : '');
            item.addEventListener('click', () => this.loadChat(chat.id));
            historyContainer.appendChild(item);
        });
    }

    loadChat(chatId) {
        const chat = this.chatHistory.find(c => c.id === chatId);
        if (!chat) return;

        this.chatMessages.innerHTML = '';

        chat.messages.forEach(msg => {
            this.addMessage(msg.role, msg.content);
        });
    }
}

// Additional CSS for new elements
const additionalStyles = `
.employee-card-3d {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 15px;
    padding: 20px;
    text-align: center;
    transition: all 0.3s ease;
    color: white;
    margin-bottom: 20px;
}

.employee-card-3d:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateZ(15px) scale(1.05);
}

.emp-avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 15px;
    font-weight: bold;
    font-size: 1.2rem;
}

.employee-card-inline {
    display: flex;
    gap: 15px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 15px;
    margin: 10px 0;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.emp-avatar-inline {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    flex-shrink: 0;
}

.download-link-3d {
    display: inline-block;
    background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
    color: white;
    padding: 10px 20px;
    border-radius: 10px;
    text-decoration: none;
    margin: 10px 0;
    transition: all 0.3s ease;
}

.download-link-3d:hover {
    transform: translateZ(5px) scale(1.05);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

.typing-indicator-3d {
    display: flex;
    gap: 5px;
    padding: 10px;
}

.typing-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.7);
    animation: typingBounce 1.4s infinite ease-in-out;
}

.typing-dot:nth-child(1) { animation-delay: -0.32s; }
.typing-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes typingBounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
}

.history-item-3d {
    padding: 10px;
    margin: 5px 0;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.9rem;
    color: white;
}

.history-item-3d:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateX(5px);
}

.animate-in {
    animation: slideInUp 0.6s ease-out forwards;
    opacity: 0;
    transform: translateY(30px);
}

@keyframes slideInUp {
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new HRMS3D();
});
