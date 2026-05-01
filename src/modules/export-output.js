import { downloadJSON, downloadText } from './cpp-json.js';
let counters={json:1,tech:1,play:1,report:1};
function slug(title){return (title||'musica').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'').toLowerCase()||'musica';}
function v(n){return String(n).padStart(3,'0');}
export function exportJson(protocol){downloadJSON(`${slug(protocol.music.title)}_protocol_v${v(counters.json++)}.json`,protocol);}
export function exportTechnical(protocol){downloadText(`${slug(protocol.music.title)}_cifra_tecnica_v${v(counters.tech++)}.txt`,protocol.outputs.technical_chord_sheet||'');}
export function exportPlayable(protocol){downloadText(`${slug(protocol.music.title)}_cifra_tocavel_v${v(counters.play++)}.txt`,protocol.outputs.playable_chord_sheet||'');}
export function exportReport(protocol){downloadText(`${slug(protocol.music.title)}_relatorio_incertezas_v${v(counters.report++)}.txt`,protocol.outputs.uncertainty_report||'');}
export function exportAll(protocol){exportJson(protocol);exportTechnical(protocol);exportPlayable(protocol);exportReport(protocol);}
