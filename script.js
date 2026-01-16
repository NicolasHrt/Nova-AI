// State
let conversations = JSON.parse(localStorage.getItem('conversations')) || {};
let currentConversationId = null;
let isGenerating = false;

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistory = document.getElementById('chatHistory');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const saveSettingsBtn = document.getElementById('saveSettings');
const apiKeyInput = document.getElementById('apiKey');
const systemPromptInput = document.getElementById('systemPrompt');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    renderChatHistory();
    setupEventListeners();
    autoResizeTextarea();
});

// Event Listeners
function setupEventListeners() {
    // Send message
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Input change
    messageInput.addEventListener('input', () => {
        sendBtn.disabled = messageInput.value.trim() === '' || isGenerating;
        autoResizeTextarea();
    });

    // New chat
    newChatBtn.addEventListener('click', createNewChat);

    // Settings
    settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
    closeSettings.addEventListener('click', () => settingsModal.classList.remove('active'));
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.remove('active');
    });
    saveSettingsBtn.addEventListener('click', saveSettings);
}

// Auto-resize textarea
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
}

// Settings
function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('chatSettings')) || {};
    apiKeyInput.value = settings.apiKey || '';
    systemPromptInput.value = settings.systemPrompt || 'You are a helpful assistant.';
}

function saveSettings() {
    const settings = {
        apiKey: apiKeyInput.value,
        systemPrompt: systemPromptInput.value
    };
    localStorage.setItem('chatSettings', JSON.stringify(settings));
    settingsModal.classList.remove('active');
}

function getSettings() {
    const settings = JSON.parse(localStorage.getItem('chatSettings')) || {};
    settings.apiKey = 'YOUR_API_KEY_HERE';
    return settings;
}

// Chat History
function renderChatHistory() {
    chatHistory.innerHTML = '';
    const sortedConversations = Object.entries(conversations)
        .sort((a, b) => b[1].updatedAt - a[1].updatedAt);

    sortedConversations.forEach(([id, conv]) => {
        const item = document.createElement('div');
        item.className = `chat-history-item ${id === currentConversationId ? 'active' : ''}`;
        item.innerHTML = `
            <span>${conv.title || 'New Chat'}</span>
            <button class="delete-btn" onclick="deleteConversation('${id}', event)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6H5H21M19 6V20C19 21.1 18.1 22 17 22H7C5.9 22 5 21.1 5 20V6M8 6V4C8 2.9 8.9 2 10 2H14C15.1 2 16 2.9 16 4V6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        `;
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-btn')) {
                loadConversation(id);
            }
        });
        chatHistory.appendChild(item);
    });
}

function createNewChat() {
    currentConversationId = null;
    messagesContainer.innerHTML = '';
    messagesContainer.classList.remove('active');
    welcomeScreen.style.display = 'flex';
    messageInput.value = '';
    messageInput.focus();
    renderChatHistory();
}

function loadConversation(id) {
    currentConversationId = id;
    const conv = conversations[id];

    welcomeScreen.style.display = 'none';
    messagesContainer.classList.add('active');
    messagesContainer.innerHTML = '';

    conv.messages.forEach(msg => {
        if (msg.role !== 'system') {
            appendMessage(msg.role, msg.content, false);
        }
    });

    renderChatHistory();
    scrollToBottom();
}

function deleteConversation(id, event) {
    event.stopPropagation();
    delete conversations[id];
    localStorage.setItem('conversations', JSON.stringify(conversations));

    if (currentConversationId === id) {
        createNewChat();
    }
    renderChatHistory();
}

function saveConversation() {
    if (currentConversationId) {
        conversations[currentConversationId].updatedAt = Date.now();
        localStorage.setItem('conversations', JSON.stringify(conversations));
    }
}

// Generate conversation title from first message
function generateTitle(message) {
    return message.substring(0, 30) + (message.length > 30 ? '...' : '');
}

