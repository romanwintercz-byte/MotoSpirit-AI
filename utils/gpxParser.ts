export function parseGpxData(gpxString: string): { route: [number, number][], distanceKm: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxString, "text/xml");
  
  const trkpts = doc.getElementsByTagName('trkpt');
  const route: [number, number][] = [];
  
  for (let i = 0; i < trkpts.length; i++) {
    const pt = trkpts[i];
    const lat = parseFloat(pt.getAttribute('lat') || '0');
    const lon = parseFloat(pt.getAttribute('lon') || '0');
    if (!isNaN(lat) && !isNaN(lon)) {
      route.push([lat, lon]);
    }
  }

  let distanceKm = 0;
  for (let i = 1; i < route.length; i++) {
    const p1 = route[i-1];
    const p2 = route[i];
    distanceKm += calculateHaversineDistance(p1, p2);
  }

  return { route, distanceKm: Math.round(distanceKm) };
}

function calculateHaversineDistance(p1: [number, number], p2: [number, number]): number {
  const R = 6371; // Earth radius in km
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLon = (p2[1] - p1[1]) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
