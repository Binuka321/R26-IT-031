import React, { useState } from 'react';

interface LoginPageProps {
  onLogin: (user: { username: string; name: string; role: string; token: string }) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const API_BASE = import.meta.env.VITE_API_BASE;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const path = mode === 'login' ? 'auth/login' : 'auth/register';
    const body = mode === 'login' ? { username, password } : { name, username, password };

    try {
      const resp = await fetch(`${API_BASE}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await resp.json();
      if (!resp.ok) {
        setMessage(data.message || 'Error');
        return;
      }

      if (mode === 'register') {
        setMessage('Registration successful. Please login.');
        setMode('login');
        return;
      }

      if (data.token && data.user) {
        localStorage.setItem('flood-user-token', data.token);
        localStorage.setItem('flood-user', JSON.stringify(data.user));
        onLogin({ ...data.user, token: data.token });
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-4">
      <div className="w-full max-w-md rounded-2xl bg-black/40 p-6 shadow-2xl backdrop-blur-lg border border-cyan-400/20">
        <h2 className="text-3xl font-bold mb-2 text-center">{mode === 'login' ? 'Login' : 'Register'}</h2>
        

        <div className="flex justify-center gap-2 mb-4">
          <button type="button" onClick={() => setMode('login')} className={`px-4 py-2 rounded-lg ${mode === 'login' ? 'bg-cyan-500 font-semibold' : 'bg-slate-800'}`}>
            Login
          </button>
          <button type="button" onClick={() => setMode('register')} className={`px-4 py-2 rounded-lg ${mode === 'register' ? 'bg-cyan-500 font-semibold' : 'bg-slate-800'}`}>
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full p-3 rounded-xl bg-slate-900 border border-cyan-500/30"
              required
            />
          )}
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full p-3 rounded-xl bg-slate-900 border border-cyan-500/30"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full p-3 rounded-xl bg-slate-900 border border-cyan-500/30"
            required
          />
          <button type="submit" className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 font-semibold">
            {mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

        {message && <p className="mt-4 text-center text-sm text-orange-300">{message}</p>}
      </div>
    </div>
  );
}
