import React, { useContext, useState, KeyboardEvent, useEffect, useRef } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { DrawingMode } from '../../model/types/viewerSchema';
import { classNames } from '@/shared/utils';
import classes from './ViewerMenu.module.scss';

interface ViewerMenuProps {
  currentPage: number;
  totalPages?: number;
  onPageChange?: (pageNumber: number) => void;
}

const DEBOUNCE_TIME = 1000;

export const ViewerMenu: React.FC<ViewerMenuProps> = ({ currentPage, totalPages = 0, onPageChange }) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, drawingMode, showThumbnails, pageRotations, textLayerEnabled } = state;
  const [pageInputValue, setPageInputValue] = useState<string>(currentPage.toString());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update the input value when currentPage prop changes
  React.useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const navigateToEnteredPage = () => {
    const pageNumber = parseInt(pageInputValue, 10);
    if (pageNumber && pageNumber >= 1 && pageNumber <= totalPages && onPageChange) {
      onPageChange(pageNumber);
    } else {
      // Reset to current page if invalid
      setPageInputValue(currentPage.toString());
    }
  };

  // Debounce effect for page input
  useEffect(() => {
    // Don't trigger if it's the initial render or just syncing with currentPage
    if (pageInputValue === currentPage.toString()) {
      return;
    }

    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set a new timer
    debounceTimerRef.current = setTimeout(() => {
      navigateToEnteredPage();
    }, DEBOUNCE_TIME);

    // Cleanup on unmount or when pageInputValue changes again
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [pageInputValue, currentPage, totalPages, onPageChange]);

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
    if (mode === drawingMode) {
      dispatch({ type: 'setDrawingMode', payload: 'none' });
    } else {
      dispatch({ type: 'setDrawingMode', payload: mode });
    }
  };

  const rotatePageClockwise = () => {
    dispatch({ type: 'rotatePageClockwise', payload: currentPage });
  };

  const rotatePageCounterClockwise = () => {
    dispatch({ type: 'rotatePageCounterClockwise', payload: currentPage });
  };

  const toggleTextTools = () => {
    if (!textLayerEnabled) {
      dispatch({ type: 'toggleTextLayer' });
    }
    changeDrawingMode('text');
  };

  const goToPreviousPage = () => {
    if (currentPage > 1 && onPageChange) {
      onPageChange(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages && onPageChange) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numeric input
    const value = e.target.value.replace(/[^0-9]/g, '');
    setPageInputValue(value);
  };

  const handlePageInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      navigateToEnteredPage();
    }
  };

  const currentRotation = pageRotations[currentPage] || 0;

  return (
    <div className={classes.zoomControls}>
      <div className={classes.pageControls}>
        <button className={classes.pageButton} onClick={goToPreviousPage} disabled={currentPage <= 1} title='Previous page'>
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
            <polyline points='15 18 9 12 15 6'></polyline>
          </svg>
        </button>
        <div className={classes.pageCounter}>
          <input
            type='text'
            value={pageInputValue}
            onChange={handlePageInputChange}
            onKeyDown={handlePageInputKeyDown}
            onBlur={navigateToEnteredPage}
            className={classes.pageInput}
            title='Enter page number and press Enter'
            aria-label='Current page'
          />
          <span>/{totalPages}</span>
        </div>
        <button className={classes.pageButton} onClick={goToNextPage} disabled={currentPage >= totalPages} title='Next page'>
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
            <polyline points='9 18 15 12 9 6'></polyline>
          </svg>
        </button>
      </div>

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

      <button onClick={zoomOut} className={classes.zoomButton} title='Zoom out'>
        -
      </button>
      <span className={classes.zoomPercentage}>{Math.round(scale * 100)}%</span>
      <button onClick={zoomIn} className={classes.zoomButton} title='Zoom in'>
        +
      </button>

      <button
        onClick={() => changeDrawingMode('zoomArea')}
        className={`${classes.zoomButton} ${drawingMode === 'zoomArea' ? classes.active : ''}`}
        style={{ padding: '4px' }}
        title='Zoom to selected area'>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='14'
          height='14'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'>
          <circle cx='11' cy='11' r='8'></circle>
          <line x1='21' y1='21' x2='16.65' y2='16.65'></line>
          <line x1='11' y1='8' x2='11' y2='14'></line>
          <line x1='8' y1='11' x2='14' y2='11'></line>
        </svg>
      </button>

      <button onClick={resetZoom} className={classes.zoomButton} title='Reset zoom'>
        Reset
      </button>

      <div className={classes.toolPanel}>
        <div className={classes.toolButtons}>
          <button
            className={`${classes.toolButton} ${drawingMode === 'text' ? classes.active : ''}`}
            onClick={toggleTextTools}
            title={drawingMode === 'text' ? 'Disable text tools' : 'Enable text tools'}>
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

          {/* Text Area Tool */}
          <button
            className={`${classes.toolButton} ${drawingMode === 'textArea' ? classes.active : ''}`}
            onClick={() => changeDrawingMode('textArea')}
            title={drawingMode === 'textArea' ? 'Disable text area tool' : 'Enable text area tool'}>
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
              <line x1='8' y1='8' x2='16' y2='8'></line>
              <line x1='8' y1='12' x2='16' y2='12'></line>
              <line x1='8' y1='16' x2='12' y2='16'></line>
            </svg>
          </button>
        </div>

        {/* Separator */}
        {(drawingMode === 'freehand' ||
          drawingMode === 'rectangle' ||
          drawingMode === 'pin' ||
          drawingMode === 'line' ||
          drawingMode === 'drawArea' ||
          drawingMode === 'textArea' ||
          textLayerEnabled) && <div className={classes.separator}></div>}

        {/* Drawing Options - Show when a drawing tool is selected OR text layer is enabled */}
        {(drawingMode === 'freehand' ||
          drawingMode === 'rectangle' ||
          drawingMode === 'pin' ||
          drawingMode === 'line' ||
          drawingMode === 'drawArea' ||
          drawingMode === 'textArea' ||
          textLayerEnabled) && (
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
      </div>
    </div>
  );
};
