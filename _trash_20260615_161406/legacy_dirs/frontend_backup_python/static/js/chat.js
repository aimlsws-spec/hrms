class HRMSChat {
    constructor() {
        this.chatHistory = [];
        this.currentChatId = null;
        this.userId = 'user_' + Date.now();
        this.init();
    }

    init() {
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.newChatBtn = document.getElementById('newChatBtn');
        
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
        
        document.querySelectorAll('.example-prompt').forEach(el => {
            el.addEventListener('click', () => {
                this.chatInput.value = el.dataset.prompt;
                this.sendMessage();
            });
        });
        
        this.loadChatHistory();
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        this.chatInput.value = '';
        this.sendBtn.disabled = true;
        
        document.querySelector('.welcome-screen')?.remove();
        
        this.addMessage('user', message);
        this.showTypingIndicator();

        try {
            const response = await fetch('/chat', {
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
            
            // Handle download links by adding click handlers
            setTimeout(() => {
                document.querySelectorAll('.download-link').forEach(link => {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        window.open(link.href, '_blank');
                    });
                });
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
            // Handle PDF download links
            const formattedContent = this.formatContent(content);
            contentDiv.innerHTML = formattedContent;
        }
        
        if (meta.intent) {
            const metaDiv = document.createElement('div');
            metaDiv.className = 'message-meta';
            metaDiv.textContent = `Intent: ${meta.intent}`;
            contentDiv.appendChild(metaDiv);
        }
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    formatContent(content) {
        // Convert markdown-style links to actual download links
        let formatted = content.replace(/\[📥 Download PDF [^\]]+\]\(([^)]+)\)/g, 
            '<a href="$1" target="_blank" class="download-link">📥 Download PDF</a>');
        
        // Handle other markdown-style links
        formatted = formatted.replace(/\[Click here to download\]\(([^)]+)\)/g, 
            '<a href="$1" target="_blank" class="download-link">📄 Download PDF</a>');
        
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
                html += `
                    <div class="employee-card">
                        <h4>${emp.name || 'Unknown'}</h4>
                        <p><strong>Title:</strong> ${emp.title || 'N/A'}</p>
                        <p><strong>Department:</strong> ${emp.department || 'N/A'}</p>
                        <p><strong>Email:</strong> ${emp.email || 'N/A'}</p>
                        ${emp.city ? `<p><strong>Location:</strong> ${emp.city}, ${emp.state}</p>` : ''}
                    </div>
                `;
            });
        } else if (employees && employees.length > 5) {
            html += `<p><em>Showing first 5 of ${employees.length} employees. Use filters for more specific results.</em></p>`;
            employees.slice(0, 5).forEach(emp => {
                html += `
                    <div class="employee-card">
                        <h4>${emp.name || 'Unknown'}</h4>
                        <p><strong>Title:</strong> ${emp.title || 'N/A'}</p>
                        <p><strong>Email:</strong> ${emp.email || 'N/A'}</p>
                    </div>
                `;
            });
        }
        
        return html;
    }

    showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message assistant typing';
        indicator.id = 'typingIndicator';
        indicator.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        this.chatMessages.appendChild(indicator);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    removeTypingIndicator() {
        document.getElementById('typingIndicator')?.remove();
    }

    saveChatMessage(userMsg, assistantMsg) {
        const chat = {
            id: this.currentChatId || Date.now(),
            timestamp: new Date().toISOString(),
            messages: [
                { role: 'user', content: userMsg },
                { role: 'assistant', content: assistantMsg }
            ]
        };
        
        if (!this.currentChatId) {
            this.currentChatId = chat.id;
            this.chatHistory.unshift(chat);
            this.updateChatHistorySidebar();
        }
        
        localStorage.setItem('hrms_chat_history', JSON.stringify(this.chatHistory));
    }

    loadChatHistory() {
        const saved = localStorage.getItem('hrms_chat_history');
        if (saved) {
            this.chatHistory = JSON.parse(saved);
            this.updateChatHistorySidebar();
        }
    }

    updateChatHistorySidebar() {
        const historyContainer = document.getElementById('chatHistory');
        historyContainer.innerHTML = '';
        
        this.chatHistory.slice(0, 20).forEach(chat => {
            const item = document.createElement('div');
            item.className = 'history-item';
            const preview = chat.messages[0].content.substring(0, 30);
            item.textContent = preview + (preview.length < chat.messages[0].content.length ? '...' : '');
            item.addEventListener('click', () => this.loadChat(chat.id));
            historyContainer.appendChild(item);
        });
    }

    loadChat(chatId) {
        const chat = this.chatHistory.find(c => c.id === chatId);
        if (!chat) return;
        
        this.currentChatId = chatId;
        this.chatMessages.innerHTML = '';
        
        chat.messages.forEach(msg => {
            this.addMessage(msg.role, msg.content);
        });
    }

    startNewChat() {
        this.currentChatId = null;
        this.chatMessages.innerHTML = `
            <div class="welcome-screen">
                <h1>HRMS AI Assistant</h1>
                <p>Ask me anything about employees, policies, or HR information</p>
                <div class="example-prompts">
                    <div class="example-prompt" data-prompt="employees from gj">
                        <h3>Find Employees</h3>
                        <p>employees from gj</p>
                    </div>
                    <div class="example-prompt" data-prompt="What is the parental leave policy?">
                        <h3>Policy Questions</h3>
                        <p>What is the parental leave policy?</p>
                    </div>
                    <div class="example-prompt" data-prompt="find all employees in IT">
                        <h3>Department Search</h3>
                        <p>find all employees in IT</p>
                    </div>
                    <div class="example-prompt" data-prompt="Show me employees in Madhya Pradesh">
                        <h3>Location Search</h3>
                        <p>Show me employees in Madhya Pradesh</p>
                    </div>
                </div>
            </div>
        `;
        
        document.querySelectorAll('.example-prompt').forEach(el => {
            el.addEventListener('click', () => {
                this.chatInput.value = el.dataset.prompt;
                this.sendMessage();
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new HRMSChat();
});
