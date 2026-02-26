
import React, { useState } from 'react';
import { AppLogoIcon, LockClosedIcon, UserCircleIcon } from './icons';

interface LoginPageProps {
  onLogin: (email: string, pass: string) => Promise<void>;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err as string);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="w-full max-w-[440px] bg-white border border-border/50 rounded-[40px] shadow-soft-xl overflow-hidden animate-in fade-in zoom-in-95 duration-1000 relative z-10">
        <div className="p-10 pb-4 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-[28px] flex items-center justify-center text-primary shadow-soft-sm mb-6 border-2 border-primary/20">
            <AppLogoIcon className="w-12 h-12" />
          </div>
          <h1 className="text-[32px] font-black font-heading text-foreground tracking-tighter leading-none mb-2">MIXER</h1>
          <p className="text-[13px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">Hệ thống Quản trị Bán hàng</p>
        </div>

        <div className="p-10 pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-status-danger/5 border border-status-danger/20 rounded-2xl flex items-center gap-3 animate-in shake-sm">
                <div className="w-2 h-2 rounded-full bg-status-danger"></div>
                <p className="text-status-danger text-[13px] font-black">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Email Tài khoản</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <UserCircleIcon className="h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-muted/20 border border-border/50 rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-[15px] font-bold outline-none shadow-soft-sm placeholder:text-muted-foreground/20"
                  placeholder="admin@mixer.com"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Mật khẩu</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-muted/20 border border-border/50 rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-[15px] font-bold outline-none shadow-soft-sm placeholder:text-muted-foreground/20"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-primary hover:bg-primary-dark text-white rounded-2xl font-black text-[16px] shadow-soft-lg active:scale-95 disabled:opacity-50 transition-all border-b-4 border-primary-dark/30 flex items-center justify-center gap-3 group"
            >
              {isLoading ? (
                <svg className="animate-spin h-6 w-6 text-white/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  <span>Đăng nhập ngay</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-border/30 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/30 rounded-full border border-border/50">
              <div className="w-1.5 h-1.5 bg-status-info rounded-full animate-pulse"></div>
              <p className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-widest">
                Demo: <span className="text-foreground">admin@mixer.com</span> / <span className="text-foreground">admin</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

  );
};

export default LoginPage;
