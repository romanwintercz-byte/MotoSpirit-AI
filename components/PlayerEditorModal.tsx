
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Player } from '../types';
import Avatar from './Avatar';
import { PREDEFINED_AVATARS_EDITOR } from '../constants';
import { triggerHapticFeedback, resizeImage } from '../utils';

const PlayerEditorModal: React.FC<{
    playerToEdit?: Player;
    onSave: (playerData: { name: string; avatar: string; linkedEmail?: string; pin?: string }) => void;
    onClose: () => void;
    onOpenCamera: (currentState: { name: string; avatar: string }) => void;
}> = ({ playerToEdit, onSave, onClose, onOpenCamera }) => {
    const { t } = useTranslation();
    const [name, setName] = useState(playerToEdit?.name || '');
    const [avatar, setAvatar] = useState(playerToEdit?.avatar || PREDEFINED_AVATARS_EDITOR[0]);
    const [linkedEmail, setLinkedEmail] = useState(playerToEdit?.linkedEmail || '');
    const [pin, setPin] = useState(playerToEdit?.pin || '');
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = () => {
        if (name.trim()) {
            triggerHapticFeedback(50);
            onSave({ 
                name: name.trim(), 
                avatar, 
                linkedEmail: linkedEmail.trim().toLowerCase() || undefined,
                pin: pin.length === 4 ? pin : undefined
            });
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setIsProcessing(true);
            const reader = new FileReader();
            reader.onloadend = async () => {
                const rawDataUrl = reader.result as string;
                const compressedDataUrl = await resizeImage(rawDataUrl, 320);
                setAvatar(compressedDataUrl);
                setIsProcessing(false);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40 p-4" onClick={onClose}>
            <div 
                className="bg-[--color-surface] rounded-2xl shadow-2xl p-6 w-full max-w-md text-center transform transition-transform duration-300 max-h-[90vh] overflow-y-auto" 
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-2xl font-bold text-[--color-accent] mb-6">{playerToEdit && playerToEdit.id ? t('editPlayer') : t('addPlayerTitle')}</h2>
                
                <div className="relative w-24 h-24 mx-auto mb-4">
                    <Avatar avatar={avatar} className="w-full h-full" />
                    {isProcessing && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                        </div>
                    )}
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-left block text-[10px] uppercase font-bold text-[--color-text-secondary] mb-1 px-1">Jméno</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('playerNamePlaceholder') as string}
                            className="w-full bg-[--color-surface-light] text-[--color-text-primary] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[--color-accent]" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-900/10 p-3 rounded-xl border border-blue-500/20">
                            <label className="text-left block text-[10px] uppercase font-bold text-blue-400 mb-1 px-1">
                                Email (propojení)
                            </label>
                            <input type="email" value={linkedEmail} onChange={e => setLinkedEmail(e.target.value)} placeholder="Email"
                                className="w-full bg-[--color-surface-light] text-[--color-text-primary] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="bg-yellow-900/10 p-3 rounded-xl border border-yellow-500/20">
                            <label className="text-left block text-[10px] uppercase font-bold text-yellow-400 mb-1 px-1">
                                Rychlý PIN (4 čísla)
                            </label>
                            <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="1234"
                                className="w-full bg-[--color-surface-light] text-[--color-text-primary] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 tracking-[0.5em] text-center" />
                        </div>
                    </div>
                </div>

                <div className="text-left mb-6">
                    <p className="text-[--color-text-secondary] font-semibold mb-3">{t('chooseAvatar')}</p>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <button onClick={() => fileInputRef.current?.click()} className="h-20 bg-[--color-surface-light] hover:bg-[--color-bg] rounded-lg flex flex-col items-center justify-center text-xs transition-colors"><span className="text-2xl mb-1">📤</span>{t('uploadFile')}</button>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <button onClick={() => onOpenCamera({ name, avatar })} className="h-20 bg-[--color-surface-light] hover:bg-[--color-bg] rounded-lg flex flex-col items-center justify-center text-xs transition-colors"><span className="text-2xl mb-1">📸</span>{t('takePhoto')}</button>
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                        {PREDEFINED_AVATARS_EDITOR.map((svgPath, index) => (
                           <button key={index} onClick={() => setAvatar(svgPath)} className={`p-1 rounded-full transition-all ${avatar === svgPath ? 'ring-2 ring-[--color-accent]' : ''}`}>
                               <Avatar avatar={svgPath} className="w-full h-full" />
                           </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-4 sticky bottom-0 bg-[--color-surface] pt-2">
                    <button onClick={onClose} className="w-full bg-[--color-surface-light] hover:bg-[--color-border] text-[--color-text-primary] font-bold py-3 rounded-lg transition-colors">{t('cancel')}</button>
                    <button onClick={handleSave} disabled={isProcessing} className="w-full bg-[--color-green] hover:bg-[--color-green-hover] text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50">{t('save')}</button>
                </div>
            </div>
        </div>
    );
};

export default PlayerEditorModal;
