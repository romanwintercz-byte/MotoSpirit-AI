import React, { useEffect, useState } from 'react';

const CaromEffect: React.FC<{ trigger: number }> = ({ trigger }) => {
    const [active, setActive] = useState(false);

    useEffect(() => {
        if (trigger > 0) {
            setActive(true);
            const timer = setTimeout(() => setActive(false), 600);
            return () => clearTimeout(timer);
        }
    }, [trigger]);

    if (!active) return null;

    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[150px] pointer-events-none z-50 overflow-hidden opacity-90">
            {/* White Ball (Cue) */}
            <div className="absolute left-4 top-10 w-8 h-8 rounded-full bg-white ball-3d anim-shot-white z-20"></div>
            
            {/* Red Ball (Object 1) */}
            <div className="absolute left-[140px] top-10 w-8 h-8 rounded-full bg-red-600 ball-3d anim-hit-red z-10"></div>
            
            {/* Yellow Ball (Object 2) */}
            <div className="absolute left-[240px] top-[80px] w-8 h-8 rounded-full bg-yellow-400 ball-3d anim-hit-yellow z-10"></div>
        </div>
    );
};

export default CaromEffect;