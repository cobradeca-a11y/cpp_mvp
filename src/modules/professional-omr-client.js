export async function analyzeWithProfessionalOmr({ file, backendUrl }) {
  if (!file) throw operationalClientError("Nenhum arquivo selecionado.", { category: "file" });

  const base = String(backendUrl || "http://localhost:8787").replace(/\/$/, "");
  const form = new FormData();
  form.append("file", file);

  let response;
  try {
    response = await fetch(`${base}/api/omr/analyze`, {
      method: "POST",
      body: form
    });
  } catch (error) {
    throw operationalClientError(error?.message || "Falha de rede ao chamar backend OMR.", {
      category: "backend",
      backendUrl: base,
      status: 0,
    });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw operationalClientError(`Erro no OMR profissional: HTTP ${response.status}. ${text}`, {
      category: "backend",
      backendUrl: base,
      status: response.status,
      response_text: text.slice(0, 1200),
    });
  }

  const protocol = await response.json().catch(error => {
    throw operationalClientError(error?.message || "Resposta JSON inválida do backend OMR.", {
      category: "backend",
      backendUrl: base,
      status: response.status,
    });
  });
  if (!protocol || typeof protocol !== "object") {
    throw operationalClientError("Resposta inválida do backend OMR.", { category: "backend", backendUrl: base, status: response.status });
  }
  return protocol;
}

export async function checkProfessionalOmrBackend(backendUrl) {
  const base = String(backendUrl || "http://localhost:8787").replace(/\/$/, "");
  let response;
  try {
    response = await fetch(`${base}/health`);
  } catch (error) {
    throw operationalClientError(error?.message || "Backend indisponível.", {
      category: "backend",
      backendUrl: base,
      status: 0,
    });
  }
  if (!response.ok) {
    throw operationalClientError(`Backend indisponível: HTTP ${response.status}`, {
      category: "backend",
      backendUrl: base,
      status: response.status,
    });
  }
  return response.json();
}

function operationalClientError(message, context = {}) {
  const error = new Error(message);
  error.context = context;
  error.status = context.status || 0;
  return error;
}
