import { uid } from './cpp-json.js';
import { timeGridForMeter } from './music-models.js';

function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

export class MeasureMarker{
  constructor(wrap, protocol, onChange){
    this.wrap=wrap;
    this.protocol=protocol;
    this.onChange=onChange;
    this.system=null;
    this.page=null;
    this.zoom=1.5;
    this.mode=false;
    this.draftBar=null;
    this.draggingDraft=false;
  }

  setSystem(page,system){
    this.page=page;
    this.system=system;
    this.mode=false;
    this.draftBar=null;
    this.draggingDraft=false;
    this.render();
  }

  enableBarline(){
    if(!this.system) return;
    this.mode=true;
    // Mobile-first: instead of forcing a precise tap, create a draggable vertical bar.
    // The user moves it left/right and validates when aligned.
    this.draftBar={x:Math.round(this.system.bbox.w/2),type:document.getElementById('barlineType')?.value||'simple_barline'};
    this.render();
  }

  cancelDraft(){
    this.mode=false;
    this.draftBar=null;
    this.draggingDraft=false;
    this.render();
  }

  validateDraft(){
    if(!this.system||!this.draftBar) return;
    const type=document.getElementById('barlineType')?.value||this.draftBar.type||'simple_barline';
    this.protocol.navigation.visual_markers.push({
      id:uid('nav'),
      kind:'barline',
      type,
      system_id:this.system.system_id,
      measure_id:'',
      x:Math.round(clamp(this.draftBar.x,0,this.system.bbox.w)),
      confidence:'manual'
    });
    this.mode=false;
    this.draftBar=null;
    this.draggingDraft=false;
    this.onChange();
  }

  moveDraft(delta){
    if(!this.draftBar||!this.system) return;
    this.draftBar.x=clamp(this.draftBar.x+delta,0,this.system.bbox.w);
    this.render();
  }

  barlines(){
    return this.protocol.navigation.visual_markers
      .filter(n=>n.system_id===this.system?.system_id && n.kind==='barline')
      .sort((a,b)=>a.x-b.x);
  }

