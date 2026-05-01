export function assessPageQuality(page) {
  const min = Math.min(page.width || 0, page.height || 0);
  if (min >= 1600) return { status: "boa", message: "Imagem em boa resolução para zoom." };
  if (min >= 900) return { status: "média", message: "Imagem utilizável, mas alguns detalhes podem exigir zoom." };
  return { status: "baixa", message: "Resolução baixa. Continue, mas a confiança será reduzida." };
}

export function cropImageDataUrl(sourceUrl, bbox) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bbox.w));
      c.height = Math.max(1, Math.round(bbox.h));
      const ctx = c.getContext("2d");
      ctx.drawImage(img, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = sourceUrl;
  });
}
