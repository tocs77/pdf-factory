import { useParams, useSearchParams } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '@/shared/hooks';
import { useGetFileBlobUrlQuery } from '@/entities/File';
import { convertDrawingDtoToDrawing, convertDrawingToDrawingDto, PdfViewer, PdfViewerRef, Drawing } from '@/widgets/Viewer';

import { useAppDispatch } from '@/shared/hooks';

import { viewerPageActions } from '../model/slice/viewerPageSlice';
import { viewerPageSelectors } from '../model/selectors/viewerPageSelectors';
import classes from './ViewPage.module.scss';
import {
  useGetDrawingsQuery,
  useCreateDrawingMutation,
  useDeleteDrawingMutation,
  useDeleteDrawingsByFileMutation,
} from '@/entities/Drawings';

// Function to detect if current device is a touchscreen
const detectTouchscreen = (): boolean => {
  // Check multiple touchscreen indicators
  const hasTouchStart = 'ontouchstart' in window;
  const hasMaxTouchPoints = navigator.maxTouchPoints > 0;
  const hasPointerCoarse = window.matchMedia?.('(pointer: coarse)').matches;

  // Device is considered touchscreen if it has touch capabilities
  return hasTouchStart || hasMaxTouchPoints || hasPointerCoarse;
};

export const ViewPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const compare = searchParams.get('compare');
  const dispatch = useAppDispatch();
  const [isMobile, setIsMobile] = useState(true);
  const { data: fileBlobUrl, isLoading } = useGetFileBlobUrlQuery(id || '');
  const { data: compareFileBlobUrl, isLoading: isCompareLoading } = useGetFileBlobUrlQuery(compare || '', { skip: !compare });
  const drawings = useAppSelector(viewerPageSelectors.getDrawings);
  const pdfViewerRef = useRef<PdfViewerRef>(null);
  const drawingsContainerRef = useRef<HTMLDivElement>(null);
  const { data } = useGetDrawingsQuery(id || '', { skip: !id });
  const [createDrawing] = useCreateDrawingMutation();
  const [deleteDrawing] = useDeleteDrawingMutation();
  const [deleteAllDrawings] = useDeleteDrawingsByFileMutation();

  // Detect touchscreen capability on component mount
  useEffect(() => {
    detectTouchscreen();
    //setIsMobile(touchscreenDetected);
    setIsMobile(isMobile);
  }, []);

  useEffect(() => {
    return () => {
      dispatch(viewerPageActions.clearDrawings());
    };
  }, [dispatch]);

  useEffect(() => {
    if (data) {
      const drawings = data.map((drawing) => convertDrawingDtoToDrawing(drawing));
      dispatch(viewerPageActions.setDrawings(drawings));
    }
  }, [data, dispatch]);

  const handleDrawingCreated = async (drawing: Omit<Drawing, 'id'>) => {
    const dto = convertDrawingToDrawingDto(drawing as Drawing, id || '');
    // Create a new object without the id property instead of using delete
    const { id: _, ...dtoWithoutId } = dto;
    await createDrawing(dtoWithoutId);
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
  const deleteDrawingHandle = (drawingId: string) => {
    if (!id) return;
    deleteDrawing({ id: drawingId, fileId: id });
  };

  const deleteAllDrawingsHandle = async () => {
    if (!id) return;
    await deleteAllDrawings(id);
    dispatch(viewerPageActions.clearDrawings());
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
        isMobile={isMobile}
        id={id}
      />

      <div className={classes.drawings} ref={drawingsContainerRef}>
        {drawings.length > 0 && (
          <button
            type='button'
            onClick={deleteAllDrawingsHandle}
            className={classes.deleteAllButton}
            style={{ marginBottom: '8px' }}>
            Удалить все
          </button>
        )}
        {drawings.map((drawing: Drawing) => (
          <div
            key={drawing.id}
            className={classes.drawing}
            onClick={() => handleDrawingClick(drawing.id)}
            role='button'
            tabIndex={0}
            data-drawing-id={drawing.id}
            aria-label={`View ${drawing.type} drawing`}>
            <div
              className={classes.deleteIcon}
              onClick={(e) => {
                e.stopPropagation();
                deleteDrawingHandle(drawing.id);
              }}
              role='button'
              aria-label='Delete drawing'>
              <svg width='16' height='16' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                <path d='M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z' fill='red' />
              </svg>
            </div>
            <img src={drawing.image} alt={drawing.type} className={classes.drawingImage} />
          </div>
        ))}
      </div>
    </div>
  );
};
