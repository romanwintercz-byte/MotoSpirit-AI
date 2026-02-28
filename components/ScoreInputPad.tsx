
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { triggerHapticFeedback } from '../utils';

const ScoreInputPad: React.FC<{
    onScore: (scoreData: { points: number, type: 'standard' | 'clean10' | 'clean20' | 'numpad' }) => void;
    onEndTurn: () => void;
    onUndoTurn: () => void;
    isUndoTurnDisabled: boolean;
    pointsToTarget: number;
    allowOvershooting: boolean;
    gameType: string;
}> = ({ onScore, onEndTurn, onUndoTurn, isUndoTurnDisabled, pointsToTarget, allowOvershooting, gameType }) => {
    const { t } = useTranslation();
    const [showNumpad, setShowNumpad] = useState(false);
    const [numpadValue, setNumpadValue] = useState('');

    const isThreeBallGame = 
        gameType === 'gameSetup.threeCushion' ||
        gameType === 'gameSetup.oneCushion' ||
        gameType === 'gameSetup.freeGame';

    const handleNumpadInput = (char: string) => {
        triggerHapticFeedback(30);
        if (char === 'del') {
            setNumpadValue(prev => prev.slice(0, -1));
        } else {
            setNumpadValue(prev => prev + char);
        }
    };
    
    const handleAddFromNumpad = () => {
        const points = parseInt(numpadValue, 10);
        if (!isNaN(points) && points > 0) {
            triggerHapticFeedback(50);
            onScore({ points, type: 'numpad' });
        }
        setNumpadValue('');
        setShowNumpad(false);
    };

    const handleScoreClick = (points: number, type: 'standard' | 'clean10' | 'clean20') => {
        triggerHapticFeedback(30);
        onScore({ points, type });
    };

    const handleEndTurnClick = () => {
        triggerHapticFeedback(80);
        onEndTurn();
    };

    const handleUndoTurnClick = () => {
        triggerHapticFeedback([20, 40, 20]);
        onUndoTurn();
    };


    const isClean20Disabled = !allowOvershooting && pointsToTarget < 20;
    const isClean10Disabled = !allowOvershooting && pointsToTarget < 10;

    if (showNumpad) {
        return (
            <div className="bg-[--color-surface] p-2 rounded-t-2xl h-full flex flex-col">
                <input
                    type="text"
                    readOnly
                    value={numpadValue}
                    className="w-full bg-[--color-bg] text-[--color-text-primary] text-right text-4xl font-mono rounded-lg px-4 py-3 mb-2"
                    placeholder="0"
                />
                <div className="grid grid-cols-3 gap-2 flex-grow">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(char => (
                        <button key={char} onClick={() => handleNumpadInput(char)} className="bg-[--color-surface-light] hover:bg-[--color-surface] text-[--color-text-primary] font-bold py-3 rounded-lg text-2xl active:bg-[--color-primary] active:text-white">
                            {char}
                        </button>
                    ))}
                     <button onClick={() => handleNumpadInput('del')} className="bg-[--color-red]/20 text-[--color-red] font-bold py-3 rounded-lg text-xl">
                        ⌫
                    </button>
                     <button onClick={() => handleNumpadInput('0')} className="bg-[--color-surface-light] hover:bg-[--color-surface] text-[--color-text-primary] font-bold py-3 rounded-lg text-2xl active:bg-[--color-primary] active:text-white">
                        0
                    </button>
                    <button onClick={handleAddFromNumpad} className="bg-[--color-green] text-white font-bold py-3 rounded-lg text-xl">✓</button>
                </div>
                 <button onClick={() => setShowNumpad(false)} className="w-full mt-2 bg-[--color-surface-light] text-[--color-text-primary] font-bold py-3 rounded-lg">{t('cancel')}</button>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col gap-2 w-full max-w-md mx-auto pb-safe">
            {isThreeBallGame ? (
                <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => handleScoreClick(-1, 'standard')} className="bg-[--color-red] text-white font-bold py-4 rounded-xl text-xl flex items-center justify-center active:scale-95 transition-transform">-1</button>
                    <button onClick={() => handleScoreClick(1, 'standard')} className="col-span-2 bg-[--color-green] text-white font-extrabold py-4 rounded-xl text-4xl flex items-center justify-center shadow-lg active:scale-95 transition-transform shadow-green-900/20">+1</button>
                    <button onClick={() => { triggerHapticFeedback(40); setShowNumpad(true); }} className="bg-[--color-surface-light] text-[--color-text-primary] font-bold py-4 rounded-xl text-2xl flex items-center justify-center">🧮</button>
                </div>
            ) : (
                <div className="grid grid-cols-4 gap-2">
                    <button onClick={() => handleScoreClick(1, 'standard')} className="col-span-2 row-span-2 bg-[--color-green] text-white font-extrabold py-2 rounded-xl text-5xl flex items-center justify-center shadow-lg active:scale-95 transition-transform">+1</button>
                    <button onClick={() => handleScoreClick(10, 'clean10')} disabled={isClean10Disabled} className="bg-[--color-primary] text-white font-bold py-4 rounded-xl text-lg disabled:opacity-30 disabled:bg-gray-700">+10</button>
                    <button onClick={() => handleScoreClick(20, 'clean20')} disabled={isClean20Disabled} className="bg-[--color-primary] text-white font-bold py-4 rounded-xl text-lg disabled:opacity-30 disabled:bg-gray-700">+20</button>
                    <button onClick={() => handleScoreClick(-1, 'standard')} className="bg-[--color-red] text-white font-bold py-3 rounded-xl text-xl">-1</button>
                    <button onClick={() => handleScoreClick(-10, 'standard')} className="bg-[--color-red] text-white font-bold py-3 rounded-xl text-xl">-10</button>
                </div>
            )}

            <div className="grid grid-cols-4 gap-2 mt-1">
                 <button 
                    onClick={handleUndoTurnClick} 
                    disabled={isUndoTurnDisabled}
                    className="col-span-1 bg-[--color-yellow] text-black font-bold py-4 rounded-xl shadow-sm transition-all duration-200 disabled:opacity-40 disabled:bg-gray-600 flex justify-center items-center text-2xl"
                >
                    ↶
                </button>
                <button onClick={handleEndTurnClick} className="col-span-3 bg-[--color-surface-light] border-2 border-[--color-primary] text-[--color-primary] font-bold py-4 rounded-xl text-xl uppercase tracking-wider active:bg-[--color-primary] active:text-white transition-colors">
                    {t('scorePad.endTurn')}
                </button>
            </div>
        </div>
    );
};

export default ScoreInputPad;
