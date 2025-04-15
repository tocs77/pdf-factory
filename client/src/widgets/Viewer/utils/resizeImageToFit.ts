// Helper function to resize image to fit specific dimensions while maintaining aspect ratio
export const resizeImageToFit = async (
  file: File,
  targetWidth: number,
  targetHeight: number,
  quality: number = 0.85,
): Promise<{ dataUrl: string; dimensions: { width: number; height: number } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Calculate aspect ratios
        const imageRatio = img.width / img.height;
        const targetRatio = targetWidth / targetHeight;

        // Determine dimensions that maintain aspect ratio
        let finalWidth, finalHeight;

        if (imageRatio > targetRatio) {
          // Image is wider than target area proportionally
          finalWidth = targetWidth;
          finalHeight = finalWidth / imageRatio;
        } else {
          // Image is taller than target area proportionally
          finalHeight = targetHeight;
          finalWidth = finalHeight * imageRatio;
        }

        // Create canvas with calculated dimensions
        const canvas = document.createElement('canvas');
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) return reject(new Error('Could not get canvas context'));

        // Draw image with new dimensions
        ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Return both the data URL and the actual dimensions used
        resolve({
          dataUrl,
          dimensions: {
            width: finalWidth,
            height: finalHeight,
          },
        });
      };
      img.onerror = reject;
      if (event.target?.result) img.src = event.target.result as string;
      else reject(new Error('FileReader did not return a result.'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
