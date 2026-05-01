export async function renderPdfFile(file, scale = 3) {
  if (!window.pdfjsLib) throw new Error("PDF.js não carregou.");
  const pdfjsLib = window.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    await page.render({ canvasContext: ctx, viewport }).promise;

    const textContent = await page.getTextContent();
    const textItems = textContent.items.map(item => {
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      return {
        str: item.str,
        x: tx[4],
        y: tx[5],
        w: (item.width || 0) * scale,
        h: Math.abs(tx[3] || 10)
      };
    });

    pages.push({
      page_id: `p${String(pageNumber).padStart(3, "0")}`,
      page_number: pageNumber,
      image_src: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
      text_items: textItems
    });
  }
  return pages;
}

export async function renderImageFile(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  return [{
    page_id: "p001",
    page_number: 1,
    image_src: dataUrl,
    width: img.naturalWidth,
    height: img.naturalHeight,
    text_items: []
  }];
}
