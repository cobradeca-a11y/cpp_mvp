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
    (system.bars || []).forEach((b) => {
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

      const panel = document.createElement("div");
      panel.className = `adjust-panel ${activeState === "locked" ? "locked-panel" : ""}`;
      panel.style.left = `${Math.max(4, Math.min(c.width - 260, activeBar.x + 18))}px`;
      panel.style.top = "8px";
      if (activeState === "locked") {
        panel.innerHTML = `<span class="bar-label">x:${Math.round(activeBar.x)} posicionada</span>
          <button data-bar-act="edit" type="button">Editar</button>
          <button data-bar-act="validate" type="button">Validar</button>`;
      } else {
        panel.innerHTML = `<span class="bar-label">x:${Math.round(activeBar.x)}</span>
          <button data-bar-act="left10" type="button">←10</button>
          <button data-bar-act="left1" type="button">←1</button>
          <button data-bar-act="right1" type="button">1→</button>
          <button data-bar-act="right10" type="button">10→</button>
          <button data-bar-act="lock" type="button">Posicionar</button>`;
      }
      wrap.appendChild(panel);
      panel.querySelectorAll("button").forEach(btn => {
        btn.onclick = ev => {
          ev.stopPropagation();
          const act = btn.dataset.barAct;
          if (act === "left10") activeBar.x = Math.max(0, activeBar.x - 10);
          if (act === "left1") activeBar.x = Math.max(0, activeBar.x - 1);
          if (act === "right1") activeBar.x = Math.min(c.width, activeBar.x + 1);
          if (act === "right10") activeBar.x = Math.min(c.width, activeBar.x + 10);
          if (act === "lock") activeState = "locked";
          if (act === "edit") activeState = "editing";
          if (act === "validate") api.validateActive();
          draw();
        };
      });
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

  const api = {
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
      const suggested = xs.map((x, i) => ({
        id: uid("bar"),
        x,
        type: i === 0 ? "initial_barline" : (i === xs.length - 1 ? "system_end" : "simple_barline"),
        source: "auto"
      }));

      const existing = system.bars || [];
      const merged = [...existing];
      for (const b of suggested) {
        if (!merged.some(e => Math.abs(e.x - b.x) < 10)) merged.push(b);
      }
      merged.sort((a,b) => a.x - b.x);
      system.bars = merged;

      if (suggested.length <= 2) toast("Poucas barras detectadas. Adicione/ajuste manualmente.");
      else toast(`${suggested.length} barras sugeridas. Ajuste só as erradas.`);

      generateMeasuresForSystem(protocol, system);
      draw();
      onChange?.();
    }
  };
  return api;
}

export function detectVerticalBars(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width:w, height:h } = canvas;
  const img = ctx.getImageData(0,0,w,h);
  const data = img.data;

  const darkAt = (x,y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const i = (Math.floor(y)*w + Math.floor(x))*4;
    const lum = (data[i]+data[i+1]+data[i+2])/3;
    return lum < 105;
  };

  const staff = detectStaffLines(canvas);
  if (!staff || staff.lines.length < 5) return fallbackVerticalBars(canvas);

  const lines = staff.lines;
  const top = Math.max(0, Math.round(lines[0] - staff.spacing * 0.6));
  const bottom = Math.min(h - 1, Math.round(lines[4] + staff.spacing * 0.6));
  const bandH = Math.max(1, bottom - top);

  const candidates = [];
  for (let x = 2; x < w - 2; x++) {
    let staffHits = 0;
    for (const y of lines) {
      let hit = false;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) if (darkAt(x + dx, y + dy)) hit = true;
      }
      if (hit) staffHits++;
    }

    let verticalDark = 0;
    let longestRun = 0;
    let run = 0;
    for (let y = top; y <= bottom; y++) {
      if (darkAt(x, y) || darkAt(x-1, y) || darkAt(x+1, y)) {
        verticalDark++;
        run++;
        longestRun = Math.max(longestRun, run);
      } else run = 0;
    }

    if (staffHits >= 5 && verticalDark >= bandH * 0.42 && longestRun >= bandH * 0.30) candidates.push(x);
  }

  const groups = groupClose(candidates, 3)
    .map(g => Math.round(g.reduce((a,b)=>a+b,0)/g.length))
    .filter(x => x > 8 && x < w - 8);

  const filtered = [];
  for (const x of groups) {
    if (!filtered.length || Math.abs(x - filtered[filtered.length - 1]) > Math.max(14, staff.spacing * 0.9)) filtered.push(x);
  }

  return uniqueSorted([0, ...filtered, w], 12);
}

function detectStaffLines(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width:w, height:h } = canvas;
  const data = ctx.getImageData(0,0,w,h).data;
  const rowScores = [];

  for (let y = 0; y < h; y++) {
    let dark = 0;
    for (let x = Math.floor(w * 0.04); x < Math.floor(w * 0.96); x++) {
      const i = (y*w + x)*4;
      const lum = (data[i]+data[i+1]+data[i+2])/3;
      if (lum < 115) dark++;
    }
    if (dark > w * 0.18) rowScores.push(y);
  }

  const rowGroups = groupClose(rowScores, 2).map(g => Math.round(g.reduce((a,b)=>a+b,0)/g.length));
  if (rowGroups.length < 5) return null;

  let best = null;
  for (let i = 0; i <= rowGroups.length - 5; i++) {
    const pack = rowGroups.slice(i, i+5);
    const gaps = [pack[1]-pack[0], pack[2]-pack[1], pack[3]-pack[2], pack[4]-pack[3]];
    const avg = gaps.reduce((a,b)=>a+b,0)/gaps.length;
    const variance = gaps.reduce((a,b)=>a+Math.abs(b-avg),0)/gaps.length;
    if (avg < 5 || avg > 80) continue;
    const score = variance;
    if (!best || score < best.score) best = { lines: pack, spacing: avg, score };
  }
  return best;
}

function fallbackVerticalBars(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width:w, height:h } = canvas;
  const data = ctx.getImageData(0,0,w,h).data;
  const scores = [];
  for (let x=0; x<w; x++) {
    let dark = 0;
    for (let y=Math.floor(h*0.18); y<Math.floor(h*0.82); y++) {
      const i = (y*w + x)*4;
      const lum = (data[i]+data[i+1]+data[i+2])/3;
      if (lum < 75) dark++;
    }
    if (dark > h*0.34) scores.push(x);
  }
  const groups = groupClose(scores, 3).map(g => Math.round(g.reduce((a,b)=>a+b,0)/g.length));
  return uniqueSorted([0, ...groups, w], 14);
}

function groupClose(values, maxGap = 2) {
  const groups = [];
  let cur = [];
  for (const x of values) {
    if (!cur.length || x <= cur[cur.length-1] + maxGap) cur.push(x);
    else { groups.push(cur); cur = [x]; }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

function uniqueSorted(values, minDist = 10) {
  const sorted = values.map(x => Math.round(x)).sort((a,b)=>a-b);
  const out = [];
  for (const x of sorted) if (!out.length || Math.abs(x - out[out.length - 1]) >= minDist) out.push(x);
  return out;
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
