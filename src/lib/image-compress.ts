/**
 * Utility for compressing image files in the browser.
 * Reduces dimension and quality of image files (JPEG, PNG) to optimize storage space and upload speeds.
 * Falls back to the original file if compression fails or if file type is not supported (e.g. PDFs).
 */
export async function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.75): Promise<File> {
  // If the file is not an image, return it unmodified
  if (!file.type.startsWith("image/")) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file); // Fallback to original file if canvas 2D context is unavailable
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Convert filename to .webp extension
              const originalName = file.name;
              const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
              const webpName = `${baseName}.webp`;

              // Create a new File from the blob with image/webp type
              const compressedFile = new File([blob], webpName, {
                type: "image/webp",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

