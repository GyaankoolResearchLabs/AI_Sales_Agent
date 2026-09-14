import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { useAuth } from '../../stores/AuthContext';
import Button from '../../components/Button';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', organizationName: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(form.name, form.email, form.password, form.organizationName);
      navigate('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
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
          <h1 className="text-lg font-semibold text-gray-900">Create your workspace</h1>
          <p className="text-sm text-gray-500">Set up your organization in a couple of minutes</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Organization name</label>
            <input
              required
              value={form.organizationName}
              onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
              placeholder="Acme Inc."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Your name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-ring"
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Create workspace
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
