import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Delete, ShieldCheck } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState('');
  const [shake, setShake]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Kalau sudah login & sesi masih valid, langsung masuk
  useEffect(() => {
    const token  = localStorage.getItem('mh_admin_token');
    const expiry = localStorage.getItem('mh_admin_expiry');
    if (token && expiry && Date.now() < parseInt(expiry)) {
      navigate('/admin/orders', { replace: true });
    }
  }, [navigate]);

  const handleNumber = (num: string) => {
    if (pin.length >= 6 || isVerifying) return;
    const next = pin + num;
    setPin(next);
    setError('');
    if (next.length === 6) setTimeout(() => verifyPin(next), 150);
  };

  const handleDelete = () => {
    if (isVerifying) return;
    setPin(p => p.slice(0, -1));
    setError('');
  };

  // Validasi PIN ke backend — server yang cek, bukan browser
  const verifyPin = async (inputPin: string) => {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: inputPin }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'PIN salah.');
      }

      // Server mengembalikan token asli + waktu kadaluarsa
      setSuccess(true);
      localStorage.setItem('mh_admin_token', data.token);
      localStorage.setItem('mh_admin_expiry', new Date(data.expiresAt).getTime().toString());

      setTimeout(() => navigate('/admin/orders', { replace: true }), 800);
    } catch (err: any) {
      setShake(true);
      setError(err.message || 'PIN salah. Coba lagi.');
      setPin('');
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsVerifying(false);
    }
  };

  const keys = ['1','2','3','4','5','6','7','8','9','','0','del'];

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, overflow: 'hidden', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', background: '#000' }}>
            <img src="/logo-mamahemat.png" alt="Mamah Hemat Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>Mamah Hemat</h1>
          <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: 4 }}>Admin Panel · Masukkan PIN</p>
        </div>

        {/* PIN Dots */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 12, marginBottom: '2rem',
          animation: shake ? 'shake 0.4s ease-in-out' : 'none'
        }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: '50%', border: '2px solid',
              borderColor: i < pin.length ? (success ? '#10B981' : '#F59E0B') : '#D1D5DB',
              background: i < pin.length ? (success ? '#10B981' : '#F59E0B') : 'transparent',
              transition: 'all 0.15s',
              transform: i < pin.length ? 'scale(1.1)' : 'scale(1)',
            }} />
          ))}
        </div>

        {/* Feedback */}
        {isVerifying && !success && (
          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: '0.875rem', marginBottom: '1rem' }}>Memverifikasi...</p>
        )}
        {error && (
          <p style={{ textAlign: 'center', color: '#EF4444', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
        )}
        {success && (
          <p style={{ textAlign: 'center', color: '#10B981', fontSize: '0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ShieldCheck style={{ width: 16, height: 16 }} /> Selamat datang, Admin!
          </p>
        )}

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {keys.map((key, i) => {
            if (key === '') return <div key={i} />;
            if (key === 'del') return (
              <button key={i} onClick={handleDelete} disabled={isVerifying} style={{
                height: 64, borderRadius: 12, background: '#F3F4F6', border: '1px solid #E5E7EB',
                color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isVerifying ? 'not-allowed' : 'pointer', fontSize: '1.25rem', transition: 'all 0.1s',
                opacity: isVerifying ? 0.5 : 1,
              }}>
                <Delete style={{ width: 20, height: 20 }} />
              </button>
            );
            return (
              <button key={i} onClick={() => handleNumber(key)} disabled={success || isVerifying} style={{
                height: 64, borderRadius: 12, background: '#F9FAFB', border: '1px solid #E5E7EB',
                color: '#111827', fontSize: '1.25rem', fontWeight: 600,
                cursor: (success || isVerifying) ? 'not-allowed' : 'pointer',
                transition: 'all 0.1s', opacity: (success || isVerifying) ? 0.5 : 1,
              }}>
                {key}
              </button>
            );
          })}
        </div>

      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
