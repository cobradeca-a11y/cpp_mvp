export function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function versioned(base, ext) {
  const stamp = new Date().toISOString().replace(/[-:T]/g,"").slice(0,12);
  return `${base}_${stamp}.${ext}`;
}
