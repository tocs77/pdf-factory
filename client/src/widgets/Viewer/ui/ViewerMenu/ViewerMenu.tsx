import { useContext, useEffect, useRef } from 'react';

import {
  CompareDiffIcon,
  CompareSideBySideIcon,
  RotateCcwIcon,
  RotateCwIcon,
  RulerIcon,
  ThumbnailToggleIcon,
  ZoomAreaIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../Icons';
import { PagesControl } from '../PagesControl/PagesControl';
import { ToolsPanel } from '../ToolsPanel/ToolsPanel';

import { ViewerContext } from '../../model/context/viewerContext';
import { DrawingMode } from '../../model/types/viewerSchema';
import { classNames } from '../../utils/classNames';

import classes from './ViewerMenu.module.scss';

interface ViewerMenuProps {
  currentPage: number;
  totalPages?: number;
  onPageChange?: (pageNumber: number) => void;
  hasCompare?: boolean;
  comparePage?: number;
  totalComparePages?: number;
  onComparePageChange?: (pageNumber: number) => void;
  viewOnly?: boolean;
  extendedControls?: React.ReactNode;
  mobile: boolean;
}

export const ViewerMenu = (props: ViewerMenuProps) => {
  const {
    currentPage,
    totalPages = 0,
    onPageChange,
    hasCompare,
    comparePage,
    totalComparePages = 0,
    onComparePageChange,
    viewOnly = false,
    extendedControls,
    mobile,
  } = props;
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingMode, showThumbnails, compareMode, zoomWithCtrl } = state;

  // Refs to track rotation in progress and prevent rapid clicks
  const isRotationInProgressRef = useRef(false);
  const rotationDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up rotation timer on unmount
  useEffect(() => {
    return () => {
      if (rotationDebounceTimerRef.current) {
        clearTimeout(rotationDebounceTimerRef.current);
      }
    };
  }, []);

  const zoomIn = () => dispatch({ type: 'setScale', payload: scale + 0.25 });
  const zoomOut = () => dispatch({ type: 'setScale', payload: scale - 0.25 });
  console.log('view only', viewOnly);

  const rotatePageClockwise = () => {
    // Prevent rapid clicks by checking if rotation is already in progress
    if (isRotationInProgressRef.current) {
      return;
    }

    // Set the rotation in progress flag
    isRotationInProgressRef.current = true;

    // First make sure the page is scrolled into view
    if (onPageChange) {
      // First trigger the page change to ensure it's scrolled into view
      onPageChange(currentPage);

      // Then, after a small delay, apply the rotation
      setTimeout(() => {
        // First try to scroll directly to the page element
        const pageElement = document.getElementById(`pdf-page-${currentPage}`);
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'auto', block: 'center' });

          // Apply rotation after scrolling
          setTimeout(() => {
            dispatch({ type: 'rotatePageClockwise', payload: currentPage });

            // Reset the rotation in progress flag after sufficient time for rendering
            // This prevents rapid clicks from breaking renders
            if (rotationDebounceTimerRef.current) {
              clearTimeout(rotationDebounceTimerRef.current);
            }
            rotationDebounceTimerRef.current = setTimeout(() => {
              isRotationInProgressRef.current = false;
              rotationDebounceTimerRef.current = null;
            }, 500); // 500ms debounce between rotations
          }, 100);
        } else {
          // If element not found, just rotate
          dispatch({ type: 'rotatePageClockwise', payload: currentPage });

          // Reset the rotation in progress flag
          if (rotationDebounceTimerRef.current) {
            clearTimeout(rotationDebounceTimerRef.current);
          }
          rotationDebounceTimerRef.current = setTimeout(() => {
            isRotationInProgressRef.current = false;
            rotationDebounceTimerRef.current = null;
          }, 500);
        }
      }, 50);
    } else {
      // If no page change handler, just rotate
      dispatch({ type: 'rotatePageClockwise', payload: currentPage });

      // Reset the rotation in progress flag
      if (rotationDebounceTimerRef.current) {
        clearTimeout(rotationDebounceTimerRef.current);
      }
      rotationDebounceTimerRef.current = setTimeout(() => {
        isRotationInProgressRef.current = false;
        rotationDebounceTimerRef.current = null;
      }, 500);
    }
  };

  const rotatePageCounterClockwise = () => {
    // Prevent rapid clicks by checking if rotation is already in progress
    if (isRotationInProgressRef.current) {
      return;
    }

    // Set the rotation in progress flag
    isRotationInProgressRef.current = true;

    // First make sure the page is scrolled into view
    if (onPageChange) {
      // First trigger the page change to ensure it's scrolled into view
      onPageChange(currentPage);

      // Then, after a small delay, apply the rotation
      setTimeout(() => {
        // First try to scroll directly to the page element
        const pageElement = document.getElementById(`pdf-page-${currentPage}`);
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'auto', block: 'center' });

          // Apply rotation after scrolling
          setTimeout(() => {
            dispatch({ type: 'rotatePageCounterClockwise', payload: currentPage });

            // Reset the rotation in progress flag after sufficient time for rendering
            // This prevents rapid clicks from breaking renders
            if (rotationDebounceTimerRef.current) {
              clearTimeout(rotationDebounceTimerRef.current);
            }
            rotationDebounceTimerRef.current = setTimeout(() => {
              isRotationInProgressRef.current = false;
              rotationDebounceTimerRef.current = null;
            }, 500); // 500ms debounce between rotations
          }, 100);
        } else {
          // If element not found, just rotate
          dispatch({ type: 'rotatePageCounterClockwise', payload: currentPage });

          // Reset the rotation in progress flag
          if (rotationDebounceTimerRef.current) {
            clearTimeout(rotationDebounceTimerRef.current);
          }
          rotationDebounceTimerRef.current = setTimeout(() => {
            isRotationInProgressRef.current = false;
            rotationDebounceTimerRef.current = null;
          }, 500);
        }
      }, 50);
    } else {
      // If no page change handler, just rotate
      dispatch({ type: 'rotatePageCounterClockwise', payload: currentPage });

      // Reset the rotation in progress flag
      if (rotationDebounceTimerRef.current) {
        clearTimeout(rotationDebounceTimerRef.current);
      }
      rotationDebounceTimerRef.current = setTimeout(() => {
        isRotationInProgressRef.current = false;
        rotationDebounceTimerRef.current = null;
      }, 500);
    }
  };

  const toggleRuler = () => dispatch({ type: 'toggleRuler' });

  const changeDrawingMode = (mode: DrawingMode) => {
    if (mode === drawingMode) {
      dispatch({ type: 'setDrawingMode', payload: 'none' });
    } else {
      dispatch({ type: 'setDrawingMode', payload: mode });
    }
  };

  return (
    <div className={classes.zoomControls}>
      <PagesControl
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        compareMode={compareMode}
        comparePage={comparePage}
        totalComparePages={totalComparePages}
        onComparePageChange={onComparePageChange}
      />
      <button
        className={classNames(classes.thumbnailToggle, { [classes.active]: showThumbnails }, [])}
        onClick={() => dispatch({ type: 'toggleThumbnails' })}
        title={showThumbnails ? 'Скрыть миниатюры' : 'Показать миниатюры'}>
        <ThumbnailToggleIcon />
      </button>
      <div className={classes.rotationControls}>
        <button onClick={rotatePageCounterClockwise} className={classes.rotationButton} title='Повернуть против часовой стрелки'>
          <RotateCcwIcon />
        </button>
        <button onClick={rotatePageClockwise} className={classes.rotationButton} title='Повернуть по часовой стрелке'>
          <RotateCwIcon />
        </button>
      </div>
      <button onClick={zoomOut} className={classes.zoomButton} title='Уменьшить масштаб'>
        <ZoomOutIcon />
      </button>
      <span className={classes.zoomPercentage}>{Math.round(scale * 100)}%</span>
      <button onClick={zoomIn} className={classes.zoomButton} title='Увеличить масштаб'>
        <ZoomInIcon />
      </button>
      {!viewOnly && (
        <button
          onClick={() => changeDrawingMode('zoomArea')}
          className={`${classes.zoomButton} ${drawingMode === 'zoomArea' ? classes.active : ''}`}
          style={{ padding: '4px' }}
          title='Увеличить выбранную область'>
          <ZoomAreaIcon />
        </button>
      )}
      {!viewOnly && (
        <button
          onClick={toggleRuler}
          className={`${classes.zoomButton} ${drawingMode === 'ruler' ? classes.active : ''}`}
          style={{ padding: '4px' }}
          title='Инструмент линейка'>
          <RulerIcon />
        </button>
      )}
      {!mobile && (
        <label className={classes.zoomCheckbox} title='Масштабирование колесиком мыши только с клавишей Ctrl'>
          <input
            type='checkbox'
            checked={zoomWithCtrl}
            onChange={(e) => dispatch({ type: 'setZoomWithCtrl', payload: e.target.checked })}
          />
          <span>Масштаб с Ctrl</span>
        </label>
      )}

      {extendedControls}
      {hasCompare && (
        <>
          {/* Diff Compare Button */}
          <button
            onClick={() =>
              dispatch({
                type: 'setCompareMode',
                payload: compareMode === 'diff' ? 'none' : 'diff',
              })
            }
            className={`${classes.zoomButton} ${compareMode === 'diff' ? classes.active : ''}`}
            title={compareMode === 'diff' ? 'Отключить сравнение изменений' : 'Включить сравнение изменений'}>
            <CompareDiffIcon />
          </button>
          {/* Side-by-Side Compare Button */}
          <button
            onClick={() =>
              dispatch({
                type: 'setCompareMode',
                payload: compareMode === 'sideBySide' ? 'none' : 'sideBySide',
              })
            }
            className={`${classes.zoomButton} ${compareMode === 'sideBySide' ? classes.active : ''}`}
            title={compareMode === 'sideBySide' ? 'Отключить сравнение бок о бок' : 'Включить сравнение бок о бок'}>
            <CompareSideBySideIcon />
          </button>
        </>
      )}
      {!viewOnly && <ToolsPanel />}
    </div>
  );
};
