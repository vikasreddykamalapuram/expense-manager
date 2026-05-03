import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Trash2, User } from 'lucide-react';
import DOMPurify from 'dompurify';
import { useAppContext } from '../../../context/AppContext';
import { processQuery, AssistantResponse } from '../../../shared/services/aiAssistant';
import { classNames } from '../../../shared/utils/helpers';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  "What's my spending this month?",
  "Top expense categories",
  "Income vs expenses",
  "Analyze my spending patterns",
  "Financial summary",
  "Where am I overspending?",
];

export function AssistantPage() {
  const { state } = useAppContext();
  const { transactions, categories, accounts, settings } = state;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const handleSend = useCallback((text: string) => {
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate typing delay for natural feel
    setTimeout(() => {
      const response: AssistantResponse = processQuery(text.trim(), {
        transactions,
        categories,
        accounts,
        settings,
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: response.text,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 400 + Math.random() * 400);
  }, [transactions, categories, accounts, settings]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  const renderMessageText = (text: string) => {
    // Parse markdown-like formatting
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Bold text
      let formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Color amounts: green for income indicators, red for expense
      formatted = formatted.replace(
        /💚/g, '<span class="text-green-600 dark:text-green-400">💚</span>'
      );
      formatted = formatted.replace(
        /🔴/g, '<span class="text-red-500 dark:text-red-400">🔴</span>'
      );
      const sanitized = DOMPurify.sanitize(formatted, { ALLOWED_TAGS: ['strong', 'span'], ALLOWED_ATTR: ['class'] });
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: sanitized }} />
          {i < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 p-2.5">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">AI Assistant</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ask anything about your finances</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
            Clear
          </button>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
        {messages.length === 0 && !isTyping && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 p-6 mb-6">
              <Sparkles className="h-12 w-12 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Hi! I'm your financial assistant
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md">
              I can analyze your transactions, show spending patterns, compare income vs expenses, and much more. Try asking:
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-300 dark:hover:border-primary-600 hover:text-primary-700 dark:hover:text-primary-400 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={classNames(
              'flex gap-3',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 mt-1">
                <div className="rounded-full bg-gradient-to-br from-primary-500 to-primary-700 p-1.5">
                  <Sparkles size={14} className="text-white" />
                </div>
              </div>
            )}
            <div
              className={classNames(
                'rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-br-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-md'
              )}
            >
              {msg.role === 'assistant' ? renderMessageText(msg.text) : msg.text}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 mt-1">
                <div className="rounded-full bg-gray-200 dark:bg-gray-600 p-1.5">
                  <User size={14} className="text-gray-600 dark:text-gray-300" />
                </div>
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 mt-1">
              <div className="rounded-full bg-gradient-to-br from-primary-500 to-primary-700 p-1.5">
                <Sparkles size={14} className="text-white" />
              </div>
            </div>
            <div className="rounded-2xl rounded-bl-md bg-gray-100 dark:bg-gray-700 px-4 py-3">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:0ms]"></span>
                <span className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:150ms]"></span>
                <span className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:300ms]"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your finances..."
          className="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
          disabled={isTyping}
        />
        <button
          onClick={() => handleSend(input)}
          disabled={!input.trim() || isTyping}
          className="rounded-xl bg-primary-600 px-4 py-3 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
