const masks = new WeakMap<
  HTMLImageElement,
  { src: string; data: Uint8ClampedArray; width: number; height: number }
>();

/** Map the visible object-fit: contain image back to its original alpha pixels. */
export function imageHitTest(image: HTMLImageElement, x: number, y: number) {
  if (!image.complete || !image.naturalWidth) return false;
  const rect = image.getBoundingClientRect();
  const scale = Math.min(
    rect.width / image.naturalWidth,
    rect.height / image.naturalHeight,
  );
  const left = rect.left + (rect.width - image.naturalWidth * scale) / 2;
  const top = rect.top + (rect.height - image.naturalHeight * scale) / 2;
  const px = Math.floor((x - left) / scale);
  const py = Math.floor((y - top) / scale);
  if (px < 0 || py < 0 || px >= image.naturalWidth || py >= image.naturalHeight)
    return false;
  let mask = masks.get(image);
  if (!mask || mask.src !== image.currentSrc) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(image, 0, 0);
    mask = {
      src: image.currentSrc,
      width: canvas.width,
      height: canvas.height,
      data: context.getImageData(0, 0, canvas.width, canvas.height).data,
    };
    masks.set(image, mask);
  }
  return mask.data[(py * mask.width + px) * 4 + 3] > 0;
}
