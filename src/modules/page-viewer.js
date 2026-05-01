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
    this.tapStart=null;
    this.moved=false;
  }
  setPage(page){this.page=page;this.render();}
  setZoom(z){this.zoom=Number(z);this.render();}
  enableSystemSelection(){
    this.mode='system';
    this.tapStart=null;
    this.render();
  }
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
    img.alt='Página da partitura';
    img.style.width=`${this.page.width*this.zoom}px`;
    img.draggable=false;
    img.addEventListener('contextmenu',e=>e.preventDefault());
    img.addEventListener('dragstart',e=>e.preventDefault());
    layer.appendChild(img);

    layer.addEventListener('contextmenu',e=>e.preventDefault());

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

    if(this.tapStart){
      const dot=document.createElement('div');
      dot.className='tap-start-dot';
      dot.style.left=this.tapStart.x*this.zoom+'px';
      dot.style.top=this.tapStart.y*this.zoom+'px';
      dot.textContent='1';
      layer.appendChild(dot);
    }

    if(this.mode==='system'){
      const badge=document.createElement('div');
      badge.className='mode-badge';
      badge.textContent=this.tapStart?'Toque no canto inferior direito do sistema':'Modo seleção: arraste ou toque 2 pontos';
      layer.appendChild(badge);
    }

    layer.addEventListener('pointerdown',e=>{
      if(this.mode!=='system')return;
      e.preventDefault();
      e.stopPropagation();
      this.moved=false;
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
      e.stopPropagation();
      const p=this.pt(e,layer);
      const x=Math.min(p.x,this.drag.x),y=Math.min(p.y,this.drag.y),w=Math.abs(p.x-this.drag.x),h=Math.abs(p.y-this.drag.y);
      if(w>6||h>6) this.moved=true;
      Object.assign(this.drag.el.style,{left:x*this.zoom+'px',top:y*this.zoom+'px',width:w*this.zoom+'px',height:h*this.zoom+'px'});
    },{passive:false});

    const finish=(e)=>{
      if(!this.drag)return;
      e.preventDefault();
      e.stopPropagation();
      const p=this.pt(e,layer);
      const sx=this.drag.x, sy=this.drag.y;
      const x=Math.min(p.x,sx),y=Math.min(p.y,sy),w=Math.abs(p.x-sx),h=Math.abs(p.y-sy);
      this.drag.el.remove();
      this.drag=null;
      if(this.pointerId!==null){try{layer.releasePointerCapture?.(this.pointerId);}catch{} this.pointerId=null;}

      if(this.moved && w>20 && h>20){
        this.createSystem(x,y,w,h);
        return;
      }

      // Fallback mobile: two-tap selection. First tap = top-left, second tap = bottom-right.
      if(!this.tapStart){
        this.tapStart={x:p.x,y:p.y};
        this.render();
        return;
      }
      const tx=Math.min(this.tapStart.x,p.x), ty=Math.min(this.tapStart.y,p.y), tw=Math.abs(p.x-this.tapStart.x), th=Math.abs(p.y-this.tapStart.y);
      if(tw>20 && th>20){
        this.tapStart=null;
        this.createSystem(tx,ty,tw,th);
      }else{
        this.tapStart={x:p.x,y:p.y};
        this.render();
      }
    };
    layer.addEventListener('pointerup',finish,{passive:false});
    layer.addEventListener('pointercancel',finish,{passive:false});

    this.wrap.appendChild(layer);
  }
  createSystem(x,y,w,h){
    const system={system_id:uid('s'),page_id:this.page.page_id,number:this.protocol.systems.filter(s=>s.page_id===this.page.page_id).length+1,bbox:{x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)}};
    this.protocol.systems.push(system);
    pushUndo(this.protocol,{type:'create_system',id:system.system_id});
    this.mode=null;
    this.tapStart=null;
    this.onChange();
  }
  pt(e,layer){const rect=layer.getBoundingClientRect();return{x:(e.clientX-rect.left)/this.zoom,y:(e.clientY-rect.top)/this.zoom};}
}
