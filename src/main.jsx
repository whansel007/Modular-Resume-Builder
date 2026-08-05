import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import App from './App';
import './tokens.css';
import './print.css';

// Deep-link handoff from the "Copy Job Description" browser extension:
// /builder?new=true&autofill=1&jd=<text>&t=<job title>
// The JD can be large, and the user may be logged out (in which case the
// builder redirects to /login and the query string is lost), so capture it
// into sessionStorage before React renders. The builder consumes it later.
try {
  const params = new URLSearchParams(window.location.search);
  const jd = params.get('jd');
  if (jd) {
    sessionStorage.setItem('mrb-ext-jd', jd);
    sessionStorage.setItem('mrb-ext-autofill', params.get('autofill') === '1' ? '1' : '');
    sessionStorage.setItem('mrb-ext-title', params.get('t') || '');
    // Strip the payload from the URL so it doesn't linger in history/logs.
    params.delete('jd');
    params.delete('t');
    params.delete('autofill');
    const qs = params.toString();
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash,
    );
  }
} catch {
  // sessionStorage unavailable — deep link simply won't auto-import.
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/builder" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
