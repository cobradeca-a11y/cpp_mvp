export function getFileKind(file) {
  if (!file) return "";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("image/")) return "image";
  return "unknown";
}

export function validateFile(file) {
  const kind = getFileKind(file);
  if (!file) return { ok: false, message: "Nenhum arquivo selecionado." };
  if (!["pdf", "image"].includes(kind)) return { ok: false, message: "Tipo não aceito. Use PDF/JPG/PNG/WEBP." };
  return { ok: true, kind, message: "Arquivo aceito." };
}
