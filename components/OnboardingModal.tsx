
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  color: string;
}

const OnboardingModal: React.FC<{
    onAdd: () => void;
    onClose: () => void;
}> = ({ onAdd, onClose }) => {
    const { t } = useTranslation();
    const [currentStep, setCurrentStep] = useState(0);

    const steps: OnboardingStep[] = [
        {
            title: t('onboarding.welcome.title'),
            description: t('onboarding.welcome.desc'),
            icon: '🏆',
            color: 'from-teal-500/20 to-emerald-500/20'
        },
        {
            title: t('onboarding.cloud.title'),
            description: t('onboarding.cloud.desc'),
            icon: '☁️',
            color: 'from-blue-500/20 to-cyan-500/20'
        },
        {
            title: t('onboarding.spectator.title'),
            description: t('onboarding.spectator.desc'),
            icon: '📺',
            color: 'from-red-500/20 to-orange-500/20'
        },
        {
            title: t('onboarding.stats.title'),
            description: t('onboarding.stats.desc'),
            icon: '📈',
            color: 'from-purple-500/20 to-pink-500/20'
        },
        {
            title: t('onboarding.lobby.title'),
            description: t('onboarding.lobby.desc'),
            icon: '🏟️',
            color: 'from-amber-500/20 to-yellow-500/20'
        }
    ];

    const isLastStep = currentStep === steps.length;

    const nextStep = () => {
        if (currentStep < steps.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div 
                className="bg-[--color-surface] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all duration-500 flex flex-col border border-[--color-border]/30"
                onClick={e => e.stopPropagation()}
            >
                {!isLastStep ? (
                    <>
                        <div className={`p-12 text-center bg-gradient-to-br ${steps[currentStep].color} transition-colors duration-500`}>
                            <div className="text-8xl mb-6 animate-bounce">{steps[currentStep].icon}</div>
                            <h2 className="text-3xl font-extrabold text-[--color-accent] mb-4 leading-tight">
                                {steps[currentStep].title}
                            </h2>
                            <p className="text-[--color-text-primary] text-lg leading-relaxed opacity-90">
                                {steps[currentStep].description}
                            </p>
                        </div>
                        
                        <div className="p-6 flex flex-col gap-4">
                            <div className="flex justify-center gap-2 mb-4">
                                {steps.map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={`h-2 rounded-full transition-all duration-300 ${currentStep === i ? 'w-8 bg-[--color-primary]' : 'w-2 bg-[--color-border]'}`}
                                    />
                                ))}
                            </div>
                            
                            <div className="flex gap-3">
                                {currentStep > 0 && (
                                    <button 
                                        onClick={prevStep}
                                        className="flex-1 py-4 px-6 rounded-2xl bg-[--color-surface-light] text-[--color-text-primary] font-bold transition-transform active:scale-95"
                                    >
                                        {t('common.back')}
                                    </button>
                                )}
                                <button 
                                    onClick={nextStep}
                                    className="flex-[2] py-4 px-6 rounded-2xl bg-[--color-primary] text-white font-bold shadow-lg shadow-emerald-900/20 transition-transform active:scale-95"
                                >
                                    {t('common.continue')}
                                </button>
                            </div>
                            <button onClick={onClose} className="text-[--color-text-secondary] text-sm font-medium hover:text-[--color-text-primary] py-2 transition-colors">
                                {t('common.skip')}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center">
                        <div className="text-6xl mb-6">🚀</div>
                        <h2 className="text-3xl font-extrabold text-[--color-accent] mb-2">{t('onboarding.final.title')}</h2>
                        <p className="text-[--color-text-secondary] mb-8">{t('onboarding.final.desc')}</p>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={onAdd}
                                className="w-full text-left p-5 bg-[--color-primary] rounded-2xl flex items-center gap-4 group transition-all"
                            >
                                <div className="text-3xl bg-white/20 p-2 rounded-lg">👤</div>
                                <div>
                                    <h3 className="font-bold text-white">{t('firstTime.add')}</h3>
                                    <p className="text-white/80 text-sm">{t('firstTime.addSubtext')}</p>
                                </div>
                            </button>
                        </div>
                        <button onClick={onClose} className="mt-8 text-[--color-primary] font-bold uppercase tracking-widest text-sm hover:underline">
                            {t('common.close')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnboardingModal;
