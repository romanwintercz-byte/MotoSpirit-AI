
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Theme, normalizeCommunityId } from '../hooks';
import { exportDataToFile, triggerHapticFeedback, urlBase64ToUint8Array } from '../utils';
import { AppDataHook } from '../hooks';
import { FullExportData } from '../types';
import { supabase } from '../supabaseClient';
import { VAPID_PUBLIC_KEY, SUPER_ADMIN_EMAILS } from '../constants';

const THEMES: { id: Theme; nameKey: string; color: string }[] = [
    { id: 'deep-teal', nameKey: 'themes.deepTeal', color: '#10b981' },
    { id: 'arctic-light', nameKey: 'themes.arcticLight', color: '#3b82f6' },
    { id: 'crimson-night', nameKey: 'themes.crimsonNight', color: '#dc2626' },
    { id: 'sunset-orange', nameKey: 'themes.sunsetOrange', color: '#f97316' },
    { id: 'cyber-violet', nameKey: 'themes.cyberViolet', color: '#a855f7' },
];

const SettingsModal: React.FC<{
    currentTheme: Theme;
    onThemeChange: (theme: Theme) => void;
    onClose: () => void;
    appData: AppDataHook;
    onOpenAdmin: () => void;
    onRestartTour: () => void;
}> = ({ currentTheme, onThemeChange, onClose, appData, onOpenAdmin, onRestartTour }) => {
    const { t, i18n } = useTranslation();
    const { communityId, setCommunityId, importBackup, refreshData, players, isLoading, dbStats, completedGamesLog, tournaments, fixMissingCommunityIds } = appData;

    const [importing, setImporting] = useState(false);
    const [localCommunityId, setLocalCommunityId] = useState(communityId);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeCommunity = normalizeCommunityId(communityId);
    const isSuperAdmin = userEmail ? SUPER_ADMIN_EMAILS.includes(userEmail) : false;

    useEffect(() => {
        // Fix: Cast supabase.auth to any to bypass type check errors
        (supabase.auth as any).getUser().then(({ data: { user } }: any) => {
            if (user) {
                setUserEmail(user.email || null);
                setCurrentUserId(user.id);
            }
        });

        // Kontrola stavu oznámení
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                registration.pushManager.getSubscription().then(subscription => {
                    setIsSubscribed(!!subscription);
                });
            });
        }
    }, []);

    const subscribeToPush = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        if (!currentUserId) return;

        try {
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedVapidKey
                });
            }

            if (subscription) {
                // Ukládáme subscription VČETNĚ community_id
                const { error } = await supabase.from('push_subscriptions').upsert({
                    user_id: currentUserId,
                    subscription: subscription,
                    community_id: activeCommunity
                });

                if (!error) {
                    setIsSubscribed(true);
                    triggerHapticFeedback([10, 30, 10]);
                    alert(t('lobby.notifications.subscribed'));
                }
            }
        } catch (error) {
            console.error('Failed to subscribe:', error);
            if (Notification.permission === 'denied') {
                alert(t('lobby.notifications.permissionDenied'));
            }
        }
    };

    const changeLanguage = (lng: string) => i18n.changeLanguage(lng);
    const currentLanguage = i18n.language || 'cs';

    const handleSaveCommunityId = () => {
        triggerHapticFeedback(50);
        setCommunityId(localCommunityId);
    };

    const handleForceSync = async () => {
        triggerHapticFeedback([50, 50]);
        await refreshData();
    };

    const handleBackup = () => {
        const exportObject: FullExportData = {
            type: 'ScoreCounterFullBackup',
            version: 1,
            exportedAt: new Date().toISOString(),
            data: { players: appData.players, stats: appData.stats, completedGamesLog: appData.completedGamesLog, tournaments: appData.tournaments },
        };
        exportDataToFile(exportObject, `win3-backup-${new Date().toISOString().split('T')[0]}.json`);
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const backupData = JSON.parse(content) as FullExportData;
                if (backupData.type !== 'ScoreCounterFullBackup') { alert(t('settings.import.invalidType')); return; }
                if (window.confirm(t('settings.import.confirm'))) {
                    setImporting(true);
                    await importBackup(backupData);
                    alert(t('settings.import.success'));
                }
            } catch (err) { alert(t('settings.import.error')); } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleSignOut = async () => {
        if (window.confirm('Opravdu se chcete odhlásit?')) {
            // Fix: Cast supabase.auth to any to bypass type check errors
            await (supabase.auth as any).signOut();
            window.location.reload();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[--color-surface] rounded-2xl shadow-2xl p-6 w-full max-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-[--color-accent] mb-6 text-center">{t('settings.title')}</h2>
                
                <div className="space-y-6">
                    {/* Admin Sekce */}
                    {isSuperAdmin && (
                        <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 p-4 rounded-xl border border-purple-500/30 space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-purple-300 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Administrativní správa
                                </h3>
                                <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded uppercase">Super Admin</span>
                            </div>
                            <button 
                                onClick={onOpenAdmin}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-purple-900/20 transition-all flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                                </svg>
                                Otevřít Admin Panel
                            </button>
                        </div>
                    )}

                    {/* Synchronizace Panel */}
                    <div className="bg-black/20 p-4 rounded-xl border border-[--color-border] space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-[--color-text-secondary]">Stav synchronizace</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isLoading ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
                                {isLoading ? 'Synchronizuji...' : 'Online'}
                            </span>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between text-[11px] bg-[--color-surface] p-2 rounded border border-[--color-border]/30">
                                <span className="text-[--color-text-secondary]">Hráči (v komunitě / v DB celkem):</span>
                                <span className="font-bold">{players.length} / <span className="text-[--color-accent]">{dbStats?.totalPlayersInDb || 0}</span></span>
                            </div>
                            <div className="flex justify-between text-[11px] bg-[--color-surface] p-2 rounded border border-[--color-border]/30">
                                <span className="text-[--color-text-secondary]">Zápasy (v komunitě / v DB celkem):</span>
                                <span className="font-bold">{completedGamesLog.length} / <span className="text-[--color-accent]">{dbStats?.totalLogsInDb || 0}</span></span>
                            </div>
                        </div>

                        <button 
                            onClick={handleForceSync}
                            className="w-full py-2 bg-[--color-surface-light] text-[--color-text-primary] text-xs font-bold rounded-lg border border-[--color-border] hover:bg-[--color-primary] transition-colors"
                        >
                            🔄 Obnovit data ze serveru
                        </button>
                    </div>

                    {/* Push Notifications Settings */}
                    <div className="bg-black/20 p-4 rounded-xl border border-[--color-border] space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-[--color-text-secondary]">Upozornění</h3>
                            <div className={`w-3 h-3 rounded-full ${isSubscribed ? 'bg-[--color-primary] shadow-[0_0_8px_var(--color-primary)]' : 'bg-gray-600'}`}></div>
                        </div>
                        <p className="text-[10px] text-[--color-text-secondary] leading-relaxed">
                            {isSubscribed ? 'Dostáváte upozornění na nové výzvy k zápasu v této herně.' : 'Zapněte upozornění, aby vám neutekla žádná nová výzva ke hře.'}
                        </p>
                        <button 
                            onClick={subscribeToPush}
                            disabled={isSubscribed}
                            className={`w-full py-3 flex items-center justify-center gap-2 rounded-lg font-bold text-sm transition-all ${isSubscribed ? 'bg-black/20 text-[--color-primary] border border-[--color-primary]/30' : 'bg-[--color-accent] text-black hover:scale-[1.02]'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={isSubscribed ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {isSubscribed ? t('lobby.notifications.enabled') : t('lobby.notifications.enable')}
                        </button>
                    </div>

                    {/* Community Settings */}
                    <div className="bg-[--color-surface-light]/30 p-4 rounded-xl border border-[--color-border]">
                        <p className="text-[--color-accent] font-bold mb-1">{t('settings.community')}</p>
                        <p className="text-[10px] text-[--color-text-secondary] mb-3">Změna ID přepne na jiný stůl/hernu.</p>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={localCommunityId} 
                                onChange={(e) => setLocalCommunityId(e.target.value)}
                                className="flex-1 bg-[--color-bg] text-[--color-text-primary] px-3 py-2 rounded border border-[--color-border] focus:outline-none focus:ring-2 focus:ring-[--color-accent]"
                                placeholder="default"
                            />
                            <button 
                                onClick={handleSaveCommunityId}
                                className="bg-[--color-primary] text-white px-4 py-2 rounded font-bold text-sm"
                            >
                                {t('save')}
                            </button>
                        </div>
                    </div>

                    {/* Theme & Language */}
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <p className="text-[--color-text-secondary] font-semibold mb-3">{t('settings.colorTheme')}</p>
                            <div className="grid grid-cols-5 gap-3">
                                {THEMES.map(theme => (
                                    <button key={theme.id} onClick={() => onThemeChange(theme.id)} className={`flex flex-col items-center gap-2 p-2 rounded-lg transition-all ${currentTheme === theme.id ? 'ring-2 ring-[--color-accent]' : ''}`}>
                                        <div className="w-10 h-10 rounded-full border-2 border-white/20" style={{ backgroundColor: theme.color }}></div>
                                        <span className="text-[10px] text-[--color-text-primary] text-center leading-tight">{t(theme.nameKey)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-[--color-text-secondary] font-semibold mb-3">{t('settings.language')}</p>
                            <div className="bg-[--color-surface-light] rounded-lg p-1 flex">
                                <button onClick={() => changeLanguage('cs')} className={`w-full px-3 py-2 text-sm font-semibold rounded-md ${currentLanguage.startsWith('cs') ? 'bg-[--color-primary] text-white' : 'text-[--color-text-primary]'}`}>Čeština</button>
                                <button onClick={() => changeLanguage('en')} className={`w-full px-3 py-2 text-sm font-semibold rounded-md ${currentLanguage.startsWith('en') ? 'bg-[--color-primary] text-white' : 'text-[--color-text-primary]'}`}>English</button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-[--color-border] space-y-4">
                        <button 
                            onClick={onRestartTour}
                            className="w-full py-3 bg-[--color-surface-light] text-[--color-text-primary] rounded-lg font-bold border border-[--color-border] flex items-center justify-center gap-2"
                        >
                            🎓 {t('settings.restartTour')}
                        </button>

                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-[--color-text-secondary] uppercase tracking-widest">{t('settings.dataManagement')}</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={handleBackup} className="py-3 bg-[--color-surface-light] text-[--color-text-primary] rounded-lg font-bold text-sm hover:bg-[--color-primary] transition-colors">
                                    📥 {t('export')}
                                </button>
                                <button 
                                    onClick={handleImportClick} 
                                    disabled={importing}
                                    className="py-3 bg-[--color-surface-light] text-[--color-text-primary] rounded-lg font-bold text-sm hover:bg-[--color-primary] transition-colors disabled:opacity-50"
                                >
                                    {importing ? '...' : `📤 ${t('import')}`}
                                </button>
                            </div>
                            <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-[--color-border] text-center">
                        <p className="text-[10px] text-[--color-text-secondary] mb-2">Přihlášen jako: <strong>{userEmail}</strong></p>
                        <button onClick={handleSignOut} className="w-full py-3 bg-red-900/10 text-red-400 rounded-lg font-bold hover:bg-red-900/20 transition-colors">
                            Odhlásit se
                        </button>
                    </div>
                </div>
                
                <button onClick={onClose} className="w-full bg-[--color-primary] text-white font-bold py-3 rounded-lg mt-8">{t('common.close')}</button>
            </div>
        </div>
    );
};

export default SettingsModal;
