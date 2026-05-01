import { uid, pushUndo, markerById } from './cpp-json.js';
import { timeGridForMeter, nearestBeat } from './music-models.js';
import { createAlignment, removeAlignment, removeMarkerAndDependents } from './alignment-engine.js';
import { updateMeasureConfidence } from './confidence-engine.js';
import { scanManualSpecialCases } from './special-cases.js';

export class MeasureEditor{
  constructor(wrap, protocol, onChange){this.wrap=wrap;this.protocol=protocol;this.onChange=onChange;this.measure=null;this.page=null;this.zoom=2;this.lensZoom=4;this.mouse=null;}
  setMeasure(page,measure){this.page=page;this.measure=measure;this.protocol.ui_state.current_measure_id=measure?.measure_id||'';this.render();}
  setZoom(z){this.zoom=Number(z);this.render();}
  setLensZoom(z){this.lensZoom=Number(z);}
  render(){
    this.wrap.innerHTML='';
    if(!this.page||!this.measure){this.wrap.innerHTML='<p class="hint">Selecione um compasso.</p>';return;}
    const m=this.measure;
    m.time_grid=timeGridForMeter(m.meter);
    const layer=document.createElement('div');
    layer.className='work-layer';
    layer.style.width=m.bbox.w*this.zoom+'px';
    layer.style.height=m.bbox.h*this.zoom+'px';
    layer.style.touchAction='none';
    const img=document.createElement('img');
    img.src=this.page.image_src;
    img.style.position='absolute';
    img.style.width=this.page.width*this.zoom+'px';
    img.style.left=-m.bbox.x*this.zoom+'px';
    img.style.top=-m.bbox.y*this.zoom+'px';
    img.draggable=false;
    layer.appendChild(img);
    m.time_grid.forEach((b,i)=>{const x=(m.bbox.w*(i/(Math.max(m.time_grid.length-1,1)))); const line=document.createElement('div'); line.className='ruler-line'; line.style.left=x*this.zoom+'px'; layer.appendChild(line); const tag=document.createElement('div'); tag.className='ruler-tag'; tag.textContent=b; tag.style.left=x*this.zoom+'px'; layer.appendChild(tag);});
    for(const mk of m.markers){
      const dot=document.createElement('div');dot.className=`marker-dot type-${mk.type}`;dot.style.left=mk.x*this.zoom+'px';dot.style.top=mk.y*this.zoom+'px';dot.title=`${mk.type}: ${mk.value}`;dot.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();this.editMarker(mk.marker_id);},{passive:false});layer.appendChild(dot);
      const lab=document.createElement('div');lab.className='marker-label';lab.textContent=mk.value||mk.type;lab.style.left=mk.x*this.zoom+'px';lab.style.top=mk.y*this.zoom+'px';layer.appendChild(lab);
    }
    let lensEl=null;
    const moveLens=(e)=>{const p=this.pt(e,layer);this.mouse=p;if(!lensEl){lensEl=document.createElement('div');lensEl.className='lens';const li=document.createElement('img');li.src=this.page.image_src;lensEl.appendChild(li);layer.appendChild(lensEl);} lensEl.style.left=(p.x*this.zoom+18)+'px';lensEl.style.top=(p.y*this.zoom+18)+'px'; const li=lensEl.querySelector('img'); li.style.width=this.page.width*this.lensZoom+'px'; li.style.left=-(m.bbox.x+p.x)*this.lensZoom+90+'px'; li.style.top=-(m.bbox.y+p.y)*this.lensZoom+90+'px';};
    layer.addEventListener('pointermove',e=>{e.preventDefault();moveLens(e);},{passive:false});
    layer.addEventListener('pointerleave',()=>{if(lensEl){lensEl.remove();lensEl=null;}});
    layer.addEventListener('pointerdown',e=>{e.preventDefault();const p=this.pt(e,layer);this.protocol.ui_state.cursor_position={x:Math.round(p.x),y:Math.round(p.y)};this.createMarkerAt(p);},{passive:false});
    this.wrap.appendChild(layer);
  }
  pt(e,layer){const r=layer.getBoundingClientRect();return{x:(e.clientX-r.left)/this.zoom,y:(e.clientY-r.top)/this.zoom};}
  createMarkerAt(p){
    const type=document.getElementById('markerType')?.value||'chord';
    let value='';
    if(type==='chord') value=prompt('Acorde (ex.: D, Bm, A7/G, C/D):','')||'';
    else if(type==='syllable') value=prompt('Sílaba/letra (ex.: Re-, -nhor, com_o):','')||'';
    else if(type==='note_head') value=prompt('Duração opcional (ex.: colcheia, semínima):','')||'nota';
    else if(type==='navigation') value=prompt('Tipo de navegação (repeat_start, fine, coda...):','')||'navigation';
    else if(type==='rest') value='pausa';
    else value=prompt('Valor do marcador:','')||type;
    if(!value) return;
    const beat=nearestBeat(p.x,this.measure.bbox.w,this.measure.time_grid);
    const mk={marker_id:uid('mk'),type,value,x:Math.round(p.x),y:Math.round(p.y),beat,confidence:'manual',duration:type==='note_head'?value:'',extra:{}};
    this.measure.markers.push(mk);
    if(type==='navigation'){this.protocol.navigation.visual_markers.push({id:uid('nav'),type:value,measure_id:this.measure.measure_id,confidence:'manual'});}
    pushUndo(this.protocol,{type:'create_marker',measure_id:this.measure.measure_id,marker_id:mk.marker_id});
    this.protocol.ui_state.selected_marker_type=type;
    scanManualSpecialCases(this.measure);
    updateMeasureConfidence(this.measure);
    this.onChange();
    this.render();
  }
  editMarker(id){const mk=markerById(this.measure,id); if(!mk)return; const value=prompt('Editar valor:',mk.value); if(value===null)return; const beat=prompt('Editar beat:',mk.beat); const old=JSON.stringify(mk); mk.value=value; if(beat!==null) mk.beat=beat; this.protocol.review.push({id:uid('rev'),timestamp:new Date().toISOString(),action:'marker_updated',target_id:id,old_value:old,new_value:JSON.stringify(mk)}); this.onChange(); this.render();}
  deleteMarker(id){if(!confirm('Apagar marcador e alinhamentos dependentes?'))return; removeMarkerAndDependents(this.measure,id); pushUndo(this.protocol,{type:'delete_marker',measure_id:this.measure.measure_id,marker_id:id}); this.onChange(); this.render();}
  createAlignment(data){try{const al=createAlignment(this.measure,data); pushUndo(this.protocol,{type:'create_alignment',measure_id:this.measure.measure_id,alignment_id:al.alignment_id}); this.onChange(); this.render(); return al;}catch(e){alert(e.message);}}
  undo(){const last=this.protocol.ui_state.undo_stack.pop(); if(!last)return; const m=this.protocol.measures.find(x=>x.measure_id===last.measure_id); if(!m)return; if(last.type==='create_alignment') removeAlignment(m,last.alignment_id); else if(last.type==='create_marker'){const used=m.alignments.some(a=>[a.chord_marker_id,a.syllable_marker_id,a.note_marker_id].includes(last.marker_id)); if(used){alert('Marcador vinculado a alinhamento confirmado. Apague pelo controle do marcador.'); this.protocol.ui_state.undo_stack.push(last); return;} m.markers=m.markers.filter(x=>x.marker_id!==last.marker_id);} this.onChange(); this.render();}
  approve(){this.measure.review_status='approved'; this.measure.review_required=false; this.onChange();}
  pending(){this.measure.review_status='pending'; this.measure.review_required=true; this.onChange();}
}
