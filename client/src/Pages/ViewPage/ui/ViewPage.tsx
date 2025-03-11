import { useParams } from 'react-router';
import { useGetFileBlobUrlQuery } from '@/entities/File';
import { Drawing, PdfViewer } from '@/widgets/Viewer';
import { useAppSelector } from '@/shared/hooks';
import { useAppDispatch } from '@/shared/hooks';
import { viewerPageActions } from '../model/slice/viewerPageSlice';
import { viewerPageSelectors } from '../model/selectors/viewerPageSelectors';
import { useEffect } from 'react';

export const ViewPage = () => {
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const { data: fileBlobUrl, isLoading } = useGetFileBlobUrlQuery(id || '');
  const drawings = useAppSelector(viewerPageSelectors.getDrawings);

  useEffect(() => {
    return () => {
      dispatch(viewerPageActions.clearDrawings());
    };
  }, [dispatch]);

  const handleDrawingCreated = (drawing: Drawing) => {
    dispatch(viewerPageActions.addDrawing(drawing));
  };

  if (isLoading) return <div>Loading...</div>;
  return <PdfViewer url={fileBlobUrl || ''} drawings={drawings} drawingCreated={handleDrawingCreated} />;
};
