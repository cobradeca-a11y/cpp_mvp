export function setupFileInput({input,onFile}){
  input.addEventListener('change', async e=>{const file=e.target.files?.[0]; if(!file) return; const ext=(file.name.split('.').pop()||'').toLowerCase(); const ok=['pdf','jpg','jpeg','png','webp'].includes(ext); if(!ok){alert('Tipo não aceito. Use PDF, JPG, PNG ou WEBP.'); return;} await onFile(file,ext);});
}
export function fileKind(ext){return ext==='pdf'?'pdf':'image';}
