
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminData } from '../hooks';
import { triggerHapticFeedback } from '../utils';
import { supabase } from '../supabaseClient';

const AdminPanel: React.FC<{ onExit: () => void }> = ({ onExit }) => {
    const { t } = useTranslation();
    const { users, allPlayers, communityStats, loading, refresh } = useAdminData();
    const [activeTab, setActiveTab] = useState<'users' | 'communities' | 'push'>('users');
    const [pushSubsCount, setPushSubsCount] = useState(0);
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [testResult, setTestResult] = useState<{success: boolean, msg: string} | null>(null);
    
    // Diagnostika URL
    // @ts-ignore
    const isPlaceholder = supabase.supabaseUrl.includes('placeholder');
    // @ts-ignore
    const currentSupabaseUrl = supabase.supabaseUrl;

    useEffect(() => {
        if (!isPlaceholder) {
            refresh();
            fetchPushCount();
        }
    }, [refresh, isPlaceholder]);

    const fetchPushCount = async () => {
        try {
            const { count } = await supabase.from('push_subscriptions').select('id', { count: 'exact', head: true });
            if (count !== null) setPushSubsCount(count);
        } catch (e) {
            console.warn("Could not fetch push count", e);
        }
    };

    const handleRefresh = () => {
        triggerHapticFeedback(50);
        refresh();
        fetchPushCount();
    };

    const handleSendTestPush = async () => {
        setIsSendingTest(true);
        setTestResult(null);
        triggerHapticFeedback(50);

        try {
            const { data: { user } } = await (supabase.auth as any).getUser();
            if (!user) throw new Error("Nejste přihlášeni k účtu.");

            console.log("Calling edge function 'notify-challenge'...");
            
            const { data, error } = await (supabase as any).functions.invoke('notify-challenge', {
                body: { 
                    type: 'test',
                    user_id: user.id,
                    title: 'Test Win3 Carom Pro',
                    body: 'Pokud toto vidíte, notifikace fungují správně! 🎉'
                }
            });

            if (error) {
                console.error("SDK Error:", error);
                throw new Error(error.message || "Chyba při komunikaci s Edge funkcí. Je funkce nasazená?");
            }
            
            if (data?.error) throw new Error(data.error);

            setTestResult({ 
                success: true, 
                msg: data?.sent > 0 
                    ? `Úspěch! Odesláno na ${data.sent} vašich zařízení.` 
                    : "Funkce proběhla, ale nemáte žádný aktivní odběr na tomto účtu. Klikněte nejdříve na zvoneček na Vývěsce." 
            });
        } catch (err: any) {
            console.error("Test Notification Error:", err);
            setTestResult({ 
                success: false, 
                msg: err.message || "Nepodařilo se odeslat požadavek. Zkontrolujte připojení."
            });
        } finally {
            setIsSendingTest(false);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '---';
        return new Date(dateStr).toLocaleString('cs-CZ', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="w-full max-w-5xl p-4 pb-24 space-y-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-[--color-text-primary] flex items-center gap-3">
                        <span className="text-purple-500">🛡️</span> Admin Panel
                    </h1>
                    <p className="text-xs text-[--color-text-secondary] uppercase tracking-widest font-bold mt-1">Globální správa aplikace</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleRefresh}
                        className="p-2 bg-[--color-surface-light] rounded-lg text-[--color-text-secondary] hover:text-white transition-colors"
                        disabled={loading || isPlaceholder}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    <button 
                        onClick={onExit}
                        className="bg-[--color-surface-light] text-[--color-text-primary] px-4 py-2 rounded-lg font-bold shadow-md"
                    >
                        {t('common.back')}
                    </button>
                </div>
            </div>

            {/* Varování o konfiguraci */}
            {isPlaceholder && (
                <div className="bg-red-500/20 border-2 border-red-500 p-6 rounded-2xl text-center space-y-4">
                    <p className="text-xl font-bold text-red-400">⚠️ Supabase není připojen!</p>
                    <p className="text-sm text-red-200 opacity-80">
                        V souboru <code>supabaseClient.ts</code> jsou stále výchozí hodnoty (placeholder). 
                        Aby notifikace a cloud fungovaly, musíte nastavit <code>VITE_SUPABASE_URL</code> a <code>VITE_SUPABASE_ANON_KEY</code>.
                    </p>
                    <div className="bg-black/30 p-2 rounded font-mono text-[10px] break-all">
                        Aktuální URL: {currentSupabaseUrl}
                    </div>
                </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 p-4 rounded-xl border border-blue-500/20 shadow-lg">
                    <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-1">Registrovaní uživatelé</p>
                    <p className="text-4xl font-extrabold text-white font-mono">{users.length}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/40 p-4 rounded-xl border border-emerald-500/20 shadow-lg">
                    <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1">Aktivní komunity</p>
                    <p className="text-4xl font-extrabold text-white font-mono">{communityStats.length}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 p-4 rounded-xl border border-purple-500/20 shadow-lg col-span-2 md:col-span-1">
                    <p className="text-[10px] font-bold text-purple-300 uppercase tracking-widest mb-1">Zařízení s notifikacemi</p>
                    <p className="text-4xl font-extrabold text-white font-mono">{pushSubsCount}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-[--color-surface-light] p-1 rounded-xl w-max overflow-x-auto no-scrollbar">
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-[--color-primary] text-white shadow-md' : 'text-[--color-text-secondary] hover:text-white'}`}
                >
                    👤 Uživatelé
                </button>
                <button 
                    onClick={() => setActiveTab('communities')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'communities' ? 'bg-[--color-primary] text-white shadow-md' : 'text-[--color-text-secondary] hover:text-white'}`}
                >
                    🏟️ Komunity
                </button>
                <button 
                    onClick={() => setActiveTab('push')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'push' ? 'bg-[--color-primary] text-white shadow-md' : 'text-[--color-text-secondary] hover:text-white'}`}
                >
                    🔔 Debug Push
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-[--color-surface] rounded-2xl shadow-2xl border border-[--color-border]/50 overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center h-full py-20">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-[--color-primary] border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[--color-text-secondary] font-bold animate-pulse">Načítám globální data...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {activeTab === 'users' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-black/20 text-[--color-text-secondary] uppercase text-[10px] tracking-widest font-bold">
                                        <tr>
                                            <th className="p-4">Email</th>
                                            <th className="p-4">Hráči (Profily)</th>
                                            <th className="p-4">Komunity</th>
                                            <th className="p-4">Aktivita</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[--color-border]/30">
                                        {users.map(u => {
                                            const userPlayers = allPlayers.filter(p => p.createdByUserId === u.id || p.ownerId === u.id);
                                            const playerNames = userPlayers.map(p => p.name);
                                            const uniqueComms = Array.from(new Set(userPlayers.map(p => p.communityId || 'default')));

                                            return (
                                                <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-4">
                                                        <p className="font-bold text-[--color-text-primary] text-sm">{u.email}</p>
                                                        <p className="text-[9px] text-[--color-text-secondary] opacity-60 font-mono">{u.id}</p>
                                                    </td>
                                                    <td className="p-4">
                                                        {playerNames.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {playerNames.map((name, idx) => (
                                                                    <span key={idx} className="text-xs text-[--color-text-primary] bg-black/30 px-2 py-0.5 rounded border border-white/10">
                                                                        {name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-[--color-text-secondary] italic opacity-40">Žádní hráči</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        {uniqueComms.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {uniqueComms.map((comm, idx) => (
                                                                    <span key={idx} className="text-[10px] font-bold text-[--color-accent] uppercase tracking-tighter">
                                                                        #{comm}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-[--color-text-secondary] italic opacity-40">---</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-[--color-text-secondary] font-mono text-xs whitespace-nowrap">
                                                        {formatDate(u.last_activity)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'communities' && (
                            <table className="w-full text-left">
                                <thead className="bg-black/20 text-[--color-text-secondary] uppercase text-[10px] tracking-widest font-bold">
                                    <tr>
                                        <th className="p-4">ID Komunity</th>
                                        <th className="p-4">Počet hráčů</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[--color-border]/30">
                                    {communityStats.map(c => (
                                        <tr key={c.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4">
                                                <span className="bg-black/40 px-3 py-1 rounded font-mono text-sm text-[--color-accent] border border-[--color-accent]/20">
                                                    {c.id}
                                                </span>
                                            </td>
                                            <td className="p-4 font-bold text-[--color-text-primary]">{c.playerCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'push' && (
                            <div className="p-8 text-center space-y-6">
                                <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto">
                                    <span className="text-4xl">🧪</span>
                                </div>
                                <h3 className="text-xl font-bold text-white">Testování doručitelnosti</h3>
                                <p className="text-[--color-text-secondary] max-w-md mx-auto text-sm">
                                    Tímto tlačítkem zkusíte poslat notifikaci <strong>přímo sobě</strong> na všechna vaše zařízení, kde jste v tomto prohlížeči klikli na zvoneček.
                                </p>

                                <div className="flex flex-col items-center gap-4">
                                    <button 
                                        onClick={handleSendTestPush}
                                        disabled={isSendingTest || isPlaceholder}
                                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                                    >
                                        {isSendingTest ? 'Odesílám test...' : 'Odeslat TEST na můj mobil'}
                                    </button>

                                    {testResult && (
                                        <div className={`p-4 rounded-xl text-sm font-bold border ${testResult.success ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'} animate-score-pop`}>
                                            {testResult.msg}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-black/40 p-4 rounded-xl text-left font-mono text-[10px] text-purple-300 border border-purple-500/20 mt-10">
                                    <p className="mb-2 font-bold opacity-50 uppercase tracking-widest text-center border-b border-purple-500/20 pb-2">Kontrolní seznam při potížích</p>
                                    <ul className="list-disc pl-4 space-y-1 mt-2">
                                        <li><strong>Klíče:</strong> Jsou v <code>supabaseClient.ts</code> reálné klíče ze Supabase Dashboardu?</li>
                                        <li><strong>Nasazení:</strong> Byla funkce nasazena (<code>supabase functions deploy notify-challenge</code>)?</li>
                                        <li><strong>VAPID:</strong> Jsou v Supabase nastaveny environment proměnné (CAROM_VAPID_...)?</li>
                                        <li><strong>Odběr:</strong> Máte na Vývěsce zvoneček v barvě tyrkysové?</li>
                                        <li><strong>Povolená oznámení:</strong> Povolil prohlížeč i systém Android/iOS zasílání zpráv?</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;
