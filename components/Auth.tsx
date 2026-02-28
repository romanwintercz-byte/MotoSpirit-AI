
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useTranslation } from 'react-i18next';

const Auth: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    // Detekce In-App prohlížečů (Seznam, Facebook, Instagram, atd.)
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isSeznam = /Seznam/i.test(ua) || /Szm/i.test(ua);
    const isFB = /FBAN|FBAV/i.test(ua);
    const isInsta = /Instagram/i.test(ua);
    
    // Na iOS Seznam používá WebView, který postrádá "Safari" v řetězci nebo má specifické flagy
    if (isSeznam || isFB || isInsta) {
        setIsInAppBrowser(true);
    }

    let timer: number;
    if (countdown > 0) {
      timer = window.setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (countdown > 0) return;

    setLoading(true);
    setMessage(null);

    try {
      // Fix: Cast supabase.auth to any to bypass type check errors
      const { error } = await (supabase.auth as any).signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        if (error.message.includes('rate limit')) {
          setMessage({ type: 'error', text: t('auth.errorLimit') });
        } else {
          setMessage({ type: 'error', text: error.message });
        }
      } else {
        setMessage({ type: 'success', text: t('auth.success') });
        setCountdown(60); 
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Něco se nepovedlo. Zkuste to později.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[--color-bg] p-4 text-[--color-text-primary]">
      
      {isInAppBrowser && (
        <div className="w-full max-w-md mb-4 p-4 bg-orange-500/20 border border-orange-500/50 rounded-2xl animate-pulse">
            <h3 className="text-orange-400 font-bold flex items-center gap-2">
                <span>⚠️</span> {t('auth.inAppBrowserTitle')}
            </h3>
            <p className="text-xs text-orange-200/80 mt-1 leading-relaxed">
                {t('auth.inAppBrowserDesc')}
            </p>
        </div>
      )}

      <div className="w-full max-w-md bg-[--color-surface] p-8 rounded-3xl shadow-2xl text-center border border-[--color-border]/30">
        <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-[--color-primary] to-[--color-accent] rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
                <span className="text-4xl">🏆</span>
            </div>
            <h1 className="text-3xl font-extrabold text-[--color-text-primary] tracking-tight">{t('auth.title')}</h1>
            <p className="text-[--color-text-secondary] mt-2 font-medium">{t('auth.subtitle')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <input
              className="w-full px-5 py-4 rounded-xl bg-[--color-bg] border border-[--color-border] text-[--color-text-primary] focus:outline-none focus:ring-2 focus:ring-[--color-primary] transition-all"
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || countdown > 0}
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-[--color-primary] hover:bg-[--color-primary-hover] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-[--color-primary]/20 disabled:opacity-50 active:scale-95"
            disabled={loading || countdown > 0}
          >
            {loading ? t('auth.sending') : countdown > 0 ? t('auth.resendIn', { seconds: countdown }) : t('auth.sendLink')}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-xl text-sm font-semibold border ${
            message.type === 'success' 
              ? 'bg-green-500/10 text-green-400 border-green-500/20' 
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          } animate-score-pop`}>
            {message.text}
            {message.type === 'success' && (
              <p className="mt-2 text-xs opacity-80 font-normal">
                {t('auth.checkSpam')}
              </p>
            )}
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-[--color-border]/30 text-left">
            <h3 className="text-sm font-bold text-[--color-accent] mb-2 flex items-center gap-2">
                <span>📧</span> {t('auth.noEmailTitle')}
            </h3>
            <p className="text-xs text-[--color-text-secondary] leading-relaxed">
                {t('auth.noEmailDesc')}
            </p>
        </div>
        
        <div className="mt-8 flex items-center justify-center gap-2 opacity-40">
            <div className="w-1.5 h-1.5 rounded-full bg-[--color-text-secondary]"></div>
            <p className="text-[10px] font-medium uppercase tracking-widest">{t('auth.cloudInfo')}</p>
            <div className="w-1.5 h-1.5 rounded-full bg-[--color-text-secondary]"></div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
