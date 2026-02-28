
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Player } from '../types';
import Avatar from './Avatar';

const ClaimProfileModal: React.FC<{
    player: Player;
    onClaim: () => void;
    onClose: () => void;
}> = ({ player, onClaim, onClose }) => {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div 
                className="bg-[--color-surface] rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center border border-[--color-accent]/30 transform animate-score-pop"
            >
                <div className="text-4xl mb-4">👋</div>
                <h2 className="text-2xl font-extrabold text-[--color-accent] mb-2">Vítejte zpět!</h2>
                <p className="text-[--color-text-primary] text-sm mb-6 leading-relaxed">
                    V této komunitě byl nalezen váš profil. Chcete si jej převzít a spravovat?
                </p>

                <div className="bg-black/20 p-4 rounded-2xl mb-8 flex items-center gap-4 border border-[--color-border]/30">
                    <Avatar avatar={player.avatar} className="w-16 h-16" />
                    <div className="text-left">
                        <p className="font-bold text-lg text-[--color-text-primary]">{player.name}</p>
                        <p className="text-[10px] text-[--color-text-secondary] uppercase tracking-widest font-bold">Hráč v komunitě</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <button 
                        onClick={onClaim}
                        className="w-full bg-[--color-green] hover:bg-[--color-green-hover] text-white font-bold py-4 rounded-2xl text-lg shadow-lg shadow-green-900/20 transition-all active:scale-95"
                    >
                        Ano, převzít profil
                    </button>
                    <button 
                        onClick={onClose}
                        className="w-full bg-[--color-surface-light] text-[--color-text-primary] font-bold py-3 rounded-xl transition-all"
                    >
                        Možná později
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClaimProfileModal;
