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
  const reduced = reduceWaypoints(day.waypoints, 10);
  
  const origin = `${reduced[0][0]},${reduced[0][1]}`;
  const destination = `${reduced[reduced.length - 1][0]},${reduced[reduced.length - 1][1]}`;
  
  const waypoints = reduced.slice(1, -1).map(wp => `${wp[0]},${wp[1]}`).join('|');
  
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }
  
  return url;
};

/**
 * Vygeneruje navigační odkaz pro Mapy.cz
 */
export const getMapyCzUrl = (day: TripDay): string => {
  if (!day.waypoints || day.waypoints.length === 0) {
    return `https://mapy.cz/zakladni?planovani-trasy&rc=${encodeURIComponent(day.startLocation)}~${encodeURIComponent(day.endLocation)}&rut=1&mrp=fast`;
  }

  // Mapy.cz zvládne více bodů, ale pro jistotu redukujeme na 15
  const reduced = reduceWaypoints(day.waypoints, 15);
  
  // Formát: rc=lon1,lat1~lon2,lat2...
  // Pozor: Mapy.cz používají [longitude, latitude], naše data jsou [latitude, longitude]
  // DŮLEŽITÉ: Znaky vlnovky (~) a čárky (,) nesmí být zakódované, Mapy.cz je používají jako oddělovače.
  const rc = reduced.map(wp => `${wp[1]},${wp[0]}`).join('~');
  
  // rut=1 je parametr, který Mapy.cz řekne, aby trasu rovnou vypočítaly
  return `https://mapy.cz/zakladni?planovani-trasy&rc=${rc}&rut=1&mrp=fast`;
};
