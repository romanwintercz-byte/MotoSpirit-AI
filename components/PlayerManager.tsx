
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Player } from '../types';
import Avatar from './Avatar';
import { AppDataHook } from '../hooks';
import { SUPER_ADMIN_EMAILS } from '../constants';
import { triggerHapticFeedback } from '../utils';

const PlayerInfoCard: React.FC<{
    player: Player;
    onEdit: () => void;
    onDelete: () => void;
    onViewStats: () => void;
    canManage: boolean;
    currentUserId?: string;
}> = ({ player, onEdit, onDelete, onViewStats, canManage, currentUserId }) => {
    const { t } = useTranslation();
    const isSample = player.id.startsWith('sample-');
    const isClaimedByOthers = player.ownerId && player.ownerId !== currentUserId;
    const isLinkedNotClaimed = player.linkedEmail && !player.ownerId;
    const isMyProfile = player.ownerId === currentUserId;

    const handleShareInvite = (e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHapticFeedback(30);
        
        const inviteText = t('claiming.inviteText', { 
            name: player.name, 
            email: player.linkedEmail, 
            url: window.location.origin 
        });

        if (navigator.share) {
            navigator.share({
                title: 'Win3 Carom Pro Invite',
                text: inviteText,
                url: window.location.origin
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(inviteText);
            alert(t('common.copied'));
        }
    };
    
    return (
        <div className={`bg-[--color-surface] rounded-xl p-3 flex flex-col items-center text-center shadow-md border border-[--color-border]/20 active:scale-95 transition-transform duration-150 relative ${isSample ? 'opacity-80 grayscale-[0.3]' : ''}`}>
            {isSample && <span className="absolute top-1 left-1 text-[10px] bg-[--color-yellow]/20 text-[--color-yellow] px-1.5 rounded uppercase font-bold">Demo</span>}
            
            {/* Status Badges */}
            <div className="absolute top-1 right-1 flex gap-1 items-center">
                {isMyProfile && <span className="text-[10px] bg-[--color-green] text-black w-4 h-4 rounded-full flex items-center justify-center font-bold" title="Můj profil">★</span>}
                {isClaimedByOthers && <span className="text-[10px] bg-[--color-accent] text-black w-4 h-4 rounded-full flex items-center justify-center" title="Převzato majitelem">🔒</span>}
                {isLinkedNotClaimed && (
                    <div className="flex gap-1 items-center">
                        <button 
                            onClick={handleShareInvite}
                            className="bg-blue-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter hover:bg-blue-500 flex items-center gap-1 shadow-lg"
                        >
                            <span>POSLAT ECHO</span>
                            <span className="animate-pulse">✉</span>
                        </button>
                    </div>
                )}
            </div>

            <button onClick={onViewStats} className="w-full flex flex-col items-center focus:outline-none">
                <div className={`relative ${isMyProfile ? 'ring-2 ring-[--color-green] ring-offset-2 ring-offset-[--color-surface] rounded-full' : ''}`}>
                    <Avatar avatar={player.avatar} className="w-16 h-16 mb-2" />
                </div>
                <p className={`text-[--color-text-primary] text-base font-bold truncate w-full ${isSample ? 'italic font-medium' : ''}`}>{player.name}</p>
            </button>
            <div className="flex gap-4 mt-2 w-full justify-center border-t border-[--color-border]/30 pt-2 h-8">
                {canManage ? (
                    <>
                        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-[--color-accent] p-1 text-xs uppercase font-bold tracking-wide hover:underline">{t('edit')}</button>
                        {!isMyProfile && <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-[--color-red] p-1 text-xs uppercase font-bold tracking-wide hover:underline">{t('delete')}</button>}
                    </>
                ) : (
                    <span className="text-[--color-text-secondary] text-[10px] italic pt-1 opacity-50">
                        {isClaimedByOthers ? 'Vlastněno hráčem' : 'Jen pro čtení'}
                    </span>
                )}
            </div>
        </div>
    )
}

const PlayerManager: React.FC<{
    players: Player[];
    onAddPlayer: () => void;
    onEditPlayer: (player: Player) => void;
    onDeletePlayer: (id: string) => void;
    onViewPlayerStats: (player: Player) => void;
    appData: AppDataHook;
    session: any | null;
}> = ({ players, onAddPlayer, onEditPlayer, onDeletePlayer, onViewPlayerStats, session }) => {
    const { t } = useTranslation();

    const currentUserEmail = session?.user?.email;
    const currentUserId = session?.user?.id;
    const isSuperAdmin = currentUserEmail ? SUPER_ADMIN_EMAILS.includes(currentUserEmail) : false;

    const handleDelete = (player: Player) => {
        if (window.confirm(t('confirmDelete', { name: player.name }) as string)) {
            onDeletePlayer(player.id);
        }
    }

    return (
        <div className="w-full px-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-extrabold text-[--color-text-primary]">{t('managePlayers')}</h1>
                <button onClick={onAddPlayer} className="bg-[--color-green] text-white font-bold py-2 px-4 rounded-lg shadow-md flex items-center gap-1">
                    <span>+</span> {t('addPlayer')}
                </button>
            </div>

            {players.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {players.map(player => {
                        // Majitel (ownerId) má vždy práva, tvůrce (createdByUserId) jen dokud není nastaven ownerId
                        const isOwner = player.ownerId === currentUserId;
                        const isCreator = player.createdByUserId === currentUserId;
                        const hasNoOwner = !player.ownerId;
                        
                        const canManage = isSuperAdmin || isOwner || (isCreator && hasNoOwner);

                        return (
                            <PlayerInfoCard 
                                key={player.id}
                                player={player}
                                currentUserId={currentUserId}
                                onEdit={() => onEditPlayer(player)}
                                onDelete={() => handleDelete(player)}
                                onViewStats={() => onViewPlayerStats(player)}
                                canManage={canManage}
                            />
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center mt-12 opacity-50">
                    <div className="text-6xl mb-4">👥</div>
                    <p className="text-center text-[--color-text-secondary]">{t('noPlayers')}</p>
                </div>
            )}
        </div>
    );
}

export default PlayerManager;
