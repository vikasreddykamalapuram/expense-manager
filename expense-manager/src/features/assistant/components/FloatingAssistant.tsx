import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Trash2, User, X } from 'lucide-react';
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
  "Am I within budget?",
  "Financial health check",
  "Top expense categories",
  "Income vs expenses",
  "Tips to save more",
  "My recurring expenses",
  "Portfolio summary",
];

export function FloatingAssistant() {
  const { state } = useAppContext();
  const { transactions, categories, accounts, settings, budgets, recurringRules, stockTransactions } = state;
  const [isOpen, setIsOpen] = useState(false);
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

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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

    setTimeout(() => {
      const response: AssistantResponse = processQuery(text.trim(), {
        transactions,
        categories,
        accounts,
        settings,
        budgets,
        recurringRules,
        stockTransactions,
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
  }, [transactions, categories, accounts, settings, budgets, recurringRules, stockTransactions]);

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
    const lines = text.split('\n');
    return lines.map((line, i) => {
      let formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
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
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center animate-pulse-glow lg:bottom-6 lg:right-24"
          aria-label="Open AI Assistant"
        >
          <Sparkles size={24} />
        </button>
      )}

      {/* Chat Panel */}
      <div
        className={classNames(
          'fixed bottom-6 right-6 z-50 flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl transition-all duration-300 ease-out',
          'w-[calc(100vw-3rem)] sm:w-[400px] h-[500px] rounded-2xl',
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl bg-gradient-to-r from-primary-500 to-primary-700">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-white" />
            <h2 className="text-sm font-semibold text-white">AI Assistant</h2>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Clear chat"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && !isTyping && (
            <div className="flex flex-col items-center justify-center h-full text-center px-2">
              <div className="rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 p-4 mb-4">
                <Sparkles className="h-8 w-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Hi! I'm your financial assistant
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Ask me anything about your finances
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-300 dark:hover:border-primary-600 hover:text-primary-700 dark:hover:text-primary-400 transition-all"
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
                'flex gap-2',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 mt-1">
                  <div className="rounded-full bg-gradient-to-br from-primary-500 to-primary-700 p-1">
                    <Sparkles size={10} className="text-white" />
                  </div>
                </div>
              )}
              <div
                className={classNames(
                  'rounded-2xl px-3 py-2 max-w-[80%] text-xs leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-md'
                )}
              >
                {msg.role === 'assistant' ? renderMessageText(msg.text) : msg.text}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 mt-1">
                  <div className="rounded-full bg-gray-200 dark:bg-gray-600 p-1">
                    <User size={10} className="text-gray-600 dark:text-gray-300" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2 justify-start">
              <div className="flex-shrink-0 mt-1">
                <div className="rounded-full bg-gradient-to-br from-primary-500 to-primary-700 p-1">
                  <Sparkles size={10} className="text-white" />
                </div>
              </div>
              <div className="rounded-2xl rounded-bl-md bg-gray-100 dark:bg-gray-700 px-3 py-2">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:0ms]"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:150ms]"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:300ms]"></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances..."
              className="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
              disabled={isTyping}
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isTyping}
              className="rounded-xl bg-primary-600 px-3 py-2 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
