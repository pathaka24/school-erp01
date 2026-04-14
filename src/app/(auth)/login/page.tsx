'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Mail, Lock, Eye, EyeOff, GraduationCap, Loader2, Copy, Check } from 'lucide-react';
import gsap from 'gsap';

const DEMO_CREDENTIALS = [
  { role: 'Admin', email: 'admin@school.com', password: 'password123' },
  { role: 'Teacher', email: 'teacher1@school.com', password: 'password123' },
  { role: 'Parent', email: 'parent@school.com', password: 'password123' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const emailFieldRef = useRef<HTMLDivElement>(null);
  const passwordFieldRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const demoRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Set initial states
      gsap.set(logoRef.current, { scale: 0, opacity: 0 });
      gsap.set(cardRef.current, { y: 80, opacity: 0 });
      gsap.set([emailFieldRef.current, passwordFieldRef.current], { x: -60, opacity: 0 });
      gsap.set(buttonRef.current, { scale: 0.5, opacity: 0 });
      gsap.set(demoRef.current, { y: 20, opacity: 0 });

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Animate floating circles
      if (floatingRef.current) {
        const circles = floatingRef.current.querySelectorAll('.floating-circle');
        circles.forEach((circle, i) => {
          gsap.to(circle, {
            y: `random(-30, 30)`,
            x: `random(-20, 20)`,
            duration: `random(3, 5)`,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: i * 0.5,
          });
        });
      }

      // Logo: scale up with elastic ease
      tl.to(logoRef.current, {
        scale: 1,
        opacity: 1,
        duration: 1,
        ease: 'elastic.out(1, 0.5)',
      });

      // Card: slide up from bottom with fade
      tl.to(cardRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
      }, '-=0.5');

      // Input fields: stagger in from left
      tl.to([emailFieldRef.current, passwordFieldRef.current], {
        x: 0,
        opacity: 1,
        duration: 0.6,
        stagger: 0.15,
        ease: 'power2.out',
      }, '-=0.4');

      // Login button: pop in last
      tl.to(buttonRef.current, {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: 'back.out(1.7)',
      }, '-=0.2');

      // Demo credentials fade in
      tl.to(demoRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out',
      }, '-=0.2');
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.user, data.token);
      const dest = data.user.role === 'TEACHER' ? '/teacher/dashboard' : data.user.role === 'PARENT' ? '/parent' : '/dashboard';
      router.push(dest);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
      // Shake the card on error
      if (cardRef.current) {
        gsap.fromTo(cardRef.current,
          { x: -10 },
          { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' }
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (index: number) => {
    setEmail(DEMO_CREDENTIALS[index].email);
    setPassword(DEMO_CREDENTIALS[index].password);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8"
      style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #1e3a8a 40%, #1e40af 70%, #2563eb 100%)',
      }}
    >
      {/* Floating decorative circles */}
      <div ref={floatingRef} className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="floating-circle absolute top-[10%] left-[15%] w-72 h-72 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #60a5fa, transparent)' }}
        />
        <div
          className="floating-circle absolute top-[60%] right-[10%] w-96 h-96 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent)' }}
        />
        <div
          className="floating-circle absolute bottom-[10%] left-[40%] w-64 h-64 rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }}
        />
        <div
          className="floating-circle absolute top-[30%] right-[30%] w-48 h-48 rounded-full opacity-[0.08]"
          style={{ background: 'radial-gradient(circle, #38bdf8, transparent)' }}
        />
        <div
          className="floating-circle absolute bottom-[30%] left-[5%] w-56 h-56 rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent)' }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo / School Name */}
        <div ref={logoRef} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5 shadow-lg shadow-blue-500/20"
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            }}
          >
            <GraduationCap className="h-10 w-10 text-white" strokeWidth={1.8} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide leading-snug">
            PATHAK EDUCATIONAL<br />FOUNDATION SCHOOL
          </h1>
          <div className="inline-flex items-center mt-3 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider"
            style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              color: '#93c5fd',
              border: '1px solid rgba(147,197,253,0.2)',
            }}
          >
            ACADEMIC YEAR 2025 - 2026
          </div>
        </div>

        {/* Glass card */}
        <div
          ref={cardRef}
          className="rounded-3xl p-8 shadow-2xl"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-white">Welcome Back</h2>
            <p className="text-blue-200/70 text-sm mt-1">Sign in to your account</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl text-sm font-medium flex items-center gap-2"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
              }}
            >
              <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div ref={emailFieldRef}>
              <label className="block text-sm font-medium text-blue-200/80 mb-2">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-300/50 group-focus-within:text-blue-300 transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl text-white placeholder:text-blue-300/30 outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(96, 165, 250, 0.5)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="admin@school.com"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div ref={passwordFieldRef}>
              <label className="block text-sm font-medium text-blue-200/80 mb-2">
                Password
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-300/50 group-focus-within:text-blue-300 transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 rounded-xl text-white placeholder:text-blue-300/30 outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(96, 165, 250, 0.5)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-300/40 hover:text-blue-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              ref={buttonRef}
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 relative overflow-hidden group"
              style={{
                background: loading
                  ? 'linear-gradient(135deg, #4b5563, #6b7280)'
                  : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                boxShadow: loading
                  ? 'none'
                  : '0 4px 15px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              {!loading && (
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                  }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </span>
            </button>
          </form>

          {/* Demo credentials */}
          <div ref={demoRef} className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs text-blue-300/40 text-center mb-3 uppercase tracking-wider font-medium">
              Demo Credentials
            </p>
            <div className="space-y-2">
              {DEMO_CREDENTIALS.map((cred, i) => (
                <button
                  key={cred.role}
                  type="button"
                  onClick={() => fillCredentials(i)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left transition-all duration-200 cursor-pointer group/demo"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{
                        background: i === 0
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'rgba(168, 85, 247, 0.2)',
                        color: i === 0 ? '#93c5fd' : '#c4b5fd',
                      }}
                    >
                      {cred.role[0]}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-blue-100/80">{cred.role}</div>
                      <div className="text-[11px] text-blue-300/40">{cred.email}</div>
                    </div>
                  </div>
                  <div className="text-blue-300/30 group-hover/demo:text-blue-200/60 transition-colors">
                    {copiedIndex === i ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-blue-300/25 text-xs mt-6">
          Pathak Educational Foundation School &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
