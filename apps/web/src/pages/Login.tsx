import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ArrowRight } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao fazer login';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-app">
      <div className="w-full max-w-md space-y-8">
        {/* Logo + Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sm bg-accent"
            >
              🖨️
            </div>
            <span className="text-2xl font-bold font-ui text-primary">
              Gráfica<span className="text-accent">OS</span>
            </span>
          </div>
          <h2 className="text-xl font-bold text-primary font-ui">
            Bem-vindo de volta
          </h2>
          <p className="text-sm text-muted">
            Faça login para acessar o sistema
          </p>
        </div>

        {/* Formulário */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-secondary">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="seu@email.com"
              className="login-input w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-secondary">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="••••••••"
              className="login-input w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus-ring font-mono"
            />
          </div>

          {error && (
            <div className="login-error rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3-5 text-sm font-bold transition-all ${
              loading || !email || !password ? 'login-btn-disabled' : 'login-btn-active'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                Entrar no Sistema
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
