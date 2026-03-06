import { useState, useEffect } from 'react';
import { Expedition } from '../types';

export interface ActiveExpeditionState {
  expeditionId: string;
  expeditionName: string;
  startTime: string;
  currentDistanceKm: number;
  lastLat?: number;
  lastLon?: number;
}

export const useActiveExpedition = () => {
  const [activeState, setActiveState] = useState<ActiveExpeditionState | null>(() => {
    const saved = localStorage.getItem('motospirit_active_expedition');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem('motospirit_active_expedition');
      setActiveState(saved ? JSON.parse(saved) : null);
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('active-expedition-update', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('active-expedition-update', handleStorage);
    };
  }, []);

  // GPS Tracking Logic
  useEffect(() => {
    if (!activeState) return;

    let watchId: number;

    const startTracking = () => {
      if (!navigator.geolocation) return;

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          setActiveState(prev => {
            if (!prev) return null;
            
            let newDistance = prev.currentDistanceKm;
            if (prev.lastLat && prev.lastLon) {
              // Haversine distance
              const R = 6371; // km
              const dLat = (latitude - prev.lastLat) * Math.PI / 180;
              const dLon = (longitude - prev.lastLon) * Math.PI / 180;
              const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(prev.lastLat * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2); 
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
              const d = R * c;
              
              // Only add if it's a reasonable movement (e.g., > 10 meters to avoid GPS jitter)
              if (d > 0.01) {
                newDistance += d;
              } else {
                return prev; // No significant movement
              }
            }

            const newState = {
              ...prev,
              currentDistanceKm: newDistance,
              lastLat: latitude,
              lastLon: longitude
            };
            
            localStorage.setItem('motospirit_active_expedition', JSON.stringify(newState));
            return newState;
          });
        },
        (error) => {
          console.error("GPS Tracking error:", error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 5000
        }
      );
    };

    startTracking();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [activeState?.expeditionId]); // Only re-run if expedition changes

  const startExpedition = (expedition: Expedition) => {
    const newState: ActiveExpeditionState = {
      expeditionId: expedition.id,
      expeditionName: expedition.name,
      startTime: new Date().toISOString(),
      currentDistanceKm: 0
    };
    localStorage.setItem('motospirit_active_expedition', JSON.stringify(newState));
    setActiveState(newState);
    window.dispatchEvent(new Event('active-expedition-update'));
    
    // Update expedition status
    const saved = localStorage.getItem('spirit_wanderer_trips');
    if (saved) {
      const trips: Expedition[] = JSON.parse(saved);
      const updated = trips.map(t => t.id === expedition.id ? { ...t, status: 'active' as const } : t);
      localStorage.setItem('spirit_wanderer_trips', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    }
  };

  const endExpedition = () => {
    if (!activeState) return;
    
    // Update expedition status and save final distance
    const saved = localStorage.getItem('spirit_wanderer_trips');
    if (saved) {
      const trips: Expedition[] = JSON.parse(saved);
      const updated = trips.map(t => 
        t.id === activeState.expeditionId 
          ? { ...t, status: 'completed' as const, realDistanceKm: Math.round(activeState.currentDistanceKm) } 
          : t
      );
      localStorage.setItem('spirit_wanderer_trips', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    }

    localStorage.removeItem('motospirit_active_expedition');
    setActiveState(null);
    window.dispatchEvent(new Event('active-expedition-update'));
  };

  return {
    activeState,
    startExpedition,
    endExpedition
  };
};
