import React, { useContext, useState, KeyboardEvent, useEffect, useRef } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { DrawingMode } from '../../model/types/viewerSchema';
import { classNames } from '@/shared/utils';
import classes from './ViewerMenu.module.scss';

interface ViewerMenuProps {
  currentPage: number;
  totalPages?: number;
  onPageChange?: (pageNumber: number) => void;
  hasCompare?: boolean;
  comparePage?: number;
  totalComparePages?: number;
  onComparePageChange?: (pageNumber: number) => void;
}

const DEBOUNCE_TIME = 1000;

export const ViewerMenu: React.FC<ViewerMenuProps> = ({
  currentPage,
  totalPages = 0,
  onPageChange,
  hasCompare,
  comparePage,
  totalComparePages = 0,
  onComparePageChange,
}) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, drawingMode, showThumbnails, pageRotations, rulerEnabled, compareMode } = state;

  const [pageInputValue, setPageInputValue] = useState<string>(currentPage.toString());
  const mainPageDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [comparePageInputValue, setComparePageInputValue] = useState<string>(comparePage ? comparePage.toString() : '');
  const comparePageDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const navigateToEnteredPage = () => {
    const pageNumber = parseInt(pageInputValue, 10);
    if (pageNumber && pageNumber >= 1 && pageNumber <= totalPages && onPageChange) {
      onPageChange(pageNumber);
    } else {
      setPageInputValue(currentPage.toString());
    }
  };

  useEffect(() => {
    if (pageInputValue === currentPage.toString()) return;
    if (mainPageDebounceTimerRef.current) clearTimeout(mainPageDebounceTimerRef.current);
    mainPageDebounceTimerRef.current = setTimeout(() => {
      navigateToEnteredPage();
    }, DEBOUNCE_TIME);
    return () => {
      if (mainPageDebounceTimerRef.current) clearTimeout(mainPageDebounceTimerRef.current);
    };
  }, [pageInputValue, currentPage, totalPages, onPageChange]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setPageInputValue(value);
  };

  const handlePageInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (mainPageDebounceTimerRef.current) clearTimeout(mainPageDebounceTimerRef.current);
      navigateToEnteredPage();
    }
  };

  useEffect(() => {
    setComparePageInputValue(comparePage ? comparePage.toString() : '');
  }, [comparePage]);

  const navigateToEnteredComparePage = () => {
    const pageNumber = parseInt(comparePageInputValue, 10);
    if (pageNumber && pageNumber >= 1 && pageNumber <= totalComparePages && onComparePageChange) {
      onComparePageChange(pageNumber);
    } else {
      setComparePageInputValue(comparePage ? comparePage.toString() : '');
    }
  };

  useEffect(() => {
    if (!onComparePageChange || comparePageInputValue === (comparePage?.toString() ?? '')) return;

    if (comparePageDebounceTimerRef.current) clearTimeout(comparePageDebounceTimerRef.current);
    comparePageDebounceTimerRef.current = setTimeout(() => {
      navigateToEnteredComparePage();
    }, DEBOUNCE_TIME);
    return () => {
      if (comparePageDebounceTimerRef.current) clearTimeout(comparePageDebounceTimerRef.current);
    };
  }, [comparePageInputValue, comparePage, totalComparePages, onComparePageChange]);

  const handleComparePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setComparePageInputValue(value);
  };

  const handleComparePageInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (comparePageDebounceTimerRef.current) clearTimeout(comparePageDebounceTimerRef.current);
      navigateToEnteredComparePage();
    }
  };

  const zoomIn = () => dispatch({ type: 'setScale', payload: scale + 0.25 });
  const zoomOut = () => dispatch({ type: 'setScale', payload: scale - 0.25 });
  const resetZoom = () => dispatch({ type: 'setScale', payload: 1.5 });

  const rotatePageClockwise = () => dispatch({ type: 'rotatePageClockwise', payload: currentPage });
  const rotatePageCounterClockwise = () => dispatch({ type: 'rotatePageCounterClockwise', payload: currentPage });

  const toggleRuler = () => dispatch({ type: 'toggleRuler' });

  const changeDrawingMode = (mode: DrawingMode) => {
    if (mode === drawingMode) {
      dispatch({ type: 'setDrawingMode', payload: 'none' });
    } else {
      dispatch({ type: 'setDrawingMode', payload: mode });
    }
  };

  const changeDrawingColor = (color: string) => {
    dispatch({ type: 'setDrawingColor', payload: color });
  };

  const changeLineWidth = (width: number) => {
    dispatch({ type: 'setDrawingLineWidth', payload: width });
  };

  const toggleTextHighlight = () => {
    dispatch({ type: 'setDrawingMode', payload: drawingMode === 'textHighlight' ? 'none' : 'textHighlight' });
  };

  const toggleTextUnderline = () => {
    dispatch({ type: 'setDrawingMode', payload: drawingMode === 'textUnderline' ? 'none' : 'textUnderline' });
  };

  const toggleTextCrossedOut = () => {
    dispatch({ type: 'setDrawingMode', payload: drawingMode === 'textCrossedOut' ? 'none' : 'textCrossedOut' });
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
        <div className={classes.pageInputContainer}>
          <div className={classes.pageCounter}>
            <input
              type='text'
              value={pageInputValue}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              onBlur={() => {
                if (mainPageDebounceTimerRef.current) clearTimeout(mainPageDebounceTimerRef.current);
                navigateToEnteredPage();
              }}
              className={classes.pageInput}
              title='Enter main page number'
              aria-label='Current main page'
            />
            <span>/{totalPages}</span>
          </div>
          {/* Show compare page input only if a compare mode is active */}
          {compareMode !== 'none' && (
            <>
              <span className={classes.pageSeparator}>vs</span>
              <div className={classes.pageCounter}>
                <input
                  type='text'
                  value={comparePageInputValue}
                  onChange={handleComparePageInputChange}
                  onKeyDown={handleComparePageInputKeyDown}
                  onBlur={() => {
                    if (comparePageDebounceTimerRef.current) clearTimeout(comparePageDebounceTimerRef.current);
                    navigateToEnteredComparePage();
                  }}
                  className={classes.pageInput}
                  title='Enter comparison page number'
                  aria-label='Current comparison page'
                  disabled={!onComparePageChange}
                />
                <span>/{totalComparePages > 0 ? totalComparePages : '?'}</span>
              </div>
            </>
          )}
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

      <button
        onClick={toggleRuler}
        className={`${classes.zoomButton} ${rulerEnabled ? classes.active : ''}`}
        style={{ padding: '4px' }}
        title='Ruler tool'>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='16'
          height='16'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.75'
          strokeLinecap='round'
          strokeLinejoin='round'>
          <path d='M2 8h20v8H2z' fill='rgba(255,255,255,0.15)'></path>
          <rect x='2' y='8' width='20' height='8'></rect>
          <line x1='6' y1='8' x2='6' y2='12'></line>
          <line x1='10' y1='8' x2='10' y2='16'></line>
          <line x1='14' y1='8' x2='14' y2='12'></line>
          <line x1='18' y1='8' x2='18' y2='16'></line>
        </svg>
      </button>

      <button onClick={resetZoom} className={classes.zoomButton} title='Reset zoom'>
        Reset
      </button>

      {hasCompare && (
        <>
          {/* Diff Compare Button */}
          <button
            onClick={() => dispatch({ type: 'setCompareMode', payload: compareMode === 'diff' ? 'none' : 'diff' })}
            className={`${classes.zoomButton} ${compareMode === 'diff' ? classes.active : ''}`}
            title={compareMode === 'diff' ? 'Disable Diff Compare' : 'Enable Diff Compare'}>
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
              {/* First document slightly offset */}
              <rect x='5' y='3' width='12' height='16' rx='1' />
              {/* Second document overlapping */}
              <rect x='9' y='5' width='12' height='16' rx='1' />
              {/* Diff indicator lines */}
              <line x1='12' y1='9' x2='16' y2='9' />
              <line x1='12' y1='13' x2='18' y2='13' />
              <line x1='12' y1='17' x2='14' y2='17' />
            </svg>
          </button>
          {/* Side-by-Side Compare Button */}
          <button
            onClick={() => dispatch({ type: 'setCompareMode', payload: compareMode === 'sideBySide' ? 'none' : 'sideBySide' })}
            className={`${classes.zoomButton} ${compareMode === 'sideBySide' ? classes.active : ''}`}
            title={compareMode === 'sideBySide' ? 'Disable Side-by-Side Compare' : 'Enable Side-by-Side Compare'}>
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
              <rect x='3' y='3' width='7' height='18' rx='1'></rect>
              <rect x='14' y='3' width='7' height='18' rx='1'></rect>
              <line x1='10' y1='12' x2='14' y2='12'></line>
            </svg>
          </button>
        </>
      )}

      <div className={classes.toolPanel}>
        {(drawingMode === 'freehand' ||
          drawingMode === 'rectangle' ||
          drawingMode === 'extensionLine' ||
          drawingMode === 'line' ||
          drawingMode === 'drawArea' ||
          drawingMode === 'textArea' ||
          drawingMode === 'textHighlight' ||
          drawingMode === 'textUnderline' ||
          drawingMode === 'textCrossedOut' ||
          drawingMode === 'PinSelection') && (
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
              drawingMode === 'drawArea' ||
              drawingMode === 'textUnderline' ||
              drawingMode === 'textCrossedOut') && (
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

        {drawingMode !== 'none' && drawingMode !== 'zoomArea' && drawingMode !== 'ruler' && drawingMode !== 'PinSelection' && (
          <div className={classes.separator}></div>
        )}

        <div className={classes.toolButtons}>
          <div className={classes.toolGroup}>
            <button
              className={`${classes.toolButton} ${drawingMode === 'textHighlight' ? classes.active : ''}`}
              onClick={toggleTextHighlight}
              title={drawingMode === 'textHighlight' ? 'Disable text highlight' : 'Enable text highlight'}>
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
                <path d='M12 20l9-9-4-4-9 9v4h4zm-6.2-2.8L12 10.6l4-4' />
                <path d='M3 21h18' />
              </svg>
            </button>
            <button
              className={`${classes.toolButton} ${drawingMode === 'textUnderline' ? classes.active : ''}`}
              onClick={toggleTextUnderline}
              title={drawingMode === 'textUnderline' ? 'Disable text underline' : 'Enable text underline'}>
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
                <path d='M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3' />
                <line x1='4' y1='21' x2='20' y2='21' />
              </svg>
            </button>
            <button
              className={`${classes.toolButton} ${drawingMode === 'textCrossedOut' ? classes.active : ''}`}
              onClick={toggleTextCrossedOut}
              title={drawingMode === 'textCrossedOut' ? 'Disable text crossed out' : 'Enable text crossed out'}>
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
                <line x1='4' y1='12' x2='20' y2='12' />
                <path d='M6 20v-8a6 6 0 0 1 12 0v8' />
              </svg>
            </button>
          </div>

          <div className={classes.separator}></div>

          <div className={classes.toolGroup}>
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

            <button
              className={`${classes.toolButton} ${drawingMode === 'extensionLine' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('extensionLine')}
              title={drawingMode === 'extensionLine' ? 'Disable extension line tool' : 'Enable extension line tool'}>
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
                <polyline points='5,19 17,17 19,5' />
                <polyline points='16 3 19 5 16 7' />
              </svg>
            </button>

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

          <div className={classes.separator}></div>

          <div className={classes.toolGroup}>
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
            <button
              className={`${classes.toolButton} ${drawingMode === 'RectSelection' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('RectSelection')}
              title={drawingMode === 'RectSelection' ? 'Disable rect selection tool' : 'Enable rect selection tool'}>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeDasharray='4 4'>
                <rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect>
              </svg>
            </button>
            <button
              className={`${classes.toolButton} ${drawingMode === 'PinSelection' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('PinSelection')}
              title={drawingMode === 'PinSelection' ? 'Disable pin selection tool' : 'Enable pin selection tool'}>
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
          </div>
        </div>
      </div>
    </div>
  );
};
