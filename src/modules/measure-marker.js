import { uid } from './cpp-json.js';
import { timeGridForMeter } from './music-models.js';

export class MeasureMarker{
  constructor(wrap, protocol, onChange){this.wrap=wrap;this.protocol=protocol;this.onChange=onChange;this.system=null;this.page=null;this.zoom=1.5;this.mode=false;}
  setSystem(page,system){this.page=page;this.system=system;this.render();}
  enableBarline(){this.mode=true;this.render();}
  barlines(){return this.protocol.navigation.visual_markers.filter(n=>n.system_id===this.system?.system_id && n.kind==='barline').sort((a,b)=>a.x-b.x);}
  render(){
    this.wrap.innerHTML='';
    if(!this.page||!this.system){this.wrap.innerHTML='<p class="hint">Selecione um sistema.</p>';return;}
    const layer=document.createElement('div');
    layer.className='work-layer';
    layer.style.width=this.system.bbox.w*this.zoom+'px';
    layer.style.height=this.system.bbox.h*this.zoom+'px';
    layer.style.touchAction=this.mode?'none':'auto';
    const img=document.createElement('img');
    img.src=this.page.image_src;
    img.style.width=this.page.width*this.zoom+'px';
    img.style.position='absolute';
    img.style.left=-this.system.bbox.x*this.zoom+'px';
    img.style.top=-this.system.bbox.y*this.zoom+'px';
    img.draggable=false;
    layer.appendChild(img);
    for(const b of this.barlines()){
      const el=document.createElement('div');el.className='barline';el.style.left=b.x*this.zoom+'px';el.style.height=this.system.bbox.h*this.zoom+'px';el.title=b.type;layer.appendChild(el);
    }
    for(const m of this.protocol.measures.filter(m=>m.system_id===this.system.system_id)){
      const el=document.createElement('div');el.className='measure-box';el.style.left=(m.bbox.x-this.system.bbox.x)*this.zoom+'px';el.style.top='0px';el.style.width=m.bbox.w*this.zoom+'px';el.style.height=this.system.bbox.h*this.zoom+'px';el.title=`Compasso ${m.number}`;layer.appendChild(el);
    }
    if(this.mode){const badge=document.createElement('div');badge.className='mode-badge';badge.textContent='Modo barra: toque na barra de compasso';layer.appendChild(badge);}
    layer.addEventListener('pointerdown',e=>{
      if(!this.mode)return;
      e.preventDefault();
      const rect=layer.getBoundingClientRect();
      const x=(e.clientX-rect.left)/this.zoom;
      const type=document.getElementById('barlineType')?.value||'simple_barline';
      this.protocol.navigation.visual_markers.push({id:uid('nav'),kind:'barline',type,system_id:this.system.system_id,measure_id:'',x:Math.round(x),confidence:'manual'});
      this.mode=false;
      this.onChange();
    },{passive:false});
    this.wrap.appendChild(layer);
  }
  generateMeasures(meter='3/4'){
    if(!this.system)return;
    const bars=this.barlines();
    const xs=[0,...bars.map(b=>b.x),this.system.bbox.w].filter((x,i,a)=>i===0||Math.abs(x-a[i-1])>4).sort((a,b)=>a-b);
    const oldIds=this.protocol.measures.filter(m=>m.system_id===this.system.system_id).map(m=>m.measure_id);
    this.protocol.measures=this.protocol.measures.filter(m=>m.system_id!==this.system.system_id);
    let startNum=this.protocol.measures.length+1;
    for(let i=0;i<xs.length-1;i++){
      const w=xs[i+1]-xs[i];
      if(w<10) continue;
      this.protocol.measures.push({measure_id:uid('m'),system_id:this.system.system_id,number:startNum++,meter,is_anacrusis:false,bbox:{x:Math.round(this.system.bbox.x+xs[i]),y:this.system.bbox.y,w:Math.round(w),h:this.system.bbox.h},time_grid:timeGridForMeter(meter),markers:[],alignments:[],special_cases:[],alignment_warnings:[],confidence:'provável',review_required:false,review_status:'pending',notes:''});
    }
    this.protocol.navigation.visual_markers=this.protocol.navigation.visual_markers.map(n=> oldIds.includes(n.measure_id)?{...n,measure_id:''}:n);
    this.onChange();
  }
}
export function removeBarline(protocol, id){protocol.navigation.visual_markers=protocol.navigation.visual_markers.filter(n=>n.id!==id);}
