// State
let messages = [];
let isGenerating = false;

// DOM
const chatContainer = document.getElementById('chatContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

// Init
document.addEventListener('DOMContentLoaded', () => {
    messages.push({ role: 'system', content: 'Tu es un assistant intelligent et utile. Réponds en français.' });

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    messageInput.addEventListener('input', () => {
        sendBtn.disabled = messageInput.value.trim() === '' || isGenerating;
        autoResize();
    });
});

function autoResize() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
}

async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || isGenerating) return;

    // Hide welcome, show messages
    welcomeScreen.style.display = 'none';
    messagesContainer.classList.add('active');

    // Add user message
    messages.push({ role: 'user', content });
    appendMessage('user', content);

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    isGenerating = true;

    // Add assistant placeholder
    const assistantDiv = appendMessage('assistant', '', true);
    const contentDiv = assistantDiv.querySelector('.message-content');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: messages,
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Erreur API');
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
                        }
                    } catch (e) {}
                }
            }
        }

        contentDiv.innerHTML = formatMessage(assistantMessage);
        highlightAllCode();
        messages.push({ role: 'assistant', content: assistantMessage });

    } catch (error) {
        contentDiv.innerHTML = `<div class="error-message">Erreur: ${error.message}</div>`;
    } finally {
        isGenerating = false;
        sendBtn.disabled = messageInput.value.trim() === '';
    }
}

function appendMessage(role, content, isStreaming = false) {
    const div = document.createElement('div');
    div.className = `message ${role}`;

    if (role === 'assistant') {
        div.innerHTML = `
            <div class="message-avatar">N</div>
            <div class="message-content">${isStreaming ? '<div class="typing-indicator"><span></span><span></span><span></span></div>' : formatMessage(content)}</div>
        `;
    } else {
        div.innerHTML = `<div class="message-content">${formatMessage(content)}</div>`;
    }

    messagesContainer.appendChild(div);
    if (!isStreaming) highlightAllCode();
    scrollToBottom();
    return div;
}

function formatMessage(content) {
    if (!content) return '';

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

            return `<pre><div class="code-header"><span>${lang}</span><button class="copy-btn" onclick="copyCode(this)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M8 4V16C8 17.1 8.9 18 10 18H18C19.1 18 20 17.1 20 16V7.83C20 7.3 19.79 6.79 19.41 6.41L16.59 3.59C16.21 3.21 15.7 3 15.17 3H10C8.9 3 8 3.9 8 5M8 4H6C4.9 4 4 4.9 4 6V20C4 21.1 4.9 22 6 22H14C15.1 22 16 21.1 16 20V18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Copier</button></div><code class="hljs language-${lang}">${highlighted}</code></pre>`;
        }
    };

    marked.use({ renderer, breaks: true, gfm: true });
    return marked.parse(content);
}

function copyCode(button) {
    const code = button.closest('pre').querySelector('code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        const original = button.innerHTML;
        button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Copié!';
        setTimeout(() => button.innerHTML = original, 2000);
    });
}

function highlightAllCode() {
    document.querySelectorAll('pre code:not(.hljs)').forEach(block => hljs.highlightElement(block));
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function usePrompt(prompt) {
    messageInput.value = prompt;
    messageInput.focus();
    sendBtn.disabled = false;
    autoResize();
}

window.copyCode = copyCode;
window.usePrompt = usePrompt;
