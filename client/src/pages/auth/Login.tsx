import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, Loader2 } from 'lucide-react';
import { useAuth } from '../../stores/AuthContext';
import Button from '../../components/Button';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('priya@northwind.demo');
  const [password, setPassword] = useState('Demo123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Bot size={22} />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500">Sign in to your AI Sales Agent workspace</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            {loading && <Loader2 className="hidden" />}
            Sign in
          </Button>
          <p className="text-center text-xs text-gray-400">Demo password: Demo123! (seeded demo org)</p>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium text-brand-600 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