  render(){
    this.wrap.innerHTML='';
    if(!this.page||!this.system){
      this.wrap.innerHTML='<p class="hint">Selecione um sistema.</p>';
      return;
    }

    const layer=document.createElement('div');
    layer.className='work-layer barline-work-layer';
    layer.style.width=this.system.bbox.w*this.zoom+'px';
    layer.style.height=this.system.bbox.h*this.zoom+'px';
    layer.style.touchAction='none';
    layer.addEventListener('contextmenu',e=>e.preventDefault());

    const img=document.createElement('img');
    img.src=this.page.image_src;
    img.style.width=this.page.width*this.zoom+'px';
    img.style.position='absolute';
    img.style.left=-this.system.bbox.x*this.zoom+'px';
    img.style.top=-this.system.bbox.y*this.zoom+'px';
    img.draggable=false;
    img.addEventListener('contextmenu',e=>e.preventDefault());
    layer.appendChild(img);

    // Existing confirmed barlines
    for(const b of this.barlines()){
      const el=document.createElement('div');
      el.className='barline confirmed-barline';
      el.style.left=b.x*this.zoom+'px';
      el.style.height=this.system.bbox.h*this.zoom+'px';
      el.title=b.type;
      layer.appendChild(el);
    }

    // Existing measures
    for(const m of this.protocol.measures.filter(m=>m.system_id===this.system.system_id)){
      const el=document.createElement('div');
      el.className='measure-box';
      el.style.left=(m.bbox.x-this.system.bbox.x)*this.zoom+'px';
      el.style.top='0px';
      el.style.width=m.bbox.w*this.zoom+'px';
      el.style.height=this.system.bbox.h*this.zoom+'px';
      el.title=`Compasso ${m.number}`;
      layer.appendChild(el);
    }

    if(this.mode && this.draftBar){
      const badge=document.createElement('div');
      badge.className='mode-badge';
      badge.textContent='Ajuste a barra vermelha e toque em Validar';
      layer.appendChild(badge);

      const draft=document.createElement('div');
      draft.className='draft-barline';
      draft.style.left=this.draftBar.x*this.zoom+'px';
      draft.style.height=this.system.bbox.h*this.zoom+'px';
      draft.setAttribute('role','slider');
      draft.setAttribute('aria-label','Barra de compasso em ajuste');
      layer.appendChild(draft);

      const handle=document.createElement('div');
      handle.className='draft-barline-handle';
      handle.style.left=this.draftBar.x*this.zoom+'px';
      handle.textContent='↔';
      layer.appendChild(handle);

      const setFromEvent=(e)=>{
        const rect=layer.getBoundingClientRect();
        const x=(e.clientX-rect.left)/this.zoom;
        this.draftBar.x=Math.round(clamp(x,0,this.system.bbox.w));
      };
      const start=(e)=>{e.preventDefault();this.draggingDraft=true;setFromEvent(e);this.render();};
      const move=(e)=>{if(!this.draggingDraft)return;e.preventDefault();setFromEvent(e);this.render();};
      const end=(e)=>{if(!this.draggingDraft)return;e.preventDefault();this.draggingDraft=false;this.render();};
      draft.addEventListener('pointerdown',start,{passive:false});
      handle.addEventListener('pointerdown',start,{passive:false});
      layer.addEventListener('pointermove',move,{passive:false});
      layer.addEventListener('pointerup',end,{passive:false});
      layer.addEventListener('pointercancel',end,{passive:false});

      const controls=document.createElement('div');
      controls.className='floating-bar-controls';
      controls.innerHTML=`
        <button type="button" data-action="left">← 1px</button>
        <button type="button" data-action="right">1px →</button>
        <button type="button" data-action="validate" class="primary">Validar barra</button>
        <button type="button" data-action="cancel" class="danger-light">Cancelar</button>
      `;
      controls.addEventListener('click',e=>{
        const btn=e.target.closest('button');
        if(!btn) return;
        const action=btn.dataset.action;
        if(action==='left') this.moveDraft(-1);
        if(action==='right') this.moveDraft(1);
        if(action==='validate') this.validateDraft();
        if(action==='cancel') this.cancelDraft();
      });
      layer.appendChild(controls);
    }

    this.wrap.appendChild(layer);
  }

  generateMeasures(meter='3/4'){
    if(!this.system)return;
    const bars=this.barlines();
    const xs=[0,...bars.map(b=>b.x),this.system.bbox.w]
      .filter((x,i,a)=>i===0||Math.abs(x-a[i-1])>4)
      .sort((a,b)=>a-b);
    const oldIds=this.protocol.measures.filter(m=>m.system_id===this.system.system_id).map(m=>m.measure_id);
    this.protocol.measures=this.protocol.measures.filter(m=>m.system_id!==this.system.system_id);
    let startNum=this.protocol.measures.length+1;
    for(let i=0;i<xs.length-1;i++){
      const w=xs[i+1]-xs[i];
      if(w<10) continue;
      this.protocol.measures.push({
        measure_id:uid('m'),
        system_id:this.system.system_id,
        number:startNum++,
        meter,
        is_anacrusis:false,
        bbox:{x:Math.round(this.system.bbox.x+xs[i]),y:this.system.bbox.y,w:Math.round(w),h:this.system.bbox.h},
        time_grid:timeGridForMeter(meter),
        markers:[],
        alignments:[],
        special_cases:[],
        alignment_warnings:[],
        confidence:'provável',
        review_required:false,
        review_status:'pending',
        notes:''
      });
    }
    this.protocol.navigation.visual_markers=this.protocol.navigation.visual_markers.map(n=> oldIds.includes(n.measure_id)?{...n,measure_id:''}:n);
    this.onChange();
  }
}

export function removeBarline(protocol, id){
  protocol.navigation.visual_markers=protocol.navigation.visual_markers.filter(n=>n.id!==id);
}
