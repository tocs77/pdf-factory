/**
 * Utility functions for handling page scrolling in the PDF viewer
 */

interface ScrollToPageOptions {
  newPage: number;
  currentPage: number;
  totalPages: number;
  containerRef: React.RefObject<HTMLDivElement>;
  pages: any[]; // PDFPageProxy[] type in actual usage
}

/**
 * Scrolls to the specified page with optimized handling for different jump distances
 * Uses different strategies based on the distance between pages to ensure
 * accurate scrolling even for large jumps in virtualized content
 */
export const scrollToPage = (options: ScrollToPageOptions): void => {
  const { newPage, currentPage, totalPages, containerRef } = options;
  const pageDifference = Math.abs(newPage - currentPage);

  if (pageDifference > 50) {
    // For very large jumps, we'll use a multi-step approach:

    // 1. First attempt: Use position estimation for extremely large documents
    if (pageDifference > 200 && containerRef.current) {
      // Get the container's scroll height
      const containerHeight = containerRef.current.scrollHeight;

      // Estimate where the page should be proportionally
      // This is a rough estimate assuming uniform page heights
      const estimatedPosition = (containerHeight * (newPage - 1)) / totalPages;

      // Scroll to the estimated position
      containerRef.current.scrollTop = estimatedPosition;

      // Allow time for rendering, then try to fine-tune
      setTimeout(() => {
        // Try to find the actual target page
        const targetElement = document.getElementById(`pdf-page-${newPage}`);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'instant' });
        } else {
          // If we still can't find the target, try an intermediate approach
          // Find the closest rendered page
          let closestPage = 1;
          let closestDiff = Number.MAX_SAFE_INTEGER;

          for (let i = 1; i <= totalPages; i++) {
            const element = document.getElementById(`pdf-page-${i}`);
            if (element && Math.abs(i - newPage) < closestDiff) {
              closestDiff = Math.abs(i - newPage);
              closestPage = i;
            }
          }

          // Scroll to the closest page we found
          const closestElement = document.getElementById(`pdf-page-${closestPage}`);
          if (closestElement) {
            closestElement.scrollIntoView({ behavior: 'instant' });
          }
        }
      }, 100);
    } else {
      // 2. Standard approach for large (but not extreme) jumps: use intermediate points
      const midPoint = Math.floor((currentPage + newPage) / 2);
      const midPointElement = document.getElementById(`pdf-page-${midPoint}`);

      if (midPointElement) {
        // Scroll to the mid-point first (instantly)
        midPointElement.scrollIntoView({ behavior: 'instant' });

        // Then use setTimeout to allow the browser to render pages near the mid-point
        setTimeout(() => {
          // Finally scroll to the actual target page
          const targetElement = document.getElementById(`pdf-page-${newPage}`);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'instant' });

            // Double-check after a short delay to ensure we're on the right page
            setTimeout(() => {
              const finalCheck = document.getElementById(`pdf-page-${newPage}`);
              if (finalCheck) {
                finalCheck.scrollIntoView({ behavior: 'instant' });
              }
            }, 100);
          }
        }, 50);
      }
    }
  } else {
    // For smaller jumps, we can use simple scrollIntoView
    const pageElement = document.getElementById(`pdf-page-${newPage}`);
    if (pageElement) {
      // Use smooth scrolling for nearby pages (within 3 pages), instant for medium jumps
      const scrollBehavior = pageDifference <= 3 ? 'smooth' : 'instant';
      pageElement.scrollIntoView({ behavior: scrollBehavior as ScrollBehavior });
    }
  }
};
