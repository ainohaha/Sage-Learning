'use client';

import { useState, useEffect } from 'react';
import type { Session } from '@/lib/sessionStore';
import { format } from 'date-fns';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/sessions', {
        headers: {
          'Authorization': `Bearer ${password}`
        }
      });

      if (!res.ok) {
        throw new Error('Invalid password');
      }

      const data = await res.json();
      setSessions(data.sessions);
      setIsAuthenticated(true);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      const fetchSessions = async () => {
        try {
          const res = await fetch('/api/admin/sessions', {
            headers: { 'Authorization': `Bearer ${password}` }
          });
          if (res.ok) {
            const data = await res.json();
            setSessions(data.sessions);
          }
        } catch (error) {
          console.error(error);
        }
      };

      const interval = setInterval(fetchSessions, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, password]);

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(sessions, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 font-sans">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 p-8 rounded-xl shadow-2xl">
          <h1 className="text-xl text-white font-medium text-center mb-6">Admin Login</h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              required
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black py-3 rounded-lg font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800">
          <h1 className="text-2xl text-white font-medium">Session Logs</h1>
          <div className="flex items-center gap-4">
            <span className="text-zinc-500 text-sm">{sessions.length} Session(s)</span>
            <button
              onClick={handleExportJSON}
              className="px-4 py-2 bg-white text-black text-sm font-medium rounded hover:bg-zinc-200 transition-colors"
            >
              Export JSON
            </button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-20 text-zinc-600">No sessions recorded yet.</div>
        ) : (
          <div className="flex flex-col gap-8">
            {sessions.map((session) => (
              <div key={session.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
                  <div className="flex gap-6 text-sm">
                    <div className="flex flex-col">
                      <span className="text-zinc-500 uppercase text-xs">ID</span>
                      <span className="text-white font-mono">{session.id}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-500 uppercase text-xs">Started</span>
                      <span className="text-white">{format(new Date(session.startTime), 'MMM d, HH:mm:ss')}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-500 uppercase text-xs">Duration</span>
                      <span className="text-white font-mono">{session.duration}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 flex flex-col gap-6">
                  {session.messages.map((msg, i) => (
                    <div key={i} className="flex flex-col gap-2">
                       <div className="flex items-baseline gap-2">
                         <span className={`text-xs font-bold ${msg.role === 'user' ? 'text-blue-400' : 'text-emerald-400'}`}>
                           {msg.role === 'user' ? 'PARTICIPANT' : 'SAGE'}
                         </span>
                         <span className="text-xs text-zinc-500 font-mono">[{msg.timestamp}]</span>
                       </div>
                       
                       <div className="text-zinc-200 whitespace-pre-wrap leading-relaxed">
                         {msg.content}
                       </div>

                       {msg.role === 'assistant' && msg.thinking && (
                         <details className="mt-2 text-sm group">
                           <summary className="cursor-pointer text-zinc-500 hover:text-zinc-400 font-medium select-none flex items-center gap-2">
                             <span className="transition-transform group-open:rotate-90">▶</span>
                             Claude Reasoning
                           </summary>
                           <div className="mt-3 p-4 bg-zinc-950 border border-zinc-800 rounded font-mono text-zinc-400 whitespace-pre-wrap text-xs">
                             {msg.thinking}
                           </div>
                         </details>
                       )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
