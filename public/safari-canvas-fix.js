// Safari puede devolver literalmente "data:," al exportar un canvas demasiado grande.
// Este parche mantiene el comportamiento normal y, solo en ese caso, reescala el canvas
// a un tamaño seguro antes de volver a exportarlo.
(() => {
  const nativeToDataURL = HTMLCanvasElement.prototype.toDataURL;
  const MAX_DIMENSION = 4096;
  const MAX_PIXELS = 8_000_000;

  HTMLCanvasElement.prototype.toDataURL = function patchedToDataURL(type, quality) {
    const result = nativeToDataURL.call(this, type, quality);
    if (result && result !== "data:," && result.startsWith("data:image/")) return result;

    const width = Math.max(1, this.width || 1);
    const height = Math.max(1, this.height || 1);
    const dimensionScale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const pixelScale = Math.min(1, Math.sqrt(MAX_PIXELS / Math.max(1, width * height)));
    const scale = Math.min(dimensionScale, pixelScale);

    if (!(scale < 1)) return result;

    const safe = document.createElement("canvas");
    safe.width = Math.max(1, Math.round(width * scale));
    safe.height = Math.max(1, Math.round(height * scale));
    const ctx = safe.getContext("2d");
    if (!ctx) return result;

    ctx.drawImage(this, 0, 0, safe.width, safe.height);
    const rescued = nativeToDataURL.call(safe, type || "image/jpeg", quality);
    return rescued && rescued !== "data:," ? rescued : result;
  };
})();
