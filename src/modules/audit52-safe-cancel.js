const AUDIT52_BUILD = "audit-52-cache-v1";

let activeAnalyzeController = null;
let cancelRequested = false;
let originalFetch = window.fetch.bind(window);

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const target = byId(id);
  if (target) target.textContent = value;
}

function appendOperationalNotice(message) {
  const log = byId("frontendErrorLog");
  if (!log) return;
  const previous = log.textContent?.trim();
  const entry = [
    "[Aviso operacional]",
    "Código: processing_cancel",
    `Mensagem: ${message}`,
    "Audit: audit-52",
    `Data: ${new Date().toISOString()}`,
  ].join("\n");

  log.textContent = previous && previous !== "Nenhum erro operacional registrado nesta sessão."
    ? `${entry}\n\n---\n\n${previous}`
    : entry;
}

function createCancelPanel() {
  if (byId("processingCancelAudit52")) return;
  const queuePanel = byId("processingStateAudit51");
  const statusCard = byId("processingStatus")?.closest?.(".card");
  const anchor = queuePanel || statusCard;
  if (!anchor) return;

  const panel = document.createElement("div");
  panel.id = "processingCancelAudit52";
  panel.className = "card";
  panel.innerHTML = `
    <h3>Cancelamento seguro</h3>
    <p class="hint">Auditoria 52: permite solicitar cancelamento de processamento preso. O cancelamento não altera evidências musicais.</p>
    <div class="toolbar">
      <button id="btnCancelProcessing" class="warn" disabled>Cancelar processamento</button>
    </div>
    <pre id="processingCancelStatus" class="report small-report">Cancelamento: indisponível\nMotivo: nenhum processamento ativo\nAudit: audit-52</pre>
  `;
  anchor.insertAdjacentElement("afterend", panel);
}

function renderCancelState(state, reason) {
  setText("processingCancelStatus", [
    `Cancelamento: ${state}`,
    `Motivo: ${reason}`,
    `Atualizado em: ${new Date().toISOString()}`,
    "Audit: audit-52",
  ].join("\n"));
}

function setCancelButtonEnabled(enabled) {
  const button = byId("btnCancelProcessing");
  if (!button) return;
  button.disabled = !enabled;
}

function isAnalyzeRequest(resource) {
  const value = typeof resource === "string" ? resource : String(resource?.url || "");
  return value.includes("/api/omr/analyze");
}

function patchFetchForCancel() {
  if (window.__cppAudit52FetchPatched) return;
  window.__cppAudit52FetchPatched = true;

  window.fetch = (resource, options = {}) => {
    if (!isAnalyzeRequest(resource)) {
      return originalFetch(resource, options);
    }

    const controller = new AbortController();
    activeAnalyzeController = controller;
    cancelRequested = false;
    setCancelButtonEnabled(true);
    renderCancelState("disponível", "processamento ativo detectado");

    const mergedOptions = { ...options, signal: options.signal || controller.signal };

    return originalFetch(resource, mergedOptions)
      .catch(error => {
        if (cancelRequested || error?.name === "AbortError") {
          appendOperationalNotice("Processamento cancelado pelo usuário antes de concluir resposta do backend.");
          throw new Error("Processamento cancelado pelo usuário de forma segura.");
        }
        throw error;
      })
      .finally(() => {
        activeAnalyzeController = null;
        cancelRequested = false;
        setCancelButtonEnabled(false);
        renderCancelState("indisponível", "nenhum processamento ativo");
      });
  };
}

function bindCancelButton() {
  const button = byId("btnCancelProcessing");
  if (!button) return;
  button.onclick = event => {
    event.preventDefault();
    if (!activeAnalyzeController) {
      renderCancelState("indisponível", "nenhum processamento ativo para cancelar");
      return;
    }

    cancelRequested = true;
    activeAnalyzeController.abort();
    renderCancelState("solicitado", "requisição de análise abortada no frontend");
    setText("processingStatus", "Cancelamento solicitado pelo usuário. Aguardando finalização segura da operação...");
    appendOperationalNotice("Cancelamento seguro solicitado pelo usuário.");
  };
}

function markBuild() {
  const build = byId("frontendBuild");
  if (build) build.textContent = `Frontend build: ${AUDIT52_BUILD}`;
}

function initAudit52SafeCancel() {
  markBuild();
  createCancelPanel();
  bindCancelButton();
  patchFetchForCancel();
  renderCancelState("indisponível", "nenhum processamento ativo");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAudit52SafeCancel);
} else {
  initAudit52SafeCancel();
}
