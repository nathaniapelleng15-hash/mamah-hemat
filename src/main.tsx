import React, { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import AdminLogin from './admin/AdminLogin';
import ProtectedRoute from './admin/ProtectedRoute';
import { ErrorBoundary } from './admin/ErrorBoundary';
import './index.css';

// Lazy load admin pages — mencegah error di satu page memblokir seluruh app
const AdminApp     = React.lazy(() => import('./admin/AdminApp'));
const Orders       = React.lazy(() => import('./admin/pages/Orders'));
const Transactions = React.lazy(() => import('./admin/pages/Transactions'));
const Products     = React.lazy(() => import('./admin/pages/Products'));
const Settings     = React.lazy(() => import('./admin/pages/Settings'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f5f5f5', fontFamily: 'sans-serif', color: '#6b7280' }}>
      Memuat Halaman...
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Halaman Pelanggan */}
            <Route path="/" element={<App />} />

            {/* Kelompok Rute Admin (Untuk Mencegah Tabrakan Jalur) */}
            <Route path="/admin">
              {/* URL: /admin -> Render halaman login PIN */}
              <Route index element={<AdminLogin />} />

              {/* URL: /admin/orders, /admin/products, dsb (Terlindungi) */}
              <Route
                path="*"
                element={
                  <ProtectedRoute>
                    <AdminApp />
                  </ProtectedRoute>
                }
              >
                <Route index             element={<Navigate to="orders" replace />} />
                <Route path="orders"       element={<Orders />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="products"     element={<Products />} />
                <Route path="settings"     element={<Settings />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
