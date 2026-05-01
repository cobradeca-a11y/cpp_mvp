export function timeGridForMeter(meter){
  if(meter==='2/4') return ['1','e','2','e'];
  if(meter==='4/4') return ['1','e','2','e','3','e','4','e'];
  return ['1','e','2','e','3','e'];
}
export function isValidChord(symbol=''){
  const s=symbol.trim();
  if(!s) return false;
  const chord=/^[A-G](#|b)?(m|maj|min|dim|aug|sus)?\d*(\([^)]*\))?(add\d+)?(maj\d+)?(m\d+)?(\([^)]*\))?(\/[A-G](#|b)?)?$/;
  const slash=/^[A-G](#|b)?\/[A-G](#|b)?$/;
  return chord.test(s)||slash.test(s);
}
export function nearestBeat(x, measureWidth, grid){
  if(!grid?.length || !measureWidth) return '';
  let best=grid[0], bestD=Infinity;
  grid.forEach((g,i)=>{const gx=(measureWidth*(i/(Math.max(grid.length-1,1)))); const d=Math.abs(x-gx); if(d<bestD){bestD=d; best=g;}});
  return best;
}
export function markerColor(type){return {chord:'#2563eb',syllable:'#16a34a',note_head:'#7c3aed',beat:'#f97316',rest:'#64748b',navigation:'#db2777'}[type]||'#111827';}
