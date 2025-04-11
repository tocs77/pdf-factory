import { useParams, useSearchParams } from 'react-router';
import { useEffect, useRef } from 'react';
import { useAppSelector } from '@/shared/hooks';
import { useGetFileBlobUrlQuery } from '@/entities/File';
import { PdfViewer } from '@/widgets/Viewer';
import { Drawing } from '@/widgets/Viewer';
import { useAppDispatch } from '@/shared/hooks';
import { PdfViewerRef } from '@/widgets/Viewer/ui/Viewer/Viewer';

import { viewerPageActions } from '../model/slice/viewerPageSlice';
import { viewerPageSelectors } from '../model/selectors/viewerPageSelectors';
import classes from './ViewPage.module.scss';

export const ViewPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const compare = searchParams.get('compare');
  const dispatch = useAppDispatch();
  const { data: fileBlobUrl, isLoading } = useGetFileBlobUrlQuery(id || '');
  const { data: compareFileBlobUrl, isLoading: isCompareLoading } = useGetFileBlobUrlQuery(compare || '', { skip: !compare });
  const drawings = useAppSelector(viewerPageSelectors.getDrawings);
  const pdfViewerRef = useRef<PdfViewerRef>(null);
  const drawingsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      dispatch(viewerPageActions.clearDrawings());
    };
  }, [dispatch]);

  const handleDrawingCreated = (drawing: Omit<Drawing, 'id'>) => {
    dispatch(viewerPageActions.addDrawing(drawing));
  };

  const handleDrawingClick = (drawingId: string) => {
    pdfViewerRef.current?.scrollToDraw(drawingId);
  };

  const pdfDrawingClicked = (drawingId: string) => {
    if (drawingsContainerRef.current) {
      const drawingElement = drawingsContainerRef.current.querySelector(`[data-drawing-id="${drawingId}"]`);
      if (drawingElement) {
        drawingElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  if (isLoading || isCompareLoading) return <div>Loading...</div>;
  return (
    <div className={classes.ViewPage}>
      <PdfViewer
        ref={pdfViewerRef}
        url={fileBlobUrl || ''}
        drawings={drawings}
        drawingCreated={handleDrawingCreated}
        compareUrl={compareFileBlobUrl || undefined}
        onDrawingClicked={pdfDrawingClicked}
      />
      <div className={classes.drawings} ref={drawingsContainerRef}>
        {drawings.map((drawing: Drawing) => (
          <div
            key={drawing.id}
            className={classes.drawing}
            onClick={() => handleDrawingClick(drawing.id)}
            role='button'
            tabIndex={0}
            data-drawing-id={drawing.id}
            aria-label={`View ${drawing.type} drawing`}>
            <img src={drawing.image} alt={drawing.type} className={classes.drawingImage} />
          </div>
        ))}
      </div>
    </div>
  );
};
