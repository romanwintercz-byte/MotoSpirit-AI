
import React from 'react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '../constants';

const AboutModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div 
                className="bg-[--color-surface] rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center border border-[--color-border]/30 overflow-hidden relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[--color-primary] to-[--color-accent]"></div>
                
                <div className="mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-[--color-primary] to-[--color-accent] rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg transform rotate-3">
                        <span className="text-4xl">💎</span>
                    </div>
                    <h2 className="text-3xl font-extrabold text-[--color-text-primary] tracking-tight leading-tight">{t('about.title')}</h2>
                </div>

                <div className="space-y-4 mb-8">
                    <p className="text-[--color-text-primary] text-sm leading-relaxed">
                        {t('about.body')}
                    </p>
                    <p className="text-[--color-accent] font-bold text-sm leading-relaxed italic">
                        {t('about.cta')}
                    </p>
                </div>

                {/* Developer Contact Section */}
                <div className="bg-black/20 p-4 rounded-2xl mb-8 border border-[--color-border]/20">
                    <p className="text-[--color-text-secondary] text-[10px] uppercase tracking-widest font-bold mb-2">
                        {t('about.contact')}
                    </p>
                    <a 
                        href="mailto:roman.winter.cz@gmail.com" 
                        className="text-[--color-primary] font-extrabold text-sm hover:underline transition-all"
                    >
                        roman.winter.cz@gmail.com
                    </a>
                </div>

                <div className="pt-6 border-t border-[--color-border]/30">
                    <p className="text-[--color-text-secondary] text-[10px] uppercase tracking-widest font-bold">
                        {t('about.version')} {APP_VERSION}
                    </p>
                </div>

                <button 
                    onClick={onClose} 
                    className="mt-8 w-full bg-[--color-surface-light] hover:bg-[--color-primary] hover:text-white text-[--color-text-primary] font-bold py-3 rounded-xl transition-all active:scale-95"
                >
                    {t('common.close')}
                </button>
            </div>
        </div>
    );
};

export default AboutModal;
