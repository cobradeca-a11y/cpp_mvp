export function getFileKind(file) {
  if (!file) return "";
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".musicxml") || name.endsWith(".xml") || name.endsWith(".mxl")) return "musicxml";
  if (file.type.startsWith("image/")) return "image";
  return "unknown";
}

export function validateFile(file) {
  const kind = getFileKind(file);
  if (!file) return { ok: false, message: "Nenhum arquivo selecionado." };
  if (!["pdf", "image", "musicxml"].includes(kind)) {
    return { ok: false, message: "Tipo não aceito. Use PDF, JPG, PNG, WEBP, MusicXML, XML ou MXL." };
  }
  return { ok: true, kind, message: "Arquivo aceito para OMR profissional." };
}
