import { uid } from "./cpp-json.js";
import { timeGridForMeter } from "./music-models.js";

export async function renderSystemViewer({ container, protocol, page, system, onChange, toast }) {
  container.innerHTML = "";
  if (!page || !system) {
    container.innerHTML = `<div class="info">Selecione um sistema.</div>`;
    return null;
  }

  const img = new Image();
  img.src = page.image_src;
  await img.decode();

  const c = document.createElement("canvas");
  c.width = Math.round(system.bbox.w);
  c.height = Math.round(system.bbox.h);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, system.bbox.x, system.bbox.y, system.bbox.w, system.bbox.h, 0, 0, c.width, c.height);

  const wrap = document.createElement("div");
  wrap.style.position = "relative";
  wrap.style.width = `${c.width}px`;
  wrap.style.height = `${c.height}px`;
  wrap.appendChild(c);
  container.appendChild(wrap);

  let activeBar = null;
  let activeState = "none";

  function draw() {
    wrap.querySelectorAll(".barline,.bar-hit,.adjust-panel").forEach(e => e.remove());
    (system.bars || []).forEach((b, idx) => {
      const line = document.createElement("div");
      line.className = "barline valid";
      Object.assign(line.style, { left:`${b.x}px`, height:`${c.height}px` });
      wrap.appendChild(line);
    });
    if (activeBar) {
      const line = document.createElement("div");
      line.className = `barline ${activeState === "locked" ? "locked" : ""}`;
      Object.assign(line.style, { left:`${activeBar.x}px`, height:`${c.height}px` });
      wrap.appendChild(line);

      const hit = document.createElement("div");
      hit.className = "bar-hit";
      Object.assign(hit.style, { left:`${activeBar.x}px`, height:`${c.height}px` });
      wrap.appendChild(hit);

      if (activeState !== "locked") {
        const panel = document.createElement("div");
        panel.className = "adjust-panel";
        panel.style.left = `${Math.min(c.width - 180, activeBar.x + 18)}px`;
        panel.style.top = "8px";
        panel.innerHTML = `<span class="bar-label">x:${Math.round(activeBar.x)}</span>`;
        wrap.appendChild(panel);
      }
    }
  }

  function localX(ev) {
    const rect = wrap.getBoundingClientRect();
    return ev.clientX - rect.left + container.scrollLeft;
  }

  let dragging = false;
  wrap.addEventListener("contextmenu", ev => ev.preventDefault());
  wrap.addEventListener("pointerdown", ev => {
    if (!activeBar || activeState === "locked") return;
    dragging = true;
    activeBar.x = Math.max(0, Math.min(c.width, localX(ev)));
    draw();
    ev.preventDefault();
  }, { passive: false });
  wrap.addEventListener("pointermove", ev => {
    if (!dragging || !activeBar || activeState === "locked") return;
    activeBar.x = Math.max(0, Math.min(c.width, localX(ev)));
    draw();
    ev.preventDefault();
  }, { passive: false });
  wrap.addEventListener("pointerup", () => dragging = false);

  draw();

  return {
    canvas: c,
    addBar() {
      const x = container.scrollLeft + container.clientWidth / 2;
      activeBar = { id: uid("bar"), x: Math.max(0, Math.min(c.width, x)), type: "simple_barline" };
      activeState = "editing";
      draw();
    },
    moveActive(delta) {
      if (!activeBar || activeState === "locked") return;
      activeBar.x = Math.max(0, Math.min(c.width, activeBar.x + delta));
      draw();
    },
    positionActive() {
      if (!activeBar) return;
      activeState = "locked";
      draw();
      toast("Barra posicionada. Confira e valide ou edite.");
    },
    editActive() {
      if (!activeBar) return;
      activeState = "editing";
      draw();
    },
    validateActive() {
      if (!activeBar) return;
      system.bars ||= [];
      system.bars.push({ ...activeBar, x: Math.round(activeBar.x), type: activeBar.type || "simple_barline" });
      system.bars.sort((a,b) => a.x - b.x);
      activeBar = null;
      activeState = "none";
      generateMeasuresForSystem(protocol, system);
      draw();
      onChange?.();
      toast("Barra validada e compassos recalculados.");
    },
    generateAutoBars() {
      const xs = detectVerticalBars(c);
      system.bars = xs.map((x, i) => ({ id: uid("bar"), x, type: "simple_barline", source: "auto" }));
      if (system.bars.length < 2) {
        system.bars = [
          { id: uid("bar"), x: 0, type: "initial_barline", source: "auto" },
          { id: uid("bar"), x: c.width, type: "final_barline", source: "auto" }
        ];
        toast("Poucas barras detectadas. Adicione/ajuste manualmente.");
      } else {
        toast(`${system.bars.length} barras sugeridas.`);
      }
      generateMeasuresForSystem(protocol, system);
      draw();
      onChange?.();
    }
  };
}

export function detectVerticalBars(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width:w, height:h } = canvas;
  const data = ctx.getImageData(0,0,w,h).data;
  const scores = [];
  for (let x=0; x<w; x++) {
    let dark = 0;
    for (let y=Math.floor(h*0.12); y<Math.floor(h*0.88); y++) {
      const i = (y*w + x)*4;
      const lum = (data[i]+data[i+1]+data[i+2])/3;
      if (lum < 80) dark++;
    }
    if (dark > h*0.18) scores.push(x);
  }
  const groups = [];
  let cur = [];
  for (const x of scores) {
    if (!cur.length || x <= cur[cur.length-1]+2) cur.push(x);
    else { groups.push(cur); cur = [x]; }
  }
  if (cur.length) groups.push(cur);
  const xs = groups.map(g => Math.round(g.reduce((a,b)=>a+b,0)/g.length))
    .filter(x => x > 2 && x < w-2);
  const final = [0, ...xs, w].filter((x,i,a)=> i===0 || Math.abs(x-a[i-1])>12);
  return final;
}

export function generateMeasuresForSystem(protocol, system) {
  protocol.measures = protocol.measures.filter(m => m.system_id !== system.system_id);
  const bars = (system.bars || []).slice().sort((a,b) => a.x - b.x);
  if (bars.length < 2) return [];
  const meter = protocol.music.meter_default || "3/4";
  const existingCount = protocol.measures.length;
  const created = [];
  for (let i=0; i<bars.length-1; i++) {
    const x1 = bars[i].x, x2 = bars[i+1].x;
    if (x2 - x1 < 15) continue;
    const m = {
      measure_id: uid("m"),
      system_id: system.system_id,
      number: existingCount + created.length + 1,
      meter,
      is_anacrusis: i === 0 && x2-x1 < (system.bbox.w / Math.max(2, bars.length-1)) * 0.65,
      bbox: { x: Math.round(x1), y: 0, w: Math.round(x2-x1), h: Math.round(system.bbox.h) },
      time_grid: timeGridForMeter(meter),
      detected_elements: { chords: [], syllables: [], note_heads: [], rests: [], navigation: [], special_cases: [] },
      markers: [],
      alignments: [],
      special_cases: [],
      alignment_warnings: [],
      confidence: "provável",
      review_required: false,
      review_status: "pending",
      notes: ""
    };
    created.push(m);
  }
  protocol.measures.push(...created);
  system.detected_summary ||= {};
  system.detected_summary.measure_count = created.length;
  return created;
}
