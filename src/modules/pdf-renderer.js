export async function renderPDFFile(file, scale=2.5){
  if(!window.pdfjsLib) throw new Error('PDF.js não carregou. Verifique a conexão ou baixe a biblioteca localmente.');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const buf=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data:buf}).promise;
  const pages=[];
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i); const viewport=page.getViewport({scale});
    const canvas=document.createElement('canvas'); canvas.width=viewport.width; canvas.height=viewport.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    pages.push({page_id:`p${String(i).padStart(3,'0')}`,page_number:i,image_src:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height});
  }
  return pages;
}
export async function renderImageFile(file){
  const src=URL.createObjectURL(file);
  const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=src;});
  const canvas=document.createElement('canvas'); canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
  canvas.getContext('2d').drawImage(img,0,0);
  URL.revokeObjectURL(src);
  return [{page_id:'p001',page_number:1,image_src:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height}];
}
