import { useState, KeyboardEvent, useEffect, useRef } from 'react';

import { ChevronLeftIcon, ChevronRightIcon } from '../Icons';

import classes from './PagesControl.module.scss';

interface PagesControlProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (pageNumber: number) => void;
  compareMode: 'none' | 'diff' | 'sideBySide';
  comparePage?: number;
  totalComparePages?: number;
  onComparePageChange?: (pageNumber: number) => void;
}

const DEBOUNCE_TIME = 1000;

export const PagesControl = (props: PagesControlProps) => {
  const { currentPage, totalPages, onPageChange, compareMode, comparePage, totalComparePages = 0, onComparePageChange } = props;

  const [pageInputValue, setPageInputValue] = useState<string>(currentPage.toString());
  const mainPageDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [comparePageInputValue, setComparePageInputValue] = useState<string>(comparePage ? comparePage.toString() : '');
  const comparePageDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  const navigateToEnteredPage = () => {
    const pageNumber = Number.parseInt(pageInputValue, 10);
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
      const pageNumber = Number.parseInt(pageInputValue, 10);
      if (pageNumber && pageNumber >= 1 && pageNumber <= totalPages && onPageChange) {
        onPageChange(pageNumber);
      } else {
        setPageInputValue(currentPage.toString());
      }
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
    const pageNumber = Number.parseInt(comparePageInputValue, 10);
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
      const pageNumber = Number.parseInt(comparePageInputValue, 10);
      if (pageNumber && pageNumber >= 1 && pageNumber <= totalComparePages && onComparePageChange) {
        onComparePageChange(pageNumber);
      } else {
        setComparePageInputValue(comparePage ? comparePage.toString() : '');
      }
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

  return (
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
  );
};
