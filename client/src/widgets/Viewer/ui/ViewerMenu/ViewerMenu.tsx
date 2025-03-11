import React, { useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { DrawingMode } from '../../model/types/viewerSchema';
import { classNames } from '@/shared/utils';
import classes from './ViewerMenu.module.scss';

interface ViewerMenuProps {
  currentPage: number;
  totalPages?: number;
}

export const ViewerMenu: React.FC<ViewerMenuProps> = ({ currentPage, totalPages = 0 }) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, drawingMode, drawings, showThumbnails, pageRotations } = state;

  console.log('drawingMode', drawingMode);
  const zoomIn = () => {
    dispatch({ type: 'setScale', payload: scale + 0.25 });
  };

  const zoomOut = () => {
    dispatch({ type: 'setScale', payload: scale - 0.25 });
  };

  const resetZoom = () => {
    dispatch({ type: 'setScale', payload: 1.5 });
  };

  const changeDrawingColor = (color: string) => {
    dispatch({ type: 'setDrawingColor', payload: color });
  };

  const changeLineWidth = (width: number) => {
    dispatch({ type: 'setDrawingLineWidth', payload: width });
  };

  const changeDrawingMode = (mode: DrawingMode) => {
    // If the clicked mode is already active, set to 'none' (toggle off)
    if (mode === drawingMode) {
      dispatch({ type: 'setDrawingMode', payload: 'none' });
    } else {
      dispatch({ type: 'setDrawingMode', payload: mode });
    }
  };

  const clearAllDrawings = () => {
    dispatch({ type: 'clearDrawings' });
  };

  const clearPageDrawings = () => {
    dispatch({ type: 'clearDrawings', payload: { pageNumber: currentPage } });
  };

  const rotatePageClockwise = () => {
    dispatch({ type: 'rotatePageClockwise', payload: currentPage });
  };

  const rotatePageCounterClockwise = () => {
    dispatch({ type: 'rotatePageCounterClockwise', payload: currentPage });
  };

  // Count drawings on current page by type
  const currentPageDrawings = drawings.filter((d) => d.pageNumber === currentPage);
  const currentPageTotalCount = currentPageDrawings.length;

  // Count all drawings
  const totalDrawingsCount = drawings.length;

  // Get current page rotation
  const currentRotation = pageRotations[currentPage] || 0;

  return (
    <div className={classes.zoomControls}>
      {/* Page counter */}
      <div className={classes.pageCounter}>
        {currentPage}/{totalPages}
      </div>

      {/* Thumbnail toggle button */}
      <button
        className={classNames(classes.thumbnailToggle, { [classes.active]: showThumbnails }, [])}
        onClick={() => dispatch({ type: 'toggleThumbnails' })}
        title={showThumbnails ? 'Hide thumbnails' : 'Show thumbnails'}>
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
          <rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect>
          <rect x='7' y='7' width='3' height='9'></rect>
          <rect x='14' y='7' width='3' height='5'></rect>
        </svg>
      </button>

      {/* Rotation controls */}
      <div className={classes.rotationControls}>
        <button onClick={rotatePageCounterClockwise} className={classes.rotationButton} title='Rotate counter-clockwise'>
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
            <path d='M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'></path>
            <path d='M3 3v5h5'></path>
          </svg>
        </button>
        <span className={classes.rotationInfo}>{currentRotation}°</span>
        <button onClick={rotatePageClockwise} className={classes.rotationButton} title='Rotate clockwise'>
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
            <path d='M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'></path>
            <path d='M21 3v5h-5'></path>
          </svg>
        </button>
      </div>

      {/* Zoom controls */}
      <button onClick={zoomOut} className={classes.zoomButton} title='Zoom out'>
        -
      </button>
      <span className={classes.zoomPercentage}>{Math.round(scale * 100)}%</span>
      <button onClick={zoomIn} className={classes.zoomButton} title='Zoom in'>
        +
      </button>
      <button onClick={resetZoom} className={classes.zoomButton} title='Reset zoom'>
        Reset
      </button>

      {/* Tool Panel */}
      <div className={classes.toolPanel}>
        {/* Tool Buttons */}
        <div className={classes.toolButtons}>
          {/* Text Selection Tool */}
          <button
            className={`${classes.toolButton} ${drawingMode === 'text' ? classes.active : ''}`}
            onClick={() => changeDrawingMode('text')}
            title={drawingMode === 'text' ? 'Disable text selection' : 'Enable text selection'}>
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
          </button>

          {/* Freehand Drawing Tool */}
          <button
            className={`${classes.toolButton} ${drawingMode === 'freehand' ? classes.active : ''}`}
            onClick={() => changeDrawingMode('freehand')}
            title={drawingMode === 'freehand' ? 'Disable freehand drawing' : 'Enable freehand drawing'}>
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
              <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'></path>
            </svg>
          </button>

          {/* Rectangle Tool */}
          <button
            className={`${classes.toolButton} ${drawingMode === 'rectangle' ? classes.active : ''}`}
            onClick={() => changeDrawingMode('rectangle')}
            title={drawingMode === 'rectangle' ? 'Disable rectangle tool' : 'Enable rectangle tool'}>
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
              <rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect>
            </svg>
          </button>

          {/* Pin Tool */}
          <button
            className={`${classes.toolButton} ${drawingMode === 'pin' ? classes.active : ''}`}
            onClick={() => changeDrawingMode('pin')}
            title={drawingMode === 'pin' ? 'Disable pin tool' : 'Enable pin tool'}>
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
              <path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'></path>
              <circle cx='12' cy='10' r='3'></circle>
            </svg>
          </button>

          {/* Line Drawing Tool */}
          <button
            className={`${classes.toolButton} ${drawingMode === 'line' ? classes.active : ''}`}
            onClick={() => changeDrawingMode('line')}
            title={drawingMode === 'line' ? 'Disable line tool' : 'Enable line tool'}>
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
              <line x1='5' y1='19' x2='19' y2='5'></line>
            </svg>
          </button>

          {/* Draw Area Tool */}
          <button
            className={`${classes.toolButton} ${drawingMode === 'drawArea' ? classes.active : ''}`}
            onClick={() => changeDrawingMode('drawArea')}
            title={drawingMode === 'drawArea' ? 'Disable draw area tool' : 'Enable draw area tool'}>
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
              <rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect>
              <path d='M9 3v18'></path>
              <path d='M14 3v18'></path>
              <path d='M21 9H3'></path>
              <path d='M21 14H3'></path>
            </svg>
          </button>
        </div>

        {/* Separator */}
        {(drawingMode === 'freehand' ||
          drawingMode === 'rectangle' ||
          drawingMode === 'pin' ||
          drawingMode === 'line' ||
          drawingMode === 'drawArea') && <div className={classes.separator}></div>}

        {/* Drawing Options - Only show when a drawing tool is selected */}
        {(drawingMode === 'freehand' ||
          drawingMode === 'rectangle' ||
          drawingMode === 'pin' ||
          drawingMode === 'line' ||
          drawingMode === 'drawArea') && (
          <div className={classes.drawingOptions}>
            <div className={classes.colorPicker}>
              <span>Color:</span>
              <div className={classes.colorOptions}>
                <button
                  className={`${classes.colorOption} ${drawingColor === '#2196f3' ? classes.active : ''}`}
                  style={{ backgroundColor: '#2196f3' }}
                  onClick={() => changeDrawingColor('#2196f3')}
                  title='Blue'
                />
                <button
                  className={`${classes.colorOption} ${drawingColor === '#4caf50' ? classes.active : ''}`}
                  style={{ backgroundColor: '#4caf50' }}
                  onClick={() => changeDrawingColor('#4caf50')}
                  title='Green'
                />
                <button
                  className={`${classes.colorOption} ${drawingColor === '#f44336' ? classes.active : ''}`}
                  style={{ backgroundColor: '#f44336' }}
                  onClick={() => changeDrawingColor('#f44336')}
                  title='Red'
                />
                <button
                  className={`${classes.colorOption} ${drawingColor === '#ff9800' ? classes.active : ''}`}
                  style={{ backgroundColor: '#ff9800' }}
                  onClick={() => changeDrawingColor('#ff9800')}
                  title='Orange'
                />
                <button
                  className={`${classes.colorOption} ${drawingColor === '#000000' ? classes.active : ''}`}
                  style={{ backgroundColor: '#000000' }}
                  onClick={() => changeDrawingColor('#000000')}
                  title='Black'
                />
              </div>
            </div>

            {(drawingMode === 'freehand' ||
              drawingMode === 'rectangle' ||
              drawingMode === 'line' ||
              drawingMode === 'drawArea') && (
              <div className={classes.lineWidthPicker}>
                <span>Width:</span>
                <div className={classes.lineWidthOptions}>
                  <button
                    className={`${classes.lineWidthOption} ${drawingLineWidth === 1 ? classes.active : ''}`}
                    onClick={() => changeLineWidth(1)}
                    title='Thin'>
                    <div className={classes.lineWidthPreview} style={{ height: '1px' }} />
                  </button>
                  <button
                    className={`${classes.lineWidthOption} ${drawingLineWidth === 2 ? classes.active : ''}`}
                    onClick={() => changeLineWidth(2)}
                    title='Medium'>
                    <div className={classes.lineWidthPreview} style={{ height: '2px' }} />
                  </button>
                  <button
                    className={`${classes.lineWidthOption} ${drawingLineWidth === 4 ? classes.active : ''}`}
                    onClick={() => changeLineWidth(4)}
                    title='Thick'>
                    <div className={classes.lineWidthPreview} style={{ height: '4px' }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Separator */}
        {totalDrawingsCount > 0 && <div className={classes.separator}></div>}

        {/* Drawing Management */}
        {totalDrawingsCount > 0 && (
          <div className={classes.drawingManagement}>
            <div className={classes.clearButtons}>
              <button
                className={classes.clearButton}
                onClick={clearPageDrawings}
                disabled={currentPageTotalCount === 0}
                title='Clear annotations on current page'>
                Page
              </button>
              <button className={classes.clearButton} onClick={clearAllDrawings} title='Clear all annotations'>
                All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
