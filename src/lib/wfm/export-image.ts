import { toPng } from "html-to-image";

/** Exporta un nodo del DOM como PNG legible (alta resolución, fondo blanco). */
export async function exportNodeAsPng(node: HTMLElement, fileName: string) {
  const width = node.scrollWidth;
  const height = node.scrollHeight;

  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    width,
    height,
    cacheBust: true,
    style: { margin: "0" },
    filter: (el) =>
      !(el instanceof HTMLElement && el.dataset["exportIgnore"] === "true"),
  });

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}
