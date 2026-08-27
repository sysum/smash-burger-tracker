/**
 * Downscale and re-encode a photo before it is stored.
 *
 * Phone cameras produce 3-12MB images. Storing those verbatim would fill the
 * origin's storage quota within a few dozen burgers and make every detail
 * screen slow to paint, for a picture that is never displayed larger than a
 * phone screen. Re-encoding to a bounded JPEG typically lands under 300KB.
 */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export async function compressImage(file: File | Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    return blob ?? file;
  } catch (error) {
    // Better to store the original oversized image than to lose the user's
    // photo because a codec or canvas call was unavailable.
    console.error("Image compression failed, storing original", error);
    return file;
  }
}
