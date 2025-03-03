import React, { useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { DrawingMode } from '../../model/types/viewerSchema';
import classes from './ViewerMenu.module.scss';

interface ViewerMenuProps {
  renderQuality: number;
  currentPage: number;
}

export const ViewerMenu: React.FC<ViewerMenuProps> = ({ renderQuality, currentPage }) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, textLayerEnabled, drawingMode, drawings, rectangles } = state;

  const zoomIn = () => {
    dispatch({ type: 'setScale', payload: scale + 0.25 });
  };

  const zoomOut = () => {
    dispatch({ type: 'setScale', payload: scale - 0.25 });
  };

  const resetZoom = () => {
    dispatch({ type: 'setScale', payload: 1.5 });
  };

  const toggleTextLayer = () => {
    dispatch({ type: 'toggleTextLayer' });
  };

  const changeDrawingColor = (color: string) => {
    dispatch({ type: 'setDrawingColor', payload: color });
  };

  const changeLineWidth = (width: number) => {
    dispatch({ type: 'setDrawingLineWidth', payload: width });
  };

  const changeDrawingMode = (mode: DrawingMode) => {
    dispatch({ type: 'setDrawingMode', payload: mode });
  };

  const clearAllDrawings = () => {
    dispatch({ type: 'clearDrawings' });
    dispatch({ type: 'clearRectangles' });
  };

  const clearPageDrawings = () => {
    dispatch({ type: 'clearDrawings', payload: currentPage });
    dispatch({ type: 'clearRectangles', payload: currentPage });
  };

  // Count drawings on current page
  const currentPageDrawingsCount = drawings.filter(d => d.pageNumber === currentPage).length;
  const currentPageRectanglesCount = rectangles.filter(r => r.pageNumber === currentPage).length;
  const currentPageTotalCount = currentPageDrawingsCount + currentPageRectanglesCount;
  
  // Count all drawings
  const totalDrawingsCount = drawings.length + rectangles.length;

  return (
    <div className={classes.zoomControls}>
      <button onClick={zoomOut} className={classes.zoomButton}>
        Zoom Out
      </button>
      <button onClick={resetZoom} className={classes.zoomButton}>
        Reset Zoom
      </button>
      <button onClick={zoomIn}>Zoom In</button>
      <span className={classes.zoomPercentage}>
        {Math.round(scale * 100)}% {renderQuality > 1 && `(${renderQuality}x quality)`}
        {!textLayerEnabled && (
          <span className={classes.drawingScaleInfo}>
            - Drawings maintain position & size at all zoom levels
          </span>
        )}
      </span>
      <div className={classes.featureInfo}>
        <button
          onClick={toggleTextLayer}
          className={`${classes.textLayerToggle} ${textLayerEnabled ? classes.active : ''}`}
          title={textLayerEnabled ? 'Switch to drawing mode' : 'Switch to text selection mode'}>
          {textLayerEnabled ? (
            <>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'>
                <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'></path>
                <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'></path>
              </svg>
              <span>Switch to Drawing Mode</span>
            </>
          ) : (
            <>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'>
                <path d='M17 8h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3'></path>
                <path d='M7 8H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3'></path>
                <line x1='12' y1='2' x2='12' y2='22'></line>
              </svg>
              <span>Switch to Text Selection</span>
            </>
          )}
        </button>

        {!textLayerEnabled && (
          <div className={classes.drawingControls}>
            <div className={classes.drawingModeSelector}>
              <button
                className={`${classes.drawingModeButton} ${drawingMode === 'freehand' ? classes.active : ''}`}
                onClick={() => changeDrawingMode('freehand')}
                title="Freehand drawing mode"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>Freehand</span>
              </button>
              <button
                className={`${classes.drawingModeButton} ${drawingMode === 'rectangle' ? classes.active : ''}`}
                onClick={() => changeDrawingMode('rectangle')}
                title="Rectangle drawing mode"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                </svg>
                <span>Rectangle</span>
              </button>
            </div>
            
            <div className={classes.colorPicker}>
              {['#2196f3', '#4caf50', '#f44336', '#ff9800', '#9c27b0'].map((color) => (
                <button
                  key={color}
                  className={`${classes.colorButton} ${drawingColor === color ? classes.active : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => changeDrawingColor(color)}
                  title={`Change drawing color to ${color}`}
                />
              ))}
            </div>
            <div className={classes.lineWidthControls}>
              <button
                className={`${classes.lineWidthButton} ${drawingLineWidth === 1 ? classes.active : ''}`}
                onClick={() => changeLineWidth(1)}
                title='Thin line'>
                <div className={classes.linePreview} style={{ height: '1px' }}></div>
              </button>
              <button
                className={`${classes.lineWidthButton} ${drawingLineWidth === 2 ? classes.active : ''}`}
                onClick={() => changeLineWidth(2)}
                title='Medium line'>
                <div className={classes.linePreview} style={{ height: '2px' }}></div>
              </button>
              <button
                className={`${classes.lineWidthButton} ${drawingLineWidth === 4 ? classes.active : ''}`}
                onClick={() => changeLineWidth(4)}
                title='Thick line'>
                <div className={classes.linePreview} style={{ height: '4px' }}></div>
              </button>
            </div>
            
            <div className={classes.drawingActions}>
              {currentPageTotalCount > 0 && (
                <button 
                  className={classes.clearButton} 
                  onClick={clearPageDrawings}
                  title="Clear drawings on this page">
                  Clear Page ({currentPageTotalCount})
                </button>
              )}
              {totalDrawingsCount > 0 && (
                <button 
                  className={classes.clearButton} 
                  onClick={clearAllDrawings}
                  title="Clear all drawings">
                  Clear All ({totalDrawingsCount})
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 