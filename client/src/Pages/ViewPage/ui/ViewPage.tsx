import { useEffect } from 'react';
import { useParams } from 'react-router';

import { useGetFileBlobUrlQuery } from '@/entities/File';
import { Drawing, PdfViewer } from '@/widgets/Viewer';
import { useAppSelector } from '@/shared/hooks';
import { useAppDispatch } from '@/shared/hooks';

import { viewerPageActions } from '../model/slice/viewerPageSlice';
import { viewerPageSelectors } from '../model/selectors/viewerPageSelectors';
import classes from './ViewPage.module.scss';

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

  const handleDrawingCreated = (drawing: Omit<Drawing, 'id'>) => {
    dispatch(viewerPageActions.addDrawing(drawing));
  };

  if (isLoading) return <div>Loading...</div>;
  return (
    <div className={classes.ViewPage}>
      <PdfViewer url={fileBlobUrl || ''} drawings={drawings} drawingCreated={handleDrawingCreated} />
      <div className={classes.drawings}>
        {drawings.map((drawing) => (
          <div key={drawing.id} className={classes.drawing}>
            <img src={drawing.image} alt={drawing.type} className={classes.drawingImage} />
          </div>
        ))}
      </div>
    </div>
  );
};
