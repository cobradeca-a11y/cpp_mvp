import { markerById } from './cpp-json.js';
import { executionMeasures, ensureExecutionOrder } from './navigation-engine.js';
function place(line,pos,text){if(pos<0)pos=0; if(line.length<pos) line=line.padEnd(pos,' '); return line.slice(0,pos)+text+line.slice(pos+text.length);}
export function generatePlayable(protocol){
  ensureExecutionOrder(protocol);
  const measures=protocol.navigation.status==='manual_confirmed'||protocol.navigation.status==='auto_resolved'?executionMeasures(protocol):protocol.measures.slice().sort((a,b)=>a.number-b.number);
  const lines=[`CIFRA TOCÁVEL — ${protocol.music.title||'Sem título'}`];
  if(protocol.navigation.status==='visual_only') lines.push('Aviso: navegação não confirmada; usando ordem visual.');
  lines.push('');
  for(const m of measures){
    const lyricItems=[]; const chordItems=[]; const restItems=[];
    const aligns=m.alignments.slice().sort((a,b)=>{const ca=markerById(m,a.chord_marker_id), cb=markerById(m,b.chord_marker_id);return (ca?.x||0)-(cb?.x||0);});
    for(const al of aligns){const ch=markerById(m,al.chord_marker_id);const sy=markerById(m,al.syllable_marker_id); if(!ch) continue; const pos=Math.max(0,Math.round((ch.x/Math.max(m.bbox.w,1))*48)); const chord=ch.value+(al.confidence&&al.confidence!=='certo'?'?':''); if(al.alignment_type==='chord_on_rest' || !sy){restItems.push({pos,chord,type:al.alignment_type});} else {lyricItems.push({pos,text:sy.value}); chordItems.push({pos,chord});}}
    let chordLine='', lyricLine='';
    for(const item of lyricItems.sort((a,b)=>a.pos-b.pos)) lyricLine=place(lyricLine,item.pos,item.text);
    for(const item of chordItems.sort((a,b)=>a.pos-b.pos)) chordLine=place(chordLine,item.pos,item.chord);
    for(const item of restItems.sort((a,b)=>a.pos-b.pos)){chordLine=place(chordLine,item.pos,item.chord); if(!lyricLine.trim()) lyricLine=place(lyricLine,item.pos,'[pausa]');}
    lines.push(`% Compasso ${m.number}`);
    lines.push(chordLine.trimEnd()||'—');
    lines.push(lyricLine.trimEnd()||'[sem letra]');
    lines.push('');
  }
  return lines.join('\n');
}
