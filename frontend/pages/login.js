import { useState } from "react";
import { useRouter } from "next/router";
import { login, register } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", businessName: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        await register(form.email, form.password, form.name, form.businessName);
      } else {
        await login(form.email, form.password);
      }
      router.push("/inbox");
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">POCK</h1>
        <p className="text-gray-500 mb-6 text-sm">AI Message Intelligence Platform</p>

        <form onSubmit={submit} className="space-y-4">
          {isRegister && (
            <>
              <input
                name="name"
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={handle}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                name="businessName"
                type="text"
                placeholder="Business name"
                value={form.businessName}
                onChange={handle}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </>
          )}
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handle}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handle}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? "Loading..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-blue-600 hover:underline"
          >
            {isRegister ? "Already have an account? Sign in" : "New business? Create account"}
          </button>
        </div>

        {isRegister && (
          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-gray-500 mb-2">Connect your channels after registering:</p>
            <button className="w-full flex items-center justify-center gap-2 border rounded-lg py-2 text-sm hover:bg-gray-50 transition">
              <span>📘</span> Connect with Facebook
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