// Send Message
async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || isGenerating) return;

    const settings = getSettings();
    if (!settings.apiKey) {
        alert('Please set your OpenAI API key in Settings');
        settingsModal.classList.add('active');
        return;
    }

    // Create new conversation if needed
    if (!currentConversationId) {
        currentConversationId = Date.now().toString();
        conversations[currentConversationId] = {
            id: currentConversationId,
            title: generateTitle(content),
            messages: [
                { role: 'system', content: settings.systemPrompt || 'You are a helpful assistant.' }
            ],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        welcomeScreen.style.display = 'none';
        messagesContainer.classList.add('active');
    }

    // Add user message
    conversations[currentConversationId].messages.push({ role: 'user', content });
    appendMessage('user', content);

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    isGenerating = true;

    // Add assistant message placeholder
    const assistantDiv = appendMessage('assistant', '', true);
    const contentDiv = assistantDiv.querySelector('.message-content');

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-5.2',
                messages: conversations[currentConversationId].messages,
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices[0]?.delta?.content;
                        if (delta) {
                            assistantMessage += delta;
                            contentDiv.innerHTML = formatMessage(assistantMessage) + '<span class="streaming-cursor"></span>';
                            scrollToBottom();
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }

        // Final render without cursor
        contentDiv.innerHTML = formatMessage(assistantMessage);
        highlightAllCode();

        // Save assistant message
        conversations[currentConversationId].messages.push({ role: 'assistant', content: assistantMessage });
        saveConversation();
        renderChatHistory();

    } catch (error) {
        contentDiv.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
    } finally {
        isGenerating = false;
        sendBtn.disabled = messageInput.value.trim() === '';
    }
}

// Append message to chat
function appendMessage(role, content, isStreaming = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatarText = role === 'user' ? 'U' : 'AI';

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarText}</div>
        <div class="message-content">${isStreaming ? '<div class="typing-indicator"><span></span><span></span><span></span></div>' : formatMessage(content)}</div>
    `;

    messagesContainer.appendChild(messageDiv);

    if (!isStreaming) {
        highlightAllCode();
    }

    scrollToBottom();
    return messageDiv;
}

// Format message with markdown
function formatMessage(content) {
    if (!content) return '';

    // Custom renderer for code blocks (marked v5+ uses object parameter)
    const renderer = {
        code(obj) {
            const code = obj.text || obj;
            const lang = obj.lang || 'plaintext';

            let highlighted;
            try {
                highlighted = lang && hljs.getLanguage(lang)
                    ? hljs.highlight(code, { language: lang }).value
                    : hljs.highlightAuto(code).value;
            } catch (e) {
                highlighted = code;
            }

            return `<pre><div class="code-header"><span>${lang}</span><button class="copy-btn" onclick="copyCode(this)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M8 4V16C8 17.1 8.9 18 10 18H18C19.1 18 20 17.1 20 16V7.83C20 7.3 19.79 6.79 19.41 6.41L16.59 3.59C16.21 3.21 15.7 3 15.17 3H10C8.9 3 8 3.9 8 5M8 4H6C4.9 4 4 4.9 4 6V20C4 21.1 4.9 22 6 22H14C15.1 22 16 21.1 16 20V18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Copy</button></div><code class="hljs language-${lang}">${highlighted}</code></pre>`;
        }
    };

    marked.use({ renderer, breaks: true, gfm: true });

    return marked.parse(content);
}

// Copy code to clipboard
function copyCode(button) {
    const pre = button.closest('pre');
    const code = pre.querySelector('code');
    const text = code.textContent;

    navigator.clipboard.writeText(text).then(() => {
        const originalText = button.innerHTML;
        button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Copied!';
        setTimeout(() => {
            button.innerHTML = originalText;
        }, 2000);
    });
}

// Highlight all code blocks
function highlightAllCode() {
    document.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
        hljs.highlightElement(block);
    });
}

// Scroll to bottom
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Use example prompt
function usePrompt(prompt) {
    messageInput.value = prompt;
    messageInput.focus();
    sendBtn.disabled = false;
    autoResizeTextarea();
}

// Make functions available globally
window.copyCode = copyCode;
window.usePrompt = usePrompt;
window.deleteConversation = deleteConversation;
