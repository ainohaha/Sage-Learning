'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Download } from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // HH:MM:SS
  thinking?: string;
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "Hey, I'm Sage. I'm here to think through this with you, not to think for you. Tell me what you're trying to build and where you're at right now.",
  timestamp: '', // Will be set on client to avoid hydration mismatch
};

export default function ParticipantView() {
  const [sessionId, setSessionId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSessionId('S-' + Math.random().toString(36).substring(2, 8).toUpperCase());
    setStartTime(new Date().toISOString());
    setMessages([{ ...INITIAL_MESSAGE, timestamp: format(new Date(), 'HH:mm:ss') }]);
    setMounted(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: format(new Date(), 'HH:mm:ss'),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsStreaming(true);

    const assistantMessageIndex = newMessages.length;
    setMessages([...newMessages, { role: 'assistant', content: '', timestamp: format(new Date(), 'HH:mm:ss'), thinking: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          startTime,
          messages: newMessages,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let accumulatedText = '';
        let accumulatedThinking = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\\n').filter(Boolean);

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.type === 'text') {
                accumulatedText += data.content;
              } else if (data.type === 'thinking') {
                accumulatedThinking += data.content;
              }

              // Update state for UI to re-render
              setMessages((prev) => {
                const next = [...prev];
                if (next[assistantMessageIndex]) {
                  next[assistantMessageIndex] = {
                    ...next[assistantMessageIndex],
                    content: accumulatedText,
                    thinking: accumulatedThinking,
                  };
                }
                return next;
              });

            } catch {
              // Handle partial JSON or ignore
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleEndSession = () => {
    const startObj = new Date(startTime);
    const endObj = new Date();
    
    const diffMs = Math.abs(endObj.getTime() - startObj.getTime());
    const hrs = String(Math.floor(diffMs / 3600000)).padStart(2, '0');
    const mins = String(Math.floor((diffMs % 3600000) / 60000)).padStart(2, '0');
    const secs = String(Math.floor((diffMs % 60000) / 1000)).padStart(2, '0');
    const durationStr = `${hrs}:${mins}:${secs}`;

    let txtContent = `COGNITION VS CONVENIENCE — SESSION EXPORT\n`;
    txtContent += `Session started: ${format(startObj, 'yyyy-MM-dd HH:mm:ss')}\n`;
    txtContent += `Exported: ${format(endObj, 'yyyy-MM-dd HH:mm:ss')}\n`;
    txtContent += `─────────────────────────────────\n`;
    
    for (const m of messages) {
      if (m.role === 'user') {
        txtContent += `[${m.timestamp}] PARTICIPANT: ${m.content}\n`;
      } else {
        txtContent += `[${m.timestamp}] SAGE: ${m.content}\n`;
      }
    }
    
    txtContent += `─────────────────────────────────\n`;
    txtContent += `TOTAL MESSAGES: ${messages.length}\n`;
    txtContent += `SESSION DURATION: ${durationStr}\n`;

    // Download file
    const blob = new Blob([txtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${format(endObj, 'yyyyMMdd_HHmmss')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Clear state/reload
    window.location.reload();
  };

  return (
    <div className="flex flex-col h-screen max-w-[720px] mx-auto px-4 font-sans bg-white text-black">
      {/* Header */}
      <div className="py-4 flex justify-end border-b">
        <button
          onClick={handleEndSession}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded hover:bg-zinc-800 transition-colors text-sm font-medium"
        >
          <Download size={16} />
          End Session + Download
        </button>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto py-8 flex flex-col gap-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col max-w-[85%] ${
              msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
            }`}
          >
            <div
              className={`px-4 py-3 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-zinc-100 text-black rounded-tr-sm'
                  : 'bg-white border border-zinc-200 text-black rounded-tl-sm'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              {isStreaming && msg.role === 'assistant' && i === messages.length - 1 && !msg.content && (
                <div className="flex items-center gap-2 h-5 text-zinc-500 text-sm italic">
                  <span>Sage is thinking</span>
                  <div className="flex gap-1 items-center mt-1">
                    <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" />
                    <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>
            <div className="text-xs text-zinc-400 mt-1 px-1">{msg.timestamp}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="py-4 border-t bg-white">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 bg-zinc-50 border border-zinc-200 p-2 rounded-xl focus-within:ring-2 focus-within:ring-black/5"
        >
          <textarea
            className="flex-1 max-h-32 min-h-12 bg-transparent resize-none outline-none p-2"
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={isStreaming}
            rows={1}
          />
          <button
            type="submit"
            disabled={isStreaming}
            className="p-3 bg-black text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
