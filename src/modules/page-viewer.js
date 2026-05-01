import { uid, pushUndo } from './cpp-json.js';

export class PageViewer{
  constructor(wrap, protocol, onChange){
    this.wrap=wrap;
    this.protocol=protocol;
    this.onChange=onChange;
    this.zoom=1;
    this.mode=null;
    this.drag=null;
    this.page=null;
    this.pointerId=null;
  }
  setPage(page){this.page=page;this.render();}
  setZoom(z){this.zoom=Number(z);this.render();}
  enableSystemSelection(){this.mode='system';this.render();}
  render(){
    this.wrap.innerHTML='';
    if(!this.page){this.wrap.innerHTML='<p class="hint">Carregue uma página.</p>';return;}
    const layer=document.createElement('div');
    layer.className='work-layer selection-layer';
    layer.style.width=`${this.page.width*this.zoom}px`;
    layer.style.height=`${this.page.height*this.zoom}px`;
    layer.style.touchAction=this.mode==='system'?'none':'auto';

    const img=document.createElement('img');
    img.src=this.page.image_src;
    img.style.width=`${this.page.width*this.zoom}px`;
    img.draggable=false;
    layer.appendChild(img);

    for(const s of this.protocol.systems.filter(x=>x.page_id===this.page.page_id)){
      const r=document.createElement('div');
      r.className='rect';
      r.style.left=s.bbox.x*this.zoom+'px';
      r.style.top=s.bbox.y*this.zoom+'px';
      r.style.width=s.bbox.w*this.zoom+'px';
      r.style.height=s.bbox.h*this.zoom+'px';
      r.title=`Sistema ${s.number}`;
      layer.appendChild(r);
    }

    if(this.mode==='system'){
      const badge=document.createElement('div');
      badge.className='mode-badge';
      badge.textContent='Modo seleção: toque/arraste sobre um sistema';
      layer.appendChild(badge);
    }

    layer.addEventListener('pointerdown',e=>{
      if(this.mode!=='system')return;
      e.preventDefault();
      this.pointerId=e.pointerId;
      layer.setPointerCapture?.(e.pointerId);
      const p=this.pt(e,layer);
      this.drag={x:p.x,y:p.y,el:document.createElement('div')};
      this.drag.el.className='rect active-rect';
      this.drag.el.style.left=p.x*this.zoom+'px';
      this.drag.el.style.top=p.y*this.zoom+'px';
      this.drag.el.style.width='1px';
      this.drag.el.style.height='1px';
      layer.appendChild(this.drag.el);
    },{passive:false});

    layer.addEventListener('pointermove',e=>{
      if(!this.drag)return;
      e.preventDefault();
      const p=this.pt(e,layer);
      const x=Math.min(p.x,this.drag.x),y=Math.min(p.y,this.drag.y),w=Math.abs(p.x-this.drag.x),h=Math.abs(p.y-this.drag.y);
      Object.assign(this.drag.el.style,{left:x*this.zoom+'px',top:y*this.zoom+'px',width:w*this.zoom+'px',height:h*this.zoom+'px'});
    },{passive:false});

    const finish=(e)=>{
      if(!this.drag)return;
      e.preventDefault();
      const p=this.pt(e,layer);
      const x=Math.min(p.x,this.drag.x),y=Math.min(p.y,this.drag.y),w=Math.abs(p.x-this.drag.x),h=Math.abs(p.y-this.drag.y);
      this.drag.el.remove();
      this.drag=null;
      if(this.pointerId!==null){try{layer.releasePointerCapture?.(this.pointerId);}catch{} this.pointerId=null;}
      if(w>20&&h>20){
        const system={system_id:uid('s'),page_id:this.page.page_id,number:this.protocol.systems.filter(s=>s.page_id===this.page.page_id).length+1,bbox:{x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)}};
        this.protocol.systems.push(system);
        pushUndo(this.protocol,{type:'create_system',id:system.system_id});
        this.mode=null;
        this.onChange();
      }else{
        alert('Arraste um retângulo maior sobre uma linha/sistema da partitura.');
      }
    };
    layer.addEventListener('pointerup',finish,{passive:false});
    layer.addEventListener('pointercancel',finish,{passive:false});

    this.wrap.appendChild(layer);
  }
  pt(e,layer){const rect=layer.getBoundingClientRect();return{x:(e.clientX-rect.left)/this.zoom,y:(e.clientY-rect.top)/this.zoom};}
}
