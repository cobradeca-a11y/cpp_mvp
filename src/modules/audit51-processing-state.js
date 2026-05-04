const AUDIT51_BUILD = "audit-51-cache-v1";

function byId(id) {
  return document.getElementById(id);
}

function inferStageFromText(text) {
  const value = String(text || "").toLowerCase();
  if (value.includes("processamento concluído") || value.includes("processamento concluido")) return "concluído";
  if (value.includes("erro") || value.includes("falha")) return "falha";
  if (value.includes("enviando")) return "enviando ao backend";
  if (value.includes("aguardando")) return "aguardando arquivo";
  if (value.includes("status omr") || value.includes("status ocr")) return "recebendo resultado";
  return "observando";
}

function currentFileName() {
  const input = byId("fileInput");
  return input?.files?.[0]?.name || "nenhum arquivo selecionado";
}

function isTerminalStage(stage) {
  return stage === "concluído" || stage === "falha" || stage === "aguardando arquivo";
}

function createPanel() {
  if (byId("processingStateAudit51")) return;
  const status = byId("processingStatus");
  const host = status?.closest?.(".card");
  if (!host) return;

  const panel = document.createElement("div");
  panel.id = "processingStateAudit51";
  panel.className = "card";
  panel.innerHTML = `
    <h3>Fila e estado de processamento</h3>
    <p class="hint">Auditoria 51: mostra a etapa operacional e evita duplo processamento simultâneo. Não altera evidências musicais.</p>
    <pre id="processingStateReport" class="report small-report">Fila: vazia\nEtapa: aguardando arquivo\nProcessamento ativo: não</pre>
  `;
  host.insertAdjacentElement("afterend", panel);
}

function renderState(stage, extra = {}) {
  createPanel();
  const report = byId("processingStateReport");
  if (!report) return;

  const active = extra.active ?? !isTerminalStage(stage);
  const queue = active ? "1 item em processamento" : "vazia";
  const lines = [
    `Fila: ${queue}`,
    `Etapa: ${stage}`,
    `Processamento ativo: ${active ? "sim" : "não"}`,
    `Arquivo: ${extra.fileName || currentFileName()}`,
    `Atualizado em: ${new Date().toISOString()}`,
    "Audit: audit-51",
  ];

  if (extra.warning) lines.push(`Aviso: ${extra.warning}`);
  report.textContent = lines.join("\n");
}

function appendOperationalNotice(message) {
  const log = byId("frontendErrorLog");
  if (!log) return;
  const previous = log.textContent?.trim();
  const entry = [
    "[Aviso operacional]",
    "Código: processing_state_guard",
    `Mensagem: ${message}`,
    "Audit: audit-51",
    `Data: ${new Date().toISOString()}`,
  ].join("\n");

  log.textContent = previous && previous !== "Nenhum erro operacional registrado nesta sessão."
    ? `${entry}\n\n---\n\n${previous}`
    : entry;
}

function guardDoubleProcessing() {
  const button = byId("btnProfessionalOmr");
  if (!button) return;

  button.addEventListener("click", event => {
    if (button.disabled) {
      event.preventDefault();
      event.stopPropagation();
      renderState("processando", {
        active: true,
        warning: "Processamento já em andamento; novo clique ignorado.",
      });
      appendOperationalNotice("Clique de processamento ignorado porque já existe uma execução ativa.");
      return;
    }

    const file = byId("fileInput")?.files?.[0];
    if (file) {
      renderState("arquivo na fila", { active: true, fileName: file.name });
    }
  }, true);
}

function observeProcessingStatus() {
  const status = byId("processingStatus");
  if (!status) return;

  const sync = () => {
    const stage = inferStageFromText(status.textContent);
    renderState(stage);
  };

  const observer = new MutationObserver(sync);
  observer.observe(status, { childList: true, characterData: true, subtree: true });
  sync();
}

function markBuild() {
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT51_BUILD}`;
}

function initAudit51ProcessingState() {
  markBuild();
  createPanel();
  guardDoubleProcessing();
  observeProcessingStatus();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudit51ProcessingState);
} else {
  initAudit51ProcessingState();
}
