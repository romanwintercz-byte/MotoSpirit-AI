import { TripDay } from '../types';

/**
 * Redukuje pole souřadnic (waypoints) na zadaný maximální počet bodů.
 * Vždy zachová první a poslední bod. Ostatní body vybere rovnoměrně.
 */
export const reduceWaypoints = (waypoints: [number, number][], maxPoints: number): [number, number][] => {
  if (!waypoints || waypoints.length <= maxPoints) return waypoints;
  
  const result: [number, number][] = [];
  result.push(waypoints[0]); // Start
  
  const step = (waypoints.length - 2) / (maxPoints - 2);
  for (let i = 1; i < maxPoints - 1; i++) {
    const index = Math.floor(i * step);
    result.push(waypoints[index]);
  }
  
  result.push(waypoints[waypoints.length - 1]); // Cíl
  return result;
};

/**
 * Vygeneruje navigační odkaz pro Google Maps (max 9 průjezdních bodů + start + cíl = 11 bodů)
 */
export const getGoogleMapsUrl = (day: TripDay): string => {
  if (!day.waypoints || day.waypoints.length === 0) {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(day.startLocation)}&destination=${encodeURIComponent(day.endLocation)}&travelmode=driving`;
  }

  // Google Maps URL limit is around 10 waypoints for reliable routing
  const validWaypoints = day.waypoints.filter(wp => wp && wp.length >= 2);
  const reduced = reduceWaypoints(validWaypoints, 10);
  
  const origin = `${Number(reduced[0][0]).toFixed(6)},${Number(reduced[0][1]).toFixed(6)}`;
  const destination = `${Number(reduced[reduced.length - 1][0]).toFixed(6)},${Number(reduced[reduced.length - 1][1]).toFixed(6)}`;
  
  const waypoints = reduced.slice(1, -1).map(wp => `${Number(wp[0]).toFixed(6)},${Number(wp[1]).toFixed(6)}`).join('|');
  
  let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  if (waypoints) {
    url += `&waypoints=${encodeURIComponent(waypoints)}`;
  }
  
  return url;
};

/**
 * Vygeneruje navigační odkaz pro Mapy.cz
 */
export const getMapyCzUrl = (day: TripDay): string => {
  if (!day.waypoints || day.waypoints.length === 0) {
    return `https://mapy.cz/zakladni?q=${encodeURIComponent(day.startLocation)} do ${encodeURIComponent(day.endLocation)}`;
  }

  // Mapy.cz zvládne více bodů, ale pro jistotu redukujeme na 10
  const validWaypoints = day.waypoints.filter(wp => wp && wp.length >= 2);
  const reduced = reduceWaypoints(validWaypoints, 10);
  
  // Formát: rc=lon1,lat1~lon2,lat2...
  // Pozor: Mapy.cz používají [longitude, latitude], naše data jsou [latitude, longitude]
  const rc = reduced.map(wp => `${Number(wp[1]).toFixed(6)},${Number(wp[0]).toFixed(6)}`).join('~');
  
  // DŮLEŽITÉ: Mapy.cz vyžadují parametr 'rs' (route source), který říká, že jde o souřadnice ('coor')
  const rs = reduced.map(() => 'coor').join('~');
  
  // rut=1 je parametr, který Mapy.cz řekne, aby trasu rovnou vypočítaly
  // mrp raději vynecháme, protože nevalidní hodnota může způsobit pád routování
  return `https://mapy.cz/zakladni?planovani-trasy&rc=${encodeURIComponent(rc)}&rs=${encodeURIComponent(rs)}&rut=1`;
};
