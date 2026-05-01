import { uid, pushUndo } from "./cpp-json.js";
import { beatFromX } from "./music-models.js";
import { addManualAlignment } from "./alignment-engine.js";
import { scoreMeasureConfidence } from "./confidence-engine.js";

export async function renderMeasureReview({ container, protocol, page, system, measure, toast, onChange }) {
  container.innerHTML = "";
  if (!page || !system || !measure) {
    container.innerHTML = `<div class="info">Abra um compasso para revisar.</div>`;
    return null;
  }

  const img = new Image();
  img.src = page.image_src;
  await img.decode();

  const abs = {
    x: system.bbox.x + measure.bbox.x,
    y: system.bbox.y + measure.bbox.y,
    w: measure.bbox.w,
    h: measure.bbox.h
  };
  const c = document.createElement("canvas");
  c.width = Math.round(abs.w);
  c.height = Math.round(abs.h);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, abs.x, abs.y, abs.w, abs.h, 0, 0, c.width, c.height);

  const wrap = document.createElement("div");
  wrap.style.position = "relative";
  wrap.style.width = `${c.width}px`;
  wrap.style.height = `${c.height}px`;
  wrap.appendChild(c);
  container.appendChild(wrap);
  drawGrid(wrap, measure);
  drawMarkers(wrap, measure);

  function localPoint(ev) {
    const rect = wrap.getBoundingClientRect();
    return { x: ev.clientX - rect.left + container.scrollLeft, y: ev.clientY - rect.top + container.scrollTop };
  }

  wrap.addEventListener("contextmenu", ev => ev.preventDefault());
  wrap.addEventListener("click", ev => {
    if (!container.classList.contains("manual-marker-mode")) return;
    const p = localPoint(ev);
    const type = document.getElementById("markerType").value;
    const val = document.getElementById("markerValue").value.trim() || type;
    const marker = {
      marker_id: uid("mk"),
      type,
      value: val,
      x: Math.round(p.x),
      y: Math.round(p.y),
      beat: beatFromX(p.x, measure.bbox.w, measure.meter),
      confidence: "manual",
      source: "manual",
      duration: "",
      extra: {}
    };
    measure.markers.push(marker);
    pushUndo(protocol, { type: "create_marker", measure_id: measure.measure_id, marker_id: marker.marker_id });
    drawMarkers(wrap, measure);
    onChange?.();
    toast("Marcador criado.");
  });

  return {
    redraw() {
      drawGrid(wrap, measure);
      drawMarkers(wrap, measure);
    }
  };
}

function drawGrid(wrap, measure) {
  wrap.querySelectorAll(".time-grid-line,.time-grid-label").forEach(e => e.remove());
  const grid = measure.time_grid || [];
  grid.forEach((g, i) => {
    const x = grid.length > 1 ? (measure.bbox.w * i / (grid.length - 1)) : 0;
    const l = document.createElement("div");
    l.className = "time-grid-line";
    l.style.left = `${x}px`;
    wrap.appendChild(l);
    const label = document.createElement("div");
    label.className = "time-grid-label";
    label.style.left = `${x}px`;
    label.textContent = g;
    wrap.appendChild(label);
  });
}

function drawMarkers(wrap, measure) {
  wrap.querySelectorAll(".marker,.marker-label").forEach(e => e.remove());
  for (const m of measure.markers || []) {
    const d = document.createElement("div");
    d.className = `marker ${m.type}`;
    d.style.left = `${m.x}px`;
    d.style.top = `${m.y}px`;
    d.title = `${m.type}: ${m.value}`;
    d.onclick = ev => {
      ev.stopPropagation();
      d.classList.toggle("selected");
      const selected = measure._selectedMarkers ||= new Set();
      selected.has(m.marker_id) ? selected.delete(m.marker_id) : selected.add(m.marker_id);
    };
    wrap.appendChild(d);
    const lab = document.createElement("div");
    lab.className = "marker-label";
    lab.style.left = `${m.x}px`;
    lab.style.top = `${m.y}px`;
    lab.textContent = m.value;
    wrap.appendChild(lab);
  }
}

export function acceptMeasure(measure) {
  measure.review_status = "approved";
  measure.review_required = false;
  if (measure.confidence === "incerto") measure.confidence = "provável";
}

export function markMeasureUncertain(measure) {
  measure.review_status = "needs_fix";
  measure.review_required = true;
  measure.confidence = "incerto";
}

export function createSelectedAlignment(protocol, measure, alignmentType) {
  const ids = Array.from(measure._selectedMarkers || []);
  const chord = measure.markers.find(m => ids.includes(m.marker_id) && m.type === "chord");
  const syll = measure.markers.find(m => ids.includes(m.marker_id) && m.type === "syllable");
  const note = measure.markers.find(m => ids.includes(m.marker_id) && m.type === "note_head");
  if (!chord) return null;
  const al = addManualAlignment(measure, {
    alignment_type: alignmentType,
    chord_marker_id: chord.marker_id,
    syllable_marker_id: syll?.marker_id || "",
    note_marker_id: note?.marker_id || "",
    beat: chord.beat,
    source: "manual"
  });
  if (al) {
    pushUndo(protocol, { type: "create_alignment", measure_id: measure.measure_id, alignment_id: al.alignment_id });
    scoreMeasureConfidence(measure);
  }
  return al;
}
