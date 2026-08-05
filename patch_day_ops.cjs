const fs = require('fs');
let code = fs.readFileSync('pages/TripPlanner.tsx', 'utf8');

const funcsToAdd = `
  const deleteDay = (idx: number) => {
    if (!expedition || !window.confirm("Opravdu chcete tento den smazat?")) return;
    const updatedDays = expedition.days.filter((_, i) => i !== idx);
    updatedDays.forEach((day, i) => day.dayNumber = i + 1);
    
    const newTotalKm = updatedDays.reduce((acc, day) => acc + (day.distanceKm || parseInt((day.distance || "").replace(/\\D/g, '')) || 0), 0);
    
    const newExpedition = { ...expedition, days: updatedDays, totalDistanceKm: newTotalKm, totalDistance: newTotalKm + ' km' };
    setExpedition(newExpedition);
    
    const existingStr = localStorage.getItem('spirit_wanderer_trips');
    if (existingStr) {
      try {
        const trips = JSON.parse(existingStr);
        const updatedTrips = trips.map((t: any) => t.id === expedition.id ? newExpedition : t);
        localStorage.setItem('spirit_wanderer_trips', JSON.stringify(updatedTrips));
      } catch(e) {}
    }
    setEditingDayIdx(null);
    setEditDayData(null);
  };

  const addNewDay = () => {
    if (!expedition) return;
    const newDayNum = expedition.days.length + 1;
    const newDay = {
      dayNumber: newDayNum,
      startLocation: expedition.days.length > 0 ? expedition.days[expedition.days.length - 1].endLocation : 'Nový start',
      endLocation: 'Nový cíl',
      distance: '0 km',
      distanceKm: 0,
      description: '',
      waypoints: [],
      estimatedTimeMins: 0,
    };
    
    const updatedDays = [...expedition.days, newDay];
    const newExpedition = { ...expedition, days: updatedDays };
    setExpedition(newExpedition);
    
    const existingStr = localStorage.getItem('spirit_wanderer_trips');
    if (existingStr) {
      try {
        const trips = JSON.parse(existingStr);
        const updatedTrips = trips.map((t: any) => t.id === expedition.id ? newExpedition : t);
        localStorage.setItem('spirit_wanderer_trips', JSON.stringify(updatedTrips));
      } catch(e) {}
    }
    
    setEditingDayIdx(newDayNum - 1);
    setEditDayData(newDay);
  };
`;

if (!code.includes('const deleteDay')) {
  code = code.replace(/const saveDayEdit = \(\) => \{/g, funcsToAdd + '\n  const saveDayEdit = () => {');
}

fs.writeFileSync('pages/TripPlanner.tsx', code, 'utf8');
console.log("Added Day Operations");
