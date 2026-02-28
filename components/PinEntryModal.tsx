
import React, { useState } from 'react';
import { Player } from '../types';
import Avatar from './Avatar';
import { triggerHapticFeedback } from '../utils';

const PinEntryModal: React.FC<{
    player: Player;
    onSuccess: () => void;
    onClose: () => void;
}> = ({ player, onSuccess, onClose }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    const handleKey = (key: string) => {
        triggerHapticFeedback(30);
        setError(false);
        if (pin.length < 4) {
            const newPin = pin + key;
            setPin(newPin);
            if (newPin.length === 4) {
                if (newPin === player.pin) {
                    triggerHapticFeedback([20, 50, 20]);
                    onSuccess();
                } else {
                    triggerHapticFeedback([100, 100]);
                    setPin('');
                    setError(true);
                }
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[120] p-4">
            <div className="bg-[--color-surface] rounded-[40px] shadow-2xl p-8 w-full max-w-sm text-center border border-white/10">
                <Avatar avatar={player.avatar} className="w-24 h-24 mx-auto mb-4 border-4 border-[--color-accent]" />
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-1">{player.name}</h2>
                <p className="text-[--color-text-secondary] text-sm mb-8">Zadejte svůj 4-místný PIN</p>

                <div className="flex justify-center gap-3 mb-10">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${error ? 'border-red-500 bg-red-500/20' : (pin.length > i ? 'bg-[--color-accent] border-[--color-accent] scale-125' : 'border-white/20')}`}></div>
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                        <button key={num} onClick={() => handleKey(num)} className="h-16 rounded-2xl bg-white/5 text-2xl font-bold text-white hover:bg-white/10 active:scale-95 transition-all">
                            {num}
                        </button>
                    ))}
                    <div />
                    <button onClick={() => handleKey('0')} className="h-16 rounded-2xl bg-white/5 text-2xl font-bold text-white hover:bg-white/10 active:scale-95 transition-all">
                        0
                    </button>
                    <button onClick={onClose} className="h-16 text-sm font-bold text-[--color-red] uppercase tracking-widest">
                        Zrušit
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PinEntryModal;
