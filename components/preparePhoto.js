const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 4_450_000;
const MAX_EDGE = 1600;

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/jpeg") {
          reject(new Error("This browser could not prepare a JPEG photo."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

async function decodeWithImageElement(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodePhoto(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        // Fall through for browsers that support image decoding but not ImageBitmap.
      }
    }
  }
  return decodeWithImageElement(file);
}

export async function prepareIncidentPhoto(file) {
  if (!file || !ACCEPTED_TYPES.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP photo.");
  }
  if (file.size === 0) throw new Error("That photo is empty. Choose another file.");

  let source;
  try {
    source = await decodePhoto(file);
  } catch {
    throw new Error("The photo could not be opened. Choose a different image.");
  }

  try {
    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new Error("The photo has no usable image data.");

    const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
    let width = Math.max(1, Math.round(sourceWidth * scale));
    let height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser could not prepare the photo.");

    let blob;
    for (const quality of [0.86, 0.76, 0.66, 0.56, 0.48]) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(source, 0, 0, width, height);
      blob = await canvasToJpeg(canvas, quality);
      if (blob.size <= MAX_UPLOAD_BYTES) break;
    }

    while (blob.size > MAX_UPLOAD_BYTES && Math.max(width, height) > 640) {
      width = Math.max(1, Math.floor(width * 0.82));
      height = Math.max(1, Math.floor(height * 0.82));
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(source, 0, 0, width, height);
      blob = await canvasToJpeg(canvas, 0.62);
    }

    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new Error("The photo is still too large after resizing. Choose a smaller image.");
    }

    return new File([blob], "incident-photo.jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    if (typeof source.close === "function") source.close();
  }
}

export function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
