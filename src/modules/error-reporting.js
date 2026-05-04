export const FRONTEND_ERROR_AUDIT = "audit-50";

export function classifyOperationalError(error, context = {}) {
  const message = String(error?.message || error || "Erro desconhecido.");
  const lower = message.toLowerCase();
  const status = Number(error?.status || context.status || 0);

  if (context.category === "file" || lower.includes("nenhum arquivo") || lower.includes("tipo não aceito")) {
    return buildError("file_error", "Erro de arquivo", "Verifique o formato do arquivo selecionado.", message, context);
  }

  if (status === 0 || lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed")) {
    return buildError(
      "backend_unreachable",
      "Backend indisponível",
      "Verifique se o backend está rodando em localhost:8787 e tente novamente.",
      message,
      context,
    );
  }

  if (status >= 400 && status < 500) {
    return buildError("backend_request_error", "Erro na requisição ao backend", "O backend recusou a requisição. Confira arquivo, formato e parâmetros.", message, context);
  }

  if (status >= 500) {
    return buildError("backend_internal_error", "Erro interno do backend", "O backend encontrou uma falha técnica. Preserve o log e revise a configuração local.", message, context);
  }

  if (lower.includes("audiveris") || lower.includes("omr")) {
    return buildError("omr_error", "Erro OMR", "Verifique se o Audiveris está instalado/configurado ou se o arquivo é legível.", message, context);
  }

  if (lower.includes("google vision") || lower.includes("ocr") || lower.includes("gcloud") || lower.includes("credentials")) {
    return buildError("ocr_error", "Erro OCR", "Verifique OCR_ENGINE, credenciais Google Vision e dependências locais.", message, context);
  }

  if (context.category === "export" || lower.includes("export")) {
    return buildError("export_error", "Erro de exportação", "A exportação falhou. O protocolo original não foi alterado.", message, context);
  }

  return buildError("unknown_error", "Erro operacional", "A operação falhou sem classificação específica. Preserve o log técnico.", message, context);
}

export function formatOperationalError(errorReport) {
  return [
    `[${errorReport.title}]`,
    `Código: ${errorReport.code}`,
    `Mensagem: ${errorReport.user_message}`,
    `Detalhe técnico: ${errorReport.technical_message}`,
    `Contexto: ${JSON.stringify(errorReport.context || {}, null, 2)}`,
    `Data: ${errorReport.timestamp}`,
  ].join("\n");
}

export function appendOperationalError(container, error, context = {}) {
  if (!container) return classifyOperationalError(error, context);
  const report = classifyOperationalError(error, context);
  const previous = container.textContent?.trim();
  const text = formatOperationalError(report);
  container.textContent = previous ? `${text}\n\n---\n\n${previous}` : text;
  return report;
}

export function exportOperationalErrorLogText(container) {
  const current = container?.textContent?.trim();
  if (!current) return "Nenhum erro operacional registrado nesta sessão.";
  return current;
}

function buildError(code, title, userMessage, technicalMessage, context) {
  return {
    audit: FRONTEND_ERROR_AUDIT,
    code,
    title,
    user_message: userMessage,
    technical_message: technicalMessage,
    context: sanitizeContext(context),
    timestamp: new Date().toISOString(),
  };
}

function sanitizeContext(context = {}) {
  const out = { ...context };
  delete out.fileContent;
  delete out.rawProtocol;
  delete out.credentials;
  delete out.token;
  delete out.password;
  return out;
}
