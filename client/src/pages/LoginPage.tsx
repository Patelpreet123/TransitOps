import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Sign in to TransitOps</h1>
        <p className="muted">Use your email and password to access the platform.</p>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="fleet@transitops.demo"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="password123"
              required
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-footer">
          Need an account? <Link to="/register">Create one</Link>
        </p>

        <div className="demo-box">
          <p><strong>Demo accounts</strong> (password: password123)</p>
          <ul>
            <li>fleet@transitops.demo — Fleet Manager</li>
            <li>driver@transitops.demo — Driver</li>
            <li>safety@transitops.demo — Safety Officer</li>
            <li>finance@transitops.demo — Financial Analyst</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
