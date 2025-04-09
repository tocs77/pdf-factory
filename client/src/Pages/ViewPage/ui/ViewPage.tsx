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
  const dispatch = useAppDispatch();
  const { data: fileBlobUrl, isLoading } = useGetFileBlobUrlQuery(id || '');
  const drawings = useAppSelector(viewerPageSelectors.getDrawings);
  const pdfViewerRef = useRef<PdfViewerRef>(null);
  const compare = searchParams.get('compare');

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

  if (isLoading) return <div>Loading...</div>;
  return (
    <div className={classes.ViewPage}>
      <PdfViewer
        ref={pdfViewerRef}
        url={fileBlobUrl || ''}
        drawings={drawings}
        drawingCreated={handleDrawingCreated}
        compareUrl={compare || undefined}
      />
      <div className={classes.drawings}>
        {drawings.map((drawing: Drawing) => (
          <div
            key={drawing.id}
            className={classes.drawing}
            onClick={() => drawing.id && handleDrawingClick(drawing.id)}
            role='button'
            tabIndex={0}
            aria-label={`View ${drawing.type} drawing`}>
            <img src={drawing.image} alt={drawing.type} className={classes.drawingImage} />
          </div>
        ))}
      </div>
    </div>
  );
};
