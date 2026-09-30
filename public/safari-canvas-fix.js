// Safari puede devolver literalmente "data:," cuando un canvas supera sus límites internos.
// Evitamos crear un canvas inválido desde el principio y mantenemos un rescate al exportar.
(() => {
  const proto = HTMLCanvasElement.prototype;
  const nativeToDataURL = proto.toDataURL;
  const widthDescriptor = Object.getOwnPropertyDescriptor(proto, "width");
  const heightDescriptor = Object.getOwnPropertyDescriptor(proto, "height");
  const MAX_DIMENSION = 4096;
  const MAX_PIXELS = 6_000_000;

  // AdminContent fija primero width y después height. En Safari una foto vertical puede
  // crear un canvas demasiado alto aunque width sea <= 1920; al exportarlo Safari
  // devuelve "data:,". Limitamos la altura ANTES de que se asigne el backing store.
  if (heightDescriptor?.get && heightDescriptor?.set) {
    Object.defineProperty(proto, "height", {
      configurable: true,
      enumerable: heightDescriptor.enumerable,
      get: heightDescriptor.get,
      set(value) {
        const requested = Math.max(1, Number(value) || 1);
        const width = Math.max(1, Number(this.width) || 1);
        const pixelSafeHeight = Math.max(1, Math.floor(MAX_PIXELS / width));
        const safeHeight = Math.min(requested, MAX_DIMENSION, pixelSafeHeight);
        heightDescriptor.set.call(this, safeHeight);
      },
    });
  }

  if (widthDescriptor?.get && widthDescriptor?.set) {
    Object.defineProperty(proto, "width", {
      configurable: true,
      enumerable: widthDescriptor.enumerable,
      get: widthDescriptor.get,
      set(value) {
        const requested = Math.max(1, Number(value) || 1);
        widthDescriptor.set.call(this, Math.min(requested, MAX_DIMENSION));
      },
    });
  }

  proto.toDataURL = function patchedToDataURL(type, quality) {
    const result = nativeToDataURL.call(this, type, quality);
    if (result && result !== "data:," && result.startsWith("data:image/")) return result;

    const width = Math.max(1, this.width || 1);
    const height = Math.max(1, this.height || 1);
    const dimensionScale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const pixelScale = Math.min(1, Math.sqrt(MAX_PIXELS / Math.max(1, width * height)));
    const scale = Math.min(dimensionScale, pixelScale);

    // Si incluso un canvas ya seguro falla, no permitimos propagar "data:," como imagen.
    if (!(scale < 1)) {
      throw new Error("Safari no pudo exportar esta imagen. Prueba con JPG/PNG o una imagen de menor resolución.");
    }

    const safe = document.createElement("canvas");
    safe.width = Math.max(1, Math.round(width * scale));
    safe.height = Math.max(1, Math.round(height * scale));
    const ctx = safe.getContext("2d");
    if (!ctx) throw new Error("El navegador no puede procesar esta imagen");

    ctx.drawImage(this, 0, 0, safe.width, safe.height);
    const rescued = nativeToDataURL.call(safe, type || "image/jpeg", quality);
    if (!rescued || rescued === "data:," || !rescued.startsWith("data:image/")) {
      throw new Error("Safari no pudo exportar esta imagen. Prueba con JPG/PNG o una imagen de menor resolución.");
    }
    return rescued;
  };
})();
