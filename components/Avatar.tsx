import React from 'react';
import { FALLBACK_AVATAR_PATH } from '../constants';

const Avatar: React.FC<{ avatar: string; className?: string }> = ({ avatar, className = "w-16 h-16" }) => {
    const finalAvatarPath = avatar || FALLBACK_AVATAR_PATH;
    
    if (typeof finalAvatarPath === 'string' && finalAvatarPath.startsWith('data:image')) {
        return <img src={finalAvatarPath} alt="Avatar" className={`rounded-full object-cover ${className}`} />;
    }
    
    return (
        <div className={`rounded-full bg-[--color-primary] flex items-center justify-center ${className}`}>
            <svg className="w-2/3 h-2/3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d={finalAvatarPath}></path>
            </svg>
        </div>
    );
};

export default Avatar;