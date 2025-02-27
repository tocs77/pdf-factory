import { useEffect, useState, useRef, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';

export const PdfViewer = ({ url }: { url: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  pdfjs.GlobalWorkerOptions.workerSrc = 'pdf.worker.mjs';

  const [pdfRef, setPdfRef] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const renderPage = useCallback(
    (pageNum: number, pdf = pdfRef) => {
      if (pdf && canvasRef.current) {
        pdf.getPage(pageNum).then(function (page: PDFPageProxy) {
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const renderContext = {
              canvasContext: canvas.getContext('2d') as CanvasRenderingContext2D,
              viewport: viewport,
            };
            page.render(renderContext);
          }
        });
      }
    },
    [pdfRef],
  );

  useEffect(() => {
    renderPage(currentPage, pdfRef);
  }, [pdfRef, currentPage, renderPage]);

  useEffect(() => {
    const loadingTask = pdfjs.getDocument(url);
    loadingTask.promise.then(
      (loadedPdf) => {
        setPdfRef(loadedPdf);
      },
      function (reason: any) {
        console.error(reason);
      },
    );
  }, [url]);

  const nextPage = () => pdfRef && currentPage < pdfRef.numPages && setCurrentPage(currentPage + 1);

  const prevPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);

  return (
    <div>
      <canvas ref={canvasRef}></canvas>
      <div>
        <button onClick={prevPage} disabled={currentPage <= 1}>Previous</button>
        <span>Page {currentPage}</span>
        <button onClick={nextPage} disabled={!pdfRef || currentPage >= pdfRef.numPages}>Next</button>
      </div>
    </div>
  );
};
