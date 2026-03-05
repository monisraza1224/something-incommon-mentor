class Chatbot {
    constructor() {
        this.sessionId = 'user-' + Date.now();
        this.isMinimized = false;
        this.isTyping = false;
        this.messageCount = 0;
        this.sessionActive = true;  // Track if session is active
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
            this.addMessage("How are you doing today?", 'bot');
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

    disableInput(permanent = false) {
        this.input.disabled = true;
        this.sendBtn.disabled = true;
        this.input.placeholder = permanent ? "Session ended" : "Waiting for response...";
        if (permanent) {
            this.sessionActive = false;
        }
    }

    enableInput() {
        if (this.sessionActive) {
            this.input.disabled = false;
            this.sendBtn.disabled = false;
            this.input.placeholder = "Type your message...";
        }
    }

    async sendMessage() {
        const message = this.input.value.trim();
        if (!message || this.isTyping || !this.sessionActive) return;

        this.input.value = '';
        this.input.style.height = 'auto';
        
        this.addMessage(message, 'user');
        this.showTypingIndicator();
        this.disableInput();
        this.scrollToBottom();
        
        try {
            const response = await this.getBotResponse(message);
            this.removeTypingIndicator();
            
            // Check if session was terminated (crisis)
            if (response.crisis || response.terminate) {
                this.addMessage(response.response || response, 'bot');
                this.disableInput(true); // Permanently disable input
                this.scrollToBottom();
                return;
            }
            
            // Check if session ended naturally
            if (response.session_ended) {
                this.addMessage(response.response, 'bot');
                this.disableInput(true);
                this.scrollToBottom();
                return;
            }
            
            this.addMessage(response.response || response, 'bot');
            this.enableInput();
            this.scrollToBottom();
        } catch (error) {
            this.removeTypingIndicator();
            this.addMessage('I apologize, but I\'m having trouble connecting. Please try again.', 'bot');
            this.enableInput();
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
        return await response.json();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Chatbot();
});