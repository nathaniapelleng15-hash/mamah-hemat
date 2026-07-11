import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

// Cek apakah admin sudah login (token tersimpan di localStorage)
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('mh_admin_token');
  const expiry = localStorage.getItem('mh_admin_expiry');

  if (!token || !expiry) return <Navigate to="/admin" replace />;
  if (Date.now() > parseInt(expiry)) {
    localStorage.removeItem('mh_admin_token');
    localStorage.removeItem('mh_admin_expiry');
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
