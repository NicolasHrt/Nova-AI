'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Map des langages pour meilleure compatibilité
const languageMap = {
    'vue': 'markup',
    'svelte': 'markup',
    'html': 'markup',
    'jsx': 'jsx',
    'tsx': 'tsx',
    'sh': 'bash',
    'shell': 'bash',
    'zsh': 'bash',
};

export default function Home() {
    const [messages, setMessages] = useState([
        { role: 'system', content: 'Tu es un assistant intelligent et utile. Réponds en français.' }
    ]);
    const [input, setInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const textareaRef = useRef(null);
    const abortControllerRef = useRef(null);

    const showMessages = messages.length > 1;

    const examplePrompts = [
        'Explique-moi le machine learning simplement',
        'Écris une fonction Python pour trier une liste',
        'Quelles sont les bonnes pratiques REST API ?',
        'Aide-moi à débugger mon code'
    ];

    const autoResize = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
        }
    };

    useEffect(() => {
        autoResize();
    }, [input]);

    const copyCode = async (code) => {
        await navigator.clipboard.writeText(code);
    };

    const stopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || isGenerating) return;

        const userMessage = { role: 'user', content: input.trim() };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsGenerating(true);
        setStreamingContent('');

        abortControllerRef.current = new AbortController();
        let assistantMessage = '';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "gpt-5.2",
                    messages: newMessages,
                    stream: true
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur API');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

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
                                setStreamingContent(assistantMessage);
                            }
                        } catch (e) {}
                    }
                }
            }

            setMessages([...newMessages, { role: 'assistant', content: assistantMessage }]);
            setStreamingContent('');
        } catch (error) {
            if (error.name === 'AbortError') {
                // Stopped by user - save what we have so far
                if (assistantMessage) {
                    setMessages([...newMessages, { role: 'assistant', content: assistantMessage }]);
                }
                setStreamingContent('');
            } else {
                setMessages([...newMessages, { role: 'assistant', content: `Erreur: ${error.message}` }]);
                setStreamingContent('');
            }
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const CodeBlock = ({ language, children }) => {
        const [copied, setCopied] = useState(false);
        const mappedLang = languageMap[language] || language || 'text';

        const handleCopy = async () => {
            await copyCode(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };

        return (
            <pre>
                <div className="code-header">
                    <span>{language || 'code'}</span>
                    <button className="copy-btn" onClick={handleCopy}>
                        {copied ? 'Copié!' : 'Copier'}
                    </button>
                </div>
                <SyntaxHighlighter
                    language={mappedLang}
                    style={oneDark}
                    customStyle={{ margin: 0, padding: '14px', background: 'transparent' }}
                >
                    {children}
                </SyntaxHighlighter>
            </pre>
        );
    };

    const MessageContent = ({ content }) => (
        <ReactMarkdown
            components={{
                code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';

                    if (!inline && (match || String(children).includes('\n'))) {
                        return (
                            <CodeBlock language={language}>
                                {String(children).replace(/\n$/, '')}
                            </CodeBlock>
                        );
                    }
                    return <code className={className} {...props}>{children}</code>;
                }
            }}
        >
            {content}
        </ReactMarkdown>
    );

    return (
        <div className="app-container">
            <main className="main-content">
                <div className="chat-container">
                    {!showMessages ? (
                        <div className="welcome-screen">
                            <h1>Nova AI</h1>
                            <p>Ton assistant intelligent</p>
                            <div className="example-prompts">
                                {examplePrompts.map((prompt, i) => (
                                    <button
                                        key={i}
                                        className="example-prompt"
                                        onClick={() => setInput(prompt)}
                                    >
                                        {prompt.length > 30 ? prompt.slice(0, 30) + '...' : prompt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="messages active">
                            {messages.slice(1).map((msg, i) => (
                                <div key={i} className={`message ${msg.role}`}>
                                    {msg.role === 'assistant' && (
                                        <div className="message-avatar">N</div>
                                    )}
                                    <div className="message-content">
                                        <MessageContent content={msg.content} />
                                    </div>
                                </div>
                            ))}
                            {isGenerating && (
                                <div className="message assistant">
                                    <div className="message-avatar">N</div>
                                    <div className="message-content">
                                        {streamingContent ? (
                                            <>
                                                <MessageContent content={streamingContent} />
                                                <span className="streaming-cursor"></span>
                                            </>
                                        ) : (
                                            <div className="typing-indicator">
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="input-area">
                    <div className="input-container">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Écris ton message..."
                            rows={1}
                            autoFocus
                        />
                        {isGenerating ? (
                            <button
                                className="stop-btn"
                                onClick={stopGeneration}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                                </svg>
                            </button>
                        ) : (
                            <button
                                className="send-btn"
                                onClick={sendMessage}
                                disabled={!input.trim()}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
