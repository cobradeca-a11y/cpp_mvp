export async function analyzeWithProfessionalOmr({ file, backendUrl }) {
  if (!file) throw new Error("Nenhum arquivo selecionado.");

  const base = String(backendUrl || "http://localhost:8787").replace(/\/$/, "");
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${base}/api/omr/analyze`, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Erro no OMR profissional: HTTP ${response.status}. ${text}`);
  }

  const protocol = await response.json();
  if (!protocol || typeof protocol !== "object") throw new Error("Resposta inválida do backend OMR.");
  return protocol;
}

export async function checkProfessionalOmrBackend(backendUrl) {
  const base = String(backendUrl || "http://localhost:8787").replace(/\/$/, "");
  const response = await fetch(`${base}/health`);
  if (!response.ok) throw new Error(`Backend indisponível: HTTP ${response.status}`);
  return response.json();
}
