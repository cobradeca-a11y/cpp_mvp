import { markerById } from './cpp-json.js';
function padCells(grid, map){return grid.map(b=>(map[b]||'').padEnd(10)).join('');}
export function generateTechnical(protocol){
  const lines=[`CIFRA TÉCNICA — ${protocol.music.title||'Sem título'}`,''];
  const measures=protocol.measures.slice().sort((a,b)=>a.number-b.number);
  for(const m of measures){
    const chordMap={}, sylMap={}, noteMap={}, confMap={};
    for(const al of m.alignments){const ch=markerById(m,al.chord_marker_id);const sy=markerById(m,al.syllable_marker_id);const nt=markerById(m,al.note_marker_id);const beat=al.beat||ch?.beat||'';if(ch) chordMap[beat]=[chordMap[beat],ch.value].filter(Boolean).join('/'); if(sy) sylMap[beat]=[sylMap[beat],sy.value].filter(Boolean).join(' '); if(nt) noteMap[beat]=[noteMap[beat],nt.value||'nota'].filter(Boolean).join(' '); confMap[beat]=al.confidence||'';}
    lines.push(`[Compasso ${m.number}] ${m.meter}${m.is_anacrusis?' — anacruse':''}`);
    lines.push('Tempo:    '+m.time_grid.map(b=>b.padEnd(10)).join(''));
    lines.push('Acorde:   '+padCells(m.time_grid,chordMap));
    lines.push('Sílaba:   '+padCells(m.time_grid,sylMap));
    lines.push('Nota:     '+padCells(m.time_grid,noteMap));
    lines.push('Conf.:    '+padCells(m.time_grid,confMap));
    if(m.notes) lines.push('Obs.:     '+m.notes);
    if(m.alignment_warnings?.length) lines.push('Avisos:   '+m.alignment_warnings.map(w=>w.message).join('; '));
    lines.push('');
  }
  return lines.join('\n');
}
