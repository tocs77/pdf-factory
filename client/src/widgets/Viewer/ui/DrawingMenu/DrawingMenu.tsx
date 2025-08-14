import { useContext, useState } from 'react';

import { DraggableDialog } from '@/shared/UI/DraggableDialog';

import { ViewerContext } from '../../model/context/viewerContext';
import { isLightColor } from '../../utils/textToolUtils';
import styles from './DrawingMenu.module.scss';
import { DrawingMode } from '../../model/types/viewerSchema';

export const DrawingMenu = () => {
  const { state, dispatch } = useContext(ViewerContext);
  const { drawingMode, drawingColor, drawingLineWidth, drawingOpacity } = state;
  const [dialogPosition, setDialogPosition] = useState({ x: 100, y: 100 });

  // Don't need to check visibility as the parent component (Viewer) handles this
  if (drawingMode === 'none') {
    return null;
  }

  // Check if we're in a selection-only mode
  const selectionModes: DrawingMode[] = ['rectSelection', 'pinSelection', 'drawArea', 'ruler'];
  const isSelectionMode = selectionModes.includes(drawingMode);

  // Check if we're in textArea mode
  const isTextAreaMode = drawingMode === 'textArea';

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

  const changeOpacity = (opacity: number) => {
    dispatch({ type: 'setDrawingOpacity', payload: opacity });
  };

  // Color options
  const colorOptions = ['#2196f3', '#4caf50', '#f44336', '#ff9800', '#9c27b0', '#000000'];

  // Line width options
  const lineWidthOptions = [1, 2, 3, 5, 8];

  // Opacity options (25%, 50%, 75%, 100%)
  const opacityOptions = [0.25, 0.5, 0.75, 1];

  return (
    <DraggableDialog
      initialXPos={dialogPosition.x}
      initialYPos={dialogPosition.y}
      showHeader={false}
      grabAreas={['left', 'right']}
      onPositionChange={setDialogPosition}
      resizable={false}>
      <div className={styles.drawingMenuContainer} data-dragscroll-ignore='true'>
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
              <span>{isTextAreaMode ? 'Размер текста:' : 'Толщина:'}</span>
              <div className={styles.lineWidthOptions}>
                {lineWidthOptions.map((width) => (
                  <button
                    key={width}
                    className={`${styles.lineWidthOption} ${width === drawingLineWidth ? styles.active : ''}`}
                    onClick={() => changeLineWidth(width)}
                    title={isTextAreaMode ? `Установить размер текста: ${width}` : `Установить толщину линии: ${width}`}
                    aria-label={isTextAreaMode ? `Установить размер текста: ${width}` : `Установить толщину линии: ${width}`}>
                    {isTextAreaMode ? (
                      <div style={{ fontSize: `${10 + width * 2}px`, fontWeight: 'bold' }}>T</div>
                    ) : (
                      <div style={{ height: `${width}px`, width: '14px', backgroundColor: '#333' }}></div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!isSelectionMode && (
            <div className={styles.opacityPicker}>
              <span>Прозрачность:</span>
              <div className={styles.opacityOptions}>
                {opacityOptions.map((opacity) => (
                  <button
                    key={opacity}
                    className={`${styles.opacityOption} ${opacity === drawingOpacity ? styles.active : ''}`}
                    onClick={() => changeOpacity(opacity)}
                    title={`Установить прозрачность: ${Math.round(opacity * 100)}%`}
                    aria-label={`Установить прозрачность: ${Math.round(opacity * 100)}%`}>
                    <div
                      style={{
                        width: '20px',
                        height: '16px',
                        backgroundColor: drawingColor,
                        opacity: opacity,
                        border: '1px solid #ccc',
                        borderRadius: '2px',
                      }}
                    />
                    <span style={{ fontSize: '10px', marginTop: '2px' }}>{Math.round(opacity * 100)}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DraggableDialog>
  );
};
