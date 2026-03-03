class Chatbot {
    constructor() {
        this.sessionId = 'user-' + Date.now();
        this.isMinimized = false;
        this.isTyping = false;
        this.messageCount = 0;
        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.autoResizeTextarea();
        this.addWelcomeMessage();
    }

    addWelcomeMessage() {
        setTimeout(() => {
            this.addMessage("Hi! How are you doing today?", 'bot');
        }, 500);
    }

    cacheDOM() {
        this.widget = document.getElementById('chatWidget');
        this.header = document.getElementById('chatHeader');
        this.toggleBtn = document.getElementById('toggleChat');
        this.messagesContainer = document.getElementById('chatMessages');
        this.input = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendButton');
    }

    bindEvents() {
        this.header.addEventListener('click', (e) => {
            if (e.target !== this.toggleBtn && !this.toggleBtn.contains(e.target)) {
                this.toggleChat();
            }
        });
        
        this.toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleChat();
        });
        
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.input.addEventListener('input', () => this.autoResizeTextarea());
    }

    toggleChat() {
        this.isMinimized = !this.isMinimized;
        this.widget.classList.toggle('minimized');
        this.toggleBtn.textContent = this.isMinimized ? '+' : '−';
        
        if (!this.isMinimized) {
            setTimeout(() => this.input.focus(), 300);
            this.scrollToBottom();
        }
    }

    autoResizeTextarea() {
        this.input.style.height = 'auto';
        this.input.style.height = Math.min(this.input.scrollHeight, 80) + 'px';
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    async sendMessage() {
        const message = this.input.value.trim();
        if (!message || this.isTyping) return;

        this.input.value = '';
        this.input.style.height = 'auto';
        
        this.addMessage(message, 'user');
        this.showTypingIndicator();
        this.scrollToBottom();
        
        try {
            const response = await this.getBotResponse(message);
            this.removeTypingIndicator();
            this.addMessage(response, 'bot');
            this.scrollToBottom();
        } catch (error) {
            this.removeTypingIndicator();
            this.addMessage('I apologize, but I\'m having trouble connecting. Please try again.', 'bot');
            this.scrollToBottom();
            console.error('Error:', error);
        }
    }

    addMessage(content, sender) {
        this.messageCount++;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(messageDiv);
    }

    showTypingIndicator() {
        this.isTyping = true;
        this.sendBtn.disabled = true;
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot';
        typingDiv.id = 'typingIndicator';
        
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'typing-indicator';
        indicatorDiv.innerHTML = '<span></span><span></span><span></span>';
        
        typingDiv.appendChild(indicatorDiv);
        this.messagesContainer.appendChild(typingDiv);
    }

    removeTypingIndicator() {
        this.isTyping = false;
        this.sendBtn.disabled = false;
        
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    async getBotResponse(message) {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                sessionId: this.sessionId
            })
        });

        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.response;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Chatbot();
});