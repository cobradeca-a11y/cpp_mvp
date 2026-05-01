import { uid } from "./cpp-json.js";

export function renderPageViewer({ container, protocol, page, onSystemsChange, toast }) {
  container.innerHTML = "";
  if (!page) {
    container.innerHTML = `<div class="info">Nenhuma página renderizada.</div>`;
    return;
  }

  const wrap = document.createElement("div");
  wrap.style.position = "relative";
  wrap.style.width = `${page.width}px`;
  wrap.style.height = `${page.height}px`;
  wrap.dataset.zoom = "1";

  const img = document.createElement("img");
  img.src = page.image_src;
  img.draggable = false;
  img.style.width = `${page.width}px`;
  img.style.height = `${page.height}px`;
  wrap.appendChild(img);

  container.appendChild(wrap);
  drawSystems(wrap, protocol, page.page_id);

  let selecting = false;
  let twoTap = false;
  let start = null;
  let draft = null;

  function localPoint(ev) {
    const rect = wrap.getBoundingClientRect();
    const z = Number(wrap.dataset.zoom || 1);
    return {
      x: (ev.clientX - rect.left) / z,
      y: (ev.clientY - rect.top) / z
    };
  }

  function createSystemFromPoints(a, b) {
    const x = Math.max(0, Math.min(a.x, b.x));
    const y = Math.max(0, Math.min(a.y, b.y));
    const w = Math.abs(a.x - b.x);
    const h = Math.abs(a.y - b.y);
    if (w < 30 || h < 20) {
      toast("Seleção pequena demais.");
      return;
    }
    protocol.systems.push({
      system_id: uid("s"),
      page_id: page.page_id,
      number: protocol.systems.filter(s => s.page_id === page.page_id).length + 1,
      bbox: { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) },
      status: "pending_analysis",
      bars: [],
      detected_summary: { meter: "", key_signature: "", tempo: "", measure_count: 0, chords: [], lyrics: [], navigation: [], warnings: [] }
    });
    if (draft) draft.remove();
    draft = null;
    selecting = false;
    start = null;
    drawSystems(wrap, protocol, page.page_id);
    onSystemsChange?.();
    toast("Sistema criado.");
  }

  wrap.addEventListener("contextmenu", ev => ev.preventDefault());
  wrap.addEventListener("pointerdown", ev => {
    if (!container.classList.contains("select-system-mode")) return;
    ev.preventDefault();
    const p = localPoint(ev);
    if (container.classList.contains("two-tap-mode")) {
      if (!start) {
        start = p;
        toast("Primeiro ponto marcado. Toque no canto oposto.");
      } else {
        createSystemFromPoints(start, p);
      }
      return;
    }
    selecting = true;
    start = p;
    draft = document.createElement("div");
    draft.className = "draft-box";
    wrap.appendChild(draft);
  }, { passive: false });

  wrap.addEventListener("pointermove", ev => {
    if (!selecting || !start || !draft) return;
    ev.preventDefault();
    const p = localPoint(ev);
    const x = Math.min(start.x, p.x), y = Math.min(start.y, p.y);
    const w = Math.abs(start.x - p.x), h = Math.abs(start.y - p.y);
    Object.assign(draft.style, { left:`${x}px`, top:`${y}px`, width:`${w}px`, height:`${h}px` });
  }, { passive: false });

  wrap.addEventListener("pointerup", ev => {
    if (!selecting || !start) return;
    ev.preventDefault();
    const p = localPoint(ev);
    createSystemFromPoints(start, p);
  }, { passive: false });

  return {
    setZoom(z) {
      wrap.dataset.zoom = String(z);
      wrap.style.transformOrigin = "top left";
      wrap.style.transform = `scale(${z})`;
      container.firstChild.style.marginBottom = `${page.height * (z - 1)}px`;
      container.firstChild.style.marginRight = `${page.width * (z - 1)}px`;
    },
    enableSelect(two = false) {
      container.classList.add("select-system-mode");
      container.classList.toggle("two-tap-mode", two);
      twoTap = two;
      start = null;
      toast(two ? "Modo 2 toques: toque no canto superior esquerdo." : "Arraste para selecionar sistema.");
    },
    cancelSelect() {
      container.classList.remove("select-system-mode", "two-tap-mode");
      start = null;
      if (draft) draft.remove();
    }
  };
}

export function drawSystems(wrap, protocol, pageId) {
  wrap.querySelectorAll(".system-box").forEach(e => e.remove());
  protocol.systems.filter(s => s.page_id === pageId).forEach(s => {
    const d = document.createElement("div");
    d.className = "system-box";
    Object.assign(d.style, { left:`${s.bbox.x}px`, top:`${s.bbox.y}px`, width:`${s.bbox.w}px`, height:`${s.bbox.h}px` });
    d.title = `Sistema ${s.number}`;
    wrap.appendChild(d);
  });
}
