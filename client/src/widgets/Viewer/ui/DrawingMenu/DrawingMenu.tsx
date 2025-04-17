import { useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { isLightColor } from '../../utils/textToolUtils';
import styles from './DrawingMenu.module.scss';

export const DrawingMenu = () => {
  const { state, dispatch } = useContext(ViewerContext);
  const { drawingMode, drawingColor, drawingLineWidth } = state;

  // Don't need to check visibility as the parent component (Viewer) handles this
  if (drawingMode === 'none') {
    return null;
  }

  // Check if we're in a selection-only mode
  const isSelectionMode = drawingMode === 'rectSelection' || drawingMode === 'pinSelection' || drawingMode === 'drawArea';

  const handleFinishClick = () => {
    dispatch({ type: 'requestFinishDrawing', payload: true });
    // Reset the request flag after a short delay
    setTimeout(() => {
      dispatch({ type: 'requestFinishDrawing', payload: false });
    }, 100);
  };

  const handleCancelClick = () => {
    dispatch({ type: 'requestCancelDrawing', payload: true });
    // Reset the request flag after a short delay
    setTimeout(() => {
      dispatch({ type: 'requestCancelDrawing', payload: false });
    }, 100);
  };

  const changeDrawingColor = (color: string) => {
    dispatch({ type: 'setDrawingColor', payload: color });
  };

  const changeLineWidth = (width: number) => {
    dispatch({ type: 'setDrawingLineWidth', payload: width });
  };

  // Color options
  const colorOptions = ['#2196f3', '#4caf50', '#f44336', '#ff9800', '#9c27b0', '#000000'];

  // Line width options
  const lineWidthOptions = [1, 2, 3, 5, 8];

  return (
    <div className={styles.drawingMenuContainer}>
      <div className={styles.drawingOptions}>
        {!isSelectionMode && (
          <div className={styles.actionButtons}>
            <button
              className={styles.actionButton}
              onClick={handleFinishClick}
              title='Завершить рисование'
              style={{
                backgroundColor: drawingColor,
                color: isLightColor(drawingColor) ? '#333' : 'white',
              }}>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='3'
                strokeLinecap='round'
                strokeLinejoin='round'>
                <polyline points='20 6 9 17 4 12'></polyline>
              </svg>
              <span>Готово</span>
            </button>
            <button
              className={`${styles.actionButton} ${styles.cancelButton}`}
              onClick={handleCancelClick}
              title='Отменить рисование'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'>
                <line x1='18' y1='6' x2='6' y2='18'></line>
                <line x1='6' y1='6' x2='18' y2='18'></line>
              </svg>
              <span>Отмена</span>
            </button>
          </div>
        )}
        <div className={styles.colorPicker}>
          <span>Цвет:</span>
          <div className={styles.colorOptions}>
            {colorOptions.map((color) => (
              <button
                key={color}
                className={`${styles.colorOption} ${color === drawingColor ? styles.active : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => changeDrawingColor(color)}
                title={`Установить цвет: ${color}`}
                aria-label={`Установить цвет: ${color}`}
              />
            ))}
          </div>
        </div>
        {!isSelectionMode && (
          <div className={styles.lineWidthPicker}>
            <span>Толщина:</span>
            <div className={styles.lineWidthOptions}>
              {lineWidthOptions.map((width) => (
                <button
                  key={width}
                  className={`${styles.lineWidthOption} ${width === drawingLineWidth ? styles.active : ''}`}
                  onClick={() => changeLineWidth(width)}
                  title={`Установить толщину линии: ${width}`}
                  aria-label={`Установить толщину линии: ${width}`}>
                  <div style={{ height: `${width}px`, width: '14px', backgroundColor: '#333' }}></div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
