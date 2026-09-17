// Comprime una imagen en el navegador antes de subirla a Supabase Storage:
// reduce el tamaño de fotos de cámara (varios MB) a ~50-200KB usando WebP
// (más liviano que JPEG a la misma calidad visual), lo cual acelera mucho
// la subida en datos móviles, el peso del bucket, y la carga posterior.
export const compressImage = (file, maxWidth = 1024, quality = 0.6) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const nombreBase = file.name.replace(/\.[^.]+$/, '');
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          resolve(new File([blob], `${nombreBase}.webp`, { type: 'image/webp', lastModified: Date.now() }));
        }, 'image/webp', quality);
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};
