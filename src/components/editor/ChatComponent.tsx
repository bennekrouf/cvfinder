// components/ChatComponent.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FiSend, FiUser, FiDownload, FiEdit, FiFile } from 'react-icons/fi';
import { FaMagic } from "react-icons/fa";
import { signInWithGoogle } from '@/lib/firebase';
import { useAPI0Chat } from '@/hooks/useAPI0Chat';
import { useTranslations } from 'next-intl';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  executionResult?: any;
  type?: 'text' | 'command' | 'result';
}

interface ChatComponentProps {
  isVisible: boolean;
  isAuthenticated: boolean;
  loading: boolean;
}

const ChatComponent: React.FC<ChatComponentProps> = ({ isVisible, isAuthenticated, loading }) => {
  const t = useTranslations('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      type: 'text',
      content: isAuthenticated
        ? t('welcome_authenticated')
        : t('welcome_guest'),
      timestamp: new Date(),
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isLoading,
    executeCommand,
    getCommandSuggestions,
    handlePDFDownload,
  } = useAPI0Chat();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // For unauthenticated users, show auth prompt for commands
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }

    const userMessage = addMessage({
      role: 'user',
      content: inputValue.trim(),
    });

    const messageContent = inputValue.trim();
    setInputValue('');
    setShowSuggestions(false);

    if (isAuthenticated) {
      try {
        const result = await executeCommand(messageContent);

        if (result.success) {
          let responseContent = '';
          let resultData = null;

          // Handle conversation responses
          if (result.type === 'conversation') {
            addMessage({
              role: 'assistant',
              type: 'text',
              content: result.data?.content || result.data?.response || 'I can help you with CV questions.',
            });
            return;
          }

          // Handle action responses
          if (result.type === 'pdf') {
            responseContent = '✅ CV generated successfully! Click below to download.';
            resultData = result;
            handlePDFDownload(result);
          } else if (result.type === 'edit') {
            responseContent = `✅ Ready to edit: ${result.data?.section} section for ${result.data?.person}`;
            resultData = result;
          } else if (result.type === 'file_content') {
            responseContent = `✅ File content retrieved: ${result.data?.path}`;
            resultData = result;
          } else {
            responseContent = '✅ Command executed successfully!';
            if (result.data) {
              resultData = result.data;
              responseContent += `\n\nResult: ${JSON.stringify(result.data, null, 2)}`;
            }
          }

          addMessage({
            role: 'assistant',
            type: 'result',
            content: responseContent,
            executionResult: resultData,
          });
        } else {
          addMessage({
            role: 'assistant',
            type: 'text',
            content: `❌ ${result.error}`,
          });
        }
      } catch (error) {
        addMessage({
          role: 'assistant',
          type: 'text',
          content: `❌ Error: ${error instanceof Error ? error.message : 'Command failed'}`,
        });
      }
      // }
    } else {
      // Regular conversation - simulate AI response
      setTimeout(() => {
        const responses = [
          "I can help you with CV-related questions! For advanced operations like generating PDFs or editing files, try signing in and using commands.",
          "Great question about CVs! I can provide general advice, or you can sign in to use command features like 'Generate CV for [person]'.",
          "For CV best practices, focus on clear achievements and quantifiable results. Sign in to access file editing and generation features.",
        ];

        addMessage({
          role: 'assistant',
          type: 'text',
          content: responses[Math.floor(Math.random() * responses.length)],
        });
      }, 1000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(value.length > 2 && isAuthenticated);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      setShowAuthPrompt(false);
      addMessage({
        role: 'assistant',
        type: 'text',
        content: '🎉 Welcome! You can now use commands like:\n• "Generate CV for john-doe"\n• "Create person profile for jane-smith"\n• "Get CV templates"',
      });
    } catch (error) {
      console.error('Sign-in failed:', error);
    }
    setIsSigningIn(false);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const suggestions = showSuggestions ? getCommandSuggestions(inputValue) : [];

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Auth Prompt Modal */}
      {showAuthPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-96">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <FaMagic className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">CV Commands Available</h3>
                <p className="text-sm text-muted-foreground">Sign in to execute CV operations</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Commands like CV generation and file editing require authentication to access your CVenom account.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowAuthPrompt(false)}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isSigningIn ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiUser className="w-4 h-4" />
                )}
                <span>{isSigningIn ? 'Signing in...' : 'Sign In'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Header */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <FaMagic className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{t('assistant_title')}</h2>
              <p className="text-xs text-muted-foreground">
                {isAuthenticated
                  ? t('assistant_subtitle_authenticated')
                  : t('assistant_subtitle_guest')
                }
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {isLoading && 'Processing...'}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 ${message.role === 'user'
                ? message.type === 'command'
                  ? 'bg-blue-600 text-white'
                  : 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-foreground'
                }`}
            >
              <div className="flex items-start space-x-2">
                {message.role === 'assistant' && (
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                    <FaMagic className="w-3 h-3 text-primary" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    {message.type === 'command' && (
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">CMD</span>
                    )}
                    {message.type === 'result' && (
                      <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded">RESULT</span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap selectable">{message.content}</p>

                  {/* Execution result actions */}
                  {message.executionResult && (
                    <div className="mt-3 space-y-2">
                      {message.executionResult.type === 'pdf' && (
                        <button
                          onClick={() => handlePDFDownload(message.executionResult)}
                          className="flex items-center space-x-2 px-3 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                        >
                          <FiDownload className="w-3 h-3" />
                          <span>Download PDF</span>
                        </button>
                      )}
                      {message.executionResult.type === 'edit' && (
                        <button
                          className="flex items-center space-x-2 px-3 py-1.5 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 transition-colors"
                        >
                          <FiEdit className="w-3 h-3" />
                          <span>Open Editor</span>
                        </button>
                      )}
                      {message.executionResult.type === 'file_content' && (
                        <div className="bg-secondary rounded p-2 text-xs">
                          <div className="flex items-center space-x-2 mb-1">
                            <FiFile className="w-3 h-3" />
                            <span className="font-medium">{message.executionResult.data?.path}</span>
                          </div>
                          <pre className="text-xs overflow-x-auto max-h-32 overflow-y-auto">
                            {message.executionResult.data?.content}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  <p className={`text-xs mt-2 ${message.role === 'user'
                    ? 'text-white/70'
                    : 'text-muted-foreground'
                    }`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="w-6 h-6 bg-primary-foreground/10 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                    <FiUser className="w-3 h-3 text-primary-foreground/70" />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-3 bg-card border border-border">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <FaMagic className="w-3 h-3 text-primary animate-pulse" />
                </div>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="border-t border-border bg-card px-4 py-2">
          <div className="text-xs text-muted-foreground mb-2">Suggested commands:</div>
          <div className="space-y-1">
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="block w-full text-left px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            placeholder={isAuthenticated
              ? t('input_placeholder_authenticated')
              : t('input_placeholder_guest')
            }
            className="w-full pl-4 pr-12 py-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Send message (Enter)"
          >
            <FiSend className="w-4 h-4" />
          </button>
        </div>
        {/* Input Area footer text */}
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {isAuthenticated
            ? t('footer_text')
            : t('footer_text_guest')
          }
        </p>
      </div>
    </div>
  );
};

export default ChatComponent;
