
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MatchRequest, Player } from '../types';
import Avatar from './Avatar';
import { useMatchRequests, normalizeCommunityId } from '../hooks';
import CreateMatchModal from './CreateMatchModal';
import { supabase } from '../supabaseClient';
import { urlBase64ToUint8Array, triggerHapticFeedback } from '../utils';
import { VAPID_PUBLIC_KEY } from '../constants';

const MatchRequestCard: React.FC<{
    request: MatchRequest;
    allPlayers: Player[];
    currentUserId?: string;
    userPlayerIds: string[];
    onAccept: (reqId: string, playerId: string) => void;
    onCancel: (reqId: string) => void;
    onWithdraw: (reqId: string) => void;
    onStart: (req: MatchRequest) => void;
}> = ({ request, allPlayers, currentUserId, userPlayerIds, onAccept, onCancel, onWithdraw, onStart }) => {
    const { t } = useTranslation();
    const challenger = allPlayers.find(p => p.id === request.playerId);
    const opponent = request.acceptedByPlayerId ? allPlayers.find(p => p.id === request.acceptedByPlayerId) : null;
    const date = new Date(request.scheduledAt).toLocaleString();
    
    const isCreator = currentUserId && request.createdByUserId === currentUserId;
    const canWithdraw = !isCreator && request.acceptedByPlayerId && userPlayerIds.includes(request.acceptedByPlayerId);

    const [acceptAsId, setAcceptAsId] = useState(userPlayerIds[0] || '');

    if (!challenger) return null;

    const isPending = request.status === 'open';
    const isAccepted = request.status === 'accepted';

    const handleAcceptClick = () => {
        if (window.confirm(t('lobby.confirmAccept'))) {
            onAccept(request.id, acceptAsId);
        }
    };

    return (
        <div className={`rounded-xl p-4 shadow-md mb-4 border-l-4 transition-all ${isAccepted ? 'bg-[--color-surface] border-[--color-yellow]' : 'bg-[--color-surface-light] border-[--color-green]'} ${isCreator ? 'ring-1 ring-[--color-primary]/30' : ''}`}>
            <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-black/30 px-2 py-1 rounded text-[--color-accent] uppercase tracking-wider">{t(request.gameType as any)}</span>
                        {isCreator && <span className="text-[10px] font-bold text-[--color-primary] uppercase tracking-tighter bg-[--color-primary]/10 px-1.5 py-0.5 rounded border border-[--color-primary]/20">Tvoje výzva</span>}
                    </div>
                    <p className="text-sm font-semibold text-[--color-text-secondary] mt-1">{date}</p>
                </div>
                
                <div className="flex gap-2">
                    {isCreator && (
                        <button onClick={() => {
                            if(window.confirm(t('lobby.cancelConfirm'))) onCancel(request.id);
                        }} className="text-[--color-red] text-xs font-bold border border-[--color-red]/30 px-2 py-1 rounded hover:bg-[--color-red] hover:text-white transition-colors">{t('delete')}</button>
                    )}
                    {canWithdraw && (
                         <button onClick={() => {
                            if(window.confirm(t('lobby.withdrawConfirm'))) onWithdraw(request.id);
                        }} className="text-[--color-yellow] text-xs font-bold border border-[--color-yellow]/30 px-2 py-1 rounded hover:bg-[--color-yellow] hover:text-white transition-colors">{t('lobby.withdraw')}</button>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between my-3">
                <div className="flex flex-col items-center w-24">
                    <Avatar avatar={challenger.avatar} className="w-12 h-12 mb-1" />
                    <span className="text-xs font-bold truncate w-full text-center text-[--color-text-primary]">{challenger.name}</span>
                </div>
                
                <div className="flex flex-col items-center">
                    <span className="text-[--color-text-secondary] font-bold text-xl opacity-50">vs</span>
                </div>

                <div className="flex flex-col items-center w-24">
                    {opponent ? (
                        <>
                            <Avatar avatar={opponent.avatar} className="w-12 h-12 mb-1" />
                            <span className="text-xs font-bold truncate w-full text-center text-[--color-text-primary]">{opponent.name}</span>
                        </>
                    ) : (
                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-[--color-border] flex items-center justify-center mb-1 text-[--color-text-secondary] animate-pulse">
                            <span className="text-xl">?</span>
                        </div>
                    )}
                </div>
            </div>

            {request.note && <p className="text-xs text-[--color-text-secondary] italic text-center mb-3 px-4 py-2 bg-black/10 rounded-lg">"{request.note}"</p>}

            <div className="mt-2">
                {isAccepted && (isCreator || canWithdraw) && (
                    <button 
                        onClick={() => onStart(request)}
                        className="w-full bg-[--color-green] text-white font-bold py-3 rounded-xl shadow-lg animate-pulse active:scale-95 transition-transform"
                    >
                        {t('lobby.startGame')}
                    </button>
                )}

                {isPending && !isCreator && (
                    <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                        <label className="text-[10px] uppercase font-bold text-[--color-text-secondary] block mb-2">{t('lobby.selectOpponent')}</label>
                        <div className="flex gap-2">
                            <select 
                                value={acceptAsId} 
                                onChange={e => setAcceptAsId(e.target.value)}
                                className="flex-1 bg-[--color-surface] text-[--color-text-primary] text-sm rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:ring-1 focus:ring-[--color-primary]"
                            >
                                {allPlayers.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <button 
                                onClick={handleAcceptClick} 
                                className="bg-[--color-primary] text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md active:scale-95 transition-transform"
                            >
                                {t('lobby.accept')}
                            </button>
                        </div>
                    </div>
                )}

                {isPending && isCreator && (
                    <div className="text-center py-2 px-4 bg-black/20 rounded-lg border border-dashed border-white/10">
                        <p className="text-[10px] text-[--color-text-secondary] italic">Čeká se, až výzvu přijme někdo jiný...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const MatchSchedulingView: React.FC<{
    allPlayers: Player[];
    userPlayerIds: string[];
    currentUserId?: string;
    onStartGame: (p1Id: string, p2Id: string, gameType: string) => void;
}> = ({ allPlayers, userPlayerIds, currentUserId, onStartGame }) => {
    const { t } = useTranslation();
    const { requests, loading, createRequest, acceptRequest, cancelRequest, withdrawParticipation, completeRequest } = useMatchRequests();
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [notifState, setNotifState] = useState<'unsupported' | 'denied' | 'default' | 'granted'>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    const storedCommunity = localStorage.getItem('scoreCounter:communityId');
    const activeCommunity = normalizeCommunityId(storedCommunity ? JSON.parse(storedCommunity) : 'default');

    const checkSubscription = async () => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    const subscription = await registration.pushManager.getSubscription();
                    setIsSubscribed(!!subscription);
                    if (subscription) setNotifState('granted');
                }
            } catch (e) {
                console.error("Error checking subscription:", e);
            }
        }
    };

    useEffect(() => {
        const userAgent = window.navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(ios);
        
        // @ts-ignore
        const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
        setIsStandalone(standalone);

        if (!('Notification' in window)) {
            setNotifState('unsupported');
            return;
        }

        setNotifState(Notification.permission as any);
        checkSubscription();
    }, []);

    const subscribeToPush = async () => {
        if (notifState === 'unsupported') {
             alert("Váš prohlížeč nepodporuje Push notifikace.");
             return;
        }
        if (!currentUserId) return;

        triggerHapticFeedback(50);

        try {
            const permission = await Notification.requestPermission();
            setNotifState(permission as any);

            if (permission !== 'granted') {
                alert("Oznámení jsou blokována v nastavení prohlížeče.");
                return;
            }

            if (!('serviceWorker' in navigator)) {
                alert("Service Worker není dostupný.");
                return;
            }

            let registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                alert("Chyba: Service Worker se nenačetl. Zkuste prosím aplikaci obnovit.");
                return;
            }

            // Vždy zkusíme smazat starý, abychom vynutili čerstvý klíč (Force Reset)
            const existingSub = await registration.pushManager.getSubscription();
            if (existingSub) {
                await existingSub.unsubscribe();
            }

            if (!VAPID_PUBLIC_KEY) throw new Error("VAPID KEY MISSING");
            
            const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            if (subscription) {
                const { error } = await supabase.from('push_subscriptions').upsert({
                    user_id: currentUserId,
                    subscription: subscription,
                    community_id: activeCommunity
                });

                if (!error) {
                    setIsSubscribed(true);
                    triggerHapticFeedback([10, 30, 10]);
                    alert("Notifikace úspěšně nastaveny!");
                } else {
                    alert(`Chyba databáze: ${error.message}`);
                }
            }
        } catch (error: any) {
            console.error('Push registration error:', error);
            alert(`Chyba registrace: ${error.message || "Zkuste to prosím znovu."}`);
        }
    };

    const confirmedMatches = requests.filter(r => 
        r.status === 'accepted' && 
        (r.createdByUserId === currentUserId || (r.acceptedByPlayerId && userPlayerIds.includes(r.acceptedByPlayerId)))
    );

    const myPendingRequests = requests.filter(r => 
        r.status === 'open' && r.createdByUserId === currentUserId
    );

    const openChallenges = requests.filter(r => 
        r.status === 'open' && r.createdByUserId !== currentUserId
    );

    const handleStart = (req: MatchRequest) => {
        if (req.acceptedByPlayerId) {
            onStartGame(req.playerId, req.acceptedByPlayerId, req.gameType);
            completeRequest(req.id);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <div className="w-10 h-10 border-4 border-[--color-primary] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[--color-text-secondary] font-bold">Aktualizuji vývěsku...</p>
        </div>
    );

    return (
        <div className="w-full max-w-lg mx-auto p-4 pb-24">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-extrabold text-[--color-text-primary] tracking-tight">{t('lobby.title')}</h1>
                    {currentUserId && (
                        <button 
                            onClick={subscribeToPush}
                            className={`p-2 rounded-full transition-all ${isSubscribed ? 'text-[--color-accent] bg-[--color-accent]/10 shadow-[0_0_15px_var(--color-accent)] ring-2 ring-[--color-accent]/30' : (notifState === 'denied' ? 'text-red-500 bg-red-500/10' : 'text-[--color-text-secondary] opacity-50 hover:opacity-100 bg-white/5')}`}
                            title={isSubscribed ? "Notifikace jsou aktivní. Kliknutím vynutíte obnovení." : t('lobby.notifications.enable')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={isSubscribed ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </button>
                    )}
                </div>
                <button 
                    onClick={() => setCreateModalOpen(true)}
                    className="bg-[--color-accent] text-black font-extrabold py-2.5 px-5 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all"
                >
                    + {t('lobby.createChallenge')}
                </button>
            </div>

            {currentUserId && (!isSubscribed || notifState !== 'granted') && (
                <div className="mb-6 p-3 bg-black/20 border border-white/5 rounded-xl text-xs space-y-2">
                    <div className="flex justify-between items-center opacity-70">
                        <span>{t('lobby.notifications.status')}</span>
                        <span className={`font-bold ${notifState === 'granted' ? 'text-[--color-green]' : 'text-[--color-yellow]'}`}>
                            {notifState.toUpperCase()}
                        </span>
                    </div>
                    {isIOS && !isStandalone && (
                        <p className="text-orange-400 font-semibold">{t('lobby.notifications.iosWarning')}</p>
                    )}
                    {notifState === 'denied' && (
                        <p className="text-red-400 font-semibold">{t('lobby.notifications.permissionDenied')}</p>
                    )}
                    {!isSubscribed && notifState !== 'denied' && (
                        <button onClick={subscribeToPush} className="w-full py-2 bg-[--color-primary]/20 text-[--color-primary] rounded-lg font-bold border border-[--color-primary]/30">
                            {t('lobby.notifications.enable')}
                        </button>
                    )}
                </div>
            )}

            {confirmedMatches.length > 0 && (
                <div className="mb-10">
                    <h2 className="text-xs font-bold text-[--color-green] mb-4 flex items-center gap-2 uppercase tracking-widest bg-[--color-green]/10 w-max px-3 py-1 rounded-full border border-[--color-green]/20">
                        <span className="w-2 h-2 rounded-full bg-[--color-green] animate-pulse"></span>
                        {t('lobby.ready')}
                    </h2>
                    {confirmedMatches.map(req => (
                        <MatchRequestCard 
                            key={req.id} 
                            request={req} 
                            allPlayers={allPlayers} 
                            currentUserId={currentUserId}
                            userPlayerIds={userPlayerIds}
                            onAccept={acceptRequest}
                            onCancel={cancelRequest}
                            onWithdraw={withdrawParticipation}
                            onStart={handleStart}
                        />
                    ))}
                </div>
            )}

            <div className="mb-10">
                <h2 className="text-xs font-bold text-[--color-text-secondary] mb-4 uppercase tracking-widest opacity-60 ml-1">{t('lobby.waiting')}</h2>
                {myPendingRequests.length === 0 ? (
                    <div className="py-6 px-4 border-2 border-dashed border-white/5 rounded-2xl text-center">
                        <p className="text-[10px] text-[--color-text-secondary] uppercase tracking-tighter opacity-40 italic">Žádné tvoje otevřené výzvy</p>
                    </div>
                ) : (
                    myPendingRequests.map(req => (
                        <MatchRequestCard 
                            key={req.id} 
                            request={req} 
                            allPlayers={allPlayers} 
                            currentUserId={currentUserId}
                            userPlayerIds={userPlayerIds}
                            onAccept={acceptRequest}
                            onCancel={cancelRequest}
                            onWithdraw={withdrawParticipation}
                            onStart={handleStart}
                        />
                    ))
                )}
            </div>

            <h2 className="text-xs font-bold text-[--color-text-primary] mb-4 pt-6 border-t border-white/5 uppercase tracking-widest ml-1">{t('lobby.openChallenges')}</h2>
            {openChallenges.length === 0 ? (
                <div className="py-12 text-center bg-black/10 rounded-2xl border border-white/5">
                    <div className="text-3xl mb-2 opacity-20">🕳️</div>
                    <p className="text-sm text-[--color-text-secondary] font-medium">{t('lobby.noChallenges')}</p>
                </div>
            ) : (
                openChallenges.map(req => (
                    <MatchRequestCard 
                        key={req.id} 
                        request={req} 
                        allPlayers={allPlayers} 
                        currentUserId={currentUserId}
                        userPlayerIds={userPlayerIds}
                        onAccept={acceptRequest}
                        onCancel={cancelRequest}
                        onWithdraw={withdrawParticipation}
                        onStart={handleStart}
                    />
                ))
            )}

            {isCreateModalOpen && (
                <CreateMatchModal 
                    players={allPlayers}
                    onClose={() => setCreateModalOpen(false)}
                    onCreate={createRequest}
                />
            )}
        </div>
    );
};

export default MatchSchedulingView;
