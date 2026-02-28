
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Player } from '../types';
import { GAME_TYPE_DEFAULTS_SETUP } from '../constants';
import Avatar from './Avatar';

const CreateMatchModal: React.FC<{
    players: Player[];
    onClose: () => void;
    onCreate: (data: { playerId: string; scheduledAt: string; gameType: string; note: string }) => void;
}> = ({ players, onClose, onCreate }) => {
    const { t } = useTranslation();
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>(players[0]?.id || '');
    const [scheduledAt, setScheduledAt] = useState('');
    const [gameType, setGameType] = useState('gameSetup.threeCushion');
    const [note, setNote] = useState('');

    const handleSubmit = () => {
        if (!selectedPlayerId || !scheduledAt) return;
        onCreate({
            playerId: selectedPlayerId,
            scheduledAt: new Date(scheduledAt).toISOString(),
            gameType,
            note
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div 
                className="bg-[--color-surface] rounded-2xl shadow-2xl p-6 w-full max-w-md text-center" 
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-2xl font-bold text-[--color-accent] mb-6">{t('lobby.createTitle')}</h2>
                
                <div className="space-y-4 text-left">
                    <div>
                        <label className="block text-sm font-semibold text-[--color-text-secondary] mb-2">{t('lobby.selectChallenger')}</label>
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                            {players.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPlayerId(p.id)}
                                    className={`p-2 rounded-lg flex items-center gap-2 border-2 transition-all ${selectedPlayerId === p.id ? 'border-[--color-primary] bg-[--color-primary]/20' : 'border-transparent bg-[--color-surface-light]'}`}
                                >
                                    <Avatar avatar={p.avatar} className="w-8 h-8" />
                                    <span className="text-sm font-semibold truncate">{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-[--color-text-secondary] mb-2">{t('lobby.dateTime')}</label>
                        <input 
                            type="datetime-local" 
                            className="w-full bg-[--color-surface-light] text-[--color-text-primary] rounded-lg p-3"
                            value={scheduledAt}
                            onChange={e => setScheduledAt(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-[--color-text-secondary] mb-2">{t('lobby.gameType')}</label>
                        <select 
                            value={gameType} 
                            onChange={e => setGameType(e.target.value)}
                            className="w-full bg-[--color-surface-light] text-[--color-text-primary] rounded-lg p-3"
                        >
                            {Object.keys(GAME_TYPE_DEFAULTS_SETUP).map(key => (
                                <option key={key} value={key}>{t(key as any)}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-[--color-text-secondary] mb-2">{t('lobby.note')}</label>
                        <input 
                            type="text" 
                            className="w-full bg-[--color-surface-light] text-[--color-text-primary] rounded-lg p-3"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="e.g. Max 20 points"
                        />
                    </div>
                </div>

                <div className="flex gap-4 mt-8">
                    <button onClick={onClose} className="w-full bg-[--color-surface-light] text-[--color-text-primary] font-bold py-3 rounded-lg">{t('cancel')}</button>
                    <button onClick={handleSubmit} disabled={!selectedPlayerId || !scheduledAt} className="w-full bg-[--color-green] text-white font-bold py-3 rounded-lg disabled:opacity-50">{t('lobby.schedule')}</button>
                </div>
            </div>
        </div>
    );
};

export default CreateMatchModal;
