import { useContext, useState, KeyboardEvent, useEffect, useRef } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CompareDiffIcon,
  CompareSideBySideIcon,
  DrawAreaIcon,
  ExtensionLineIcon,
  ImageIcon,
  LineIcon,
  PencilIcon,
  PinSelectionIcon,
  RectangleIcon,
  RectSelectionIcon,
  RotateCcwIcon,
  RotateCwIcon,
  RulerIcon,
  TextAreaIcon,
  TextHighlightIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
  ThumbnailToggleIcon,
  ZoomAreaIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@/shared/ui/Icons';
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

export const ViewerMenu = (props: ViewerMenuProps) => {
  const {
    currentPage,
    totalPages = 0,
    onPageChange,
    hasCompare,
    comparePage,
    totalComparePages = 0,
    onComparePageChange,
  } = props;
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingMode, showThumbnails, pageRotations, compareMode } = state;

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

  const toggleTextHighlight = () => {
    dispatch({
      type: 'setDrawingMode',
      payload: drawingMode === 'textHighlight' ? 'none' : 'textHighlight',
    });
  };

  const toggleTextUnderline = () => {
    dispatch({
      type: 'setDrawingMode',
      payload: drawingMode === 'textUnderline' ? 'none' : 'textUnderline',
    });
  };

  const toggleTextCrossedOut = () => {
    dispatch({
      type: 'setDrawingMode',
      payload: drawingMode === 'textCrossedOut' ? 'none' : 'textCrossedOut',
    });
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
        <button className={classes.pageButton} onClick={goToPreviousPage} disabled={currentPage <= 1} title='Предыдущая страница'>
          <ChevronLeftIcon />
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
              title='Введите номер основной страницы'
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
                  title='Введите номер страницы для сравнения'
                  aria-label='Current comparison page'
                  disabled={!onComparePageChange}
                />
                <span>/{totalComparePages > 0 ? totalComparePages : '?'}</span>
              </div>
            </>
          )}
        </div>
        <button
          className={classes.pageButton}
          onClick={goToNextPage}
          disabled={currentPage >= totalPages}
          title='Следующая страница'>
          <ChevronRightIcon />
        </button>
      </div>

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
        <span className={classes.rotationInfo}>{currentRotation}°</span>
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

      <button
        onClick={() => changeDrawingMode('zoomArea')}
        className={`${classes.zoomButton} ${drawingMode === 'zoomArea' ? classes.active : ''}`}
        style={{ padding: '4px' }}
        title='Увеличить выбранную область'>
        <ZoomAreaIcon />
      </button>

      <button
        onClick={toggleRuler}
        className={`${classes.zoomButton} ${drawingMode === 'ruler' ? classes.active : ''}`}
        style={{ padding: '4px' }}
        title='Инструмент линейка'>
        <RulerIcon />
      </button>

      <button onClick={resetZoom} className={classes.zoomButton} title='Сбросить масштаб'>
        Сбросить
      </button>

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

      <div className={classes.toolPanel}>
        {drawingMode !== 'none' && drawingMode !== 'zoomArea' && drawingMode !== 'ruler' && drawingMode !== 'pinSelection' && (
          <div className={classes.separator}></div>
        )}

        <div className={classes.toolButtons}>
          <div className={classes.toolGroup}>
            <button
              className={`${classes.toolButton} ${drawingMode === 'textHighlight' ? classes.active : ''}`}
              onClick={toggleTextHighlight}
              title={drawingMode === 'textHighlight' ? 'Отключить выделение текста' : 'Включить выделение текста'}>
              <TextHighlightIcon />
            </button>
            <button
              className={`${classes.toolButton} ${drawingMode === 'textUnderline' ? classes.active : ''}`}
              onClick={toggleTextUnderline}
              title={drawingMode === 'textUnderline' ? 'Отключить подчеркивание текста' : 'Включить подчеркивание текста'}>
              <TextUnderlineIcon />
            </button>
            <button
              className={`${classes.toolButton} ${drawingMode === 'textCrossedOut' ? classes.active : ''}`}
              onClick={toggleTextCrossedOut}
              title={drawingMode === 'textCrossedOut' ? 'Отключить зачеркивание текста' : 'Включить зачеркивание текста'}>
              <TextStrikethroughIcon />
            </button>
          </div>

          <div className={classes.separator}></div>

          <div className={classes.toolGroup}>
            <button
              className={`${classes.toolButton} ${drawingMode === 'freehand' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('freehand')}
              title={drawingMode === 'freehand' ? 'Отключить рисование от руки' : 'Включить рисование от руки'}>
              <PencilIcon />
            </button>

            <button
              className={`${classes.toolButton} ${drawingMode === 'rectangle' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('rectangle')}
              title={drawingMode === 'rectangle' ? 'Отключить инструмент прямоугольник' : 'Включить инструмент прямоугольник'}>
              <RectangleIcon />
            </button>

            <button
              className={`${classes.toolButton} ${drawingMode === 'extensionLine' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('extensionLine')}
              title={drawingMode === 'extensionLine' ? 'Отключить инструмент выноска' : 'Включить инструмент выноска'}>
              <ExtensionLineIcon />
            </button>

            <button
              className={`${classes.toolButton} ${drawingMode === 'line' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('line')}
              title={drawingMode === 'line' ? 'Отключить инструмент линия' : 'Включить инструмент линия'}>
              <LineIcon />
            </button>

            <button
              className={`${classes.toolButton} ${drawingMode === 'textArea' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('textArea')}
              title={drawingMode === 'textArea' ? 'Отключить инструмент область текста' : 'Включить инструмент область текста'}>
              <TextAreaIcon />
            </button>

            <button
              className={`${classes.toolButton} ${drawingMode === 'image' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('image')}
              title={drawingMode === 'image' ? 'Отменить добавление изображения' : 'Добавить изображение'}>
              <ImageIcon />
            </button>
          </div>

          <div className={classes.separator}></div>

          <div className={classes.toolGroup}>
            <button
              className={`${classes.toolButton} ${drawingMode === 'drawArea' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('drawArea')}
              title={
                drawingMode === 'drawArea' ? 'Отключить инструмент область рисования' : 'Включить инструмент область рисования'
              }>
              <DrawAreaIcon />
            </button>
            <button
              className={`${classes.toolButton} ${drawingMode === 'rectSelection' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('rectSelection')}
              title={
                drawingMode === 'rectSelection'
                  ? 'Отключить инструмент выделения прямоугольником'
                  : 'Включить инструмент выделения прямоугольником'
              }>
              <RectSelectionIcon />
            </button>
            <button
              className={`${classes.toolButton} ${drawingMode === 'pinSelection' ? classes.active : ''}`}
              onClick={() => changeDrawingMode('pinSelection')}
              title={drawingMode === 'pinSelection' ? 'Отключить инструмент выбора пином' : 'Включить инструмент выбора пином'}>
              <PinSelectionIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
