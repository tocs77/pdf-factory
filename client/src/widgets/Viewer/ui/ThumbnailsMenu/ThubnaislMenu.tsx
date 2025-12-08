import { PDFPageProxy } from 'pdfjs-dist';

import { PagesControl } from '../PagesControl/PagesControl';
import { Thumbnail } from '../Thumbnail/Thumbnail';

import classes from './ThumbnailsMenu.module.scss';

interface ThumbnailsMenuProps {
  pages: PDFPageProxy[];
  currentPage: number;
  onThumbnailClick: (pageNumber: number) => void;
  totalPages?: number;
  onPageChange?: (pageNumber: number) => void;
  compareMode: 'none' | 'diff' | 'sideBySide';
  comparePage?: number;
  totalComparePages?: number;
  onComparePageChange?: (pageNumber: number) => void;
}

export const ThumbnailsMenu = ({
  pages,
  currentPage,
  onThumbnailClick,
  totalPages = 0,
  onPageChange,
  compareMode,
  comparePage,
  totalComparePages = 0,
  onComparePageChange,
}: ThumbnailsMenuProps) => {
  return (
    <div className={classes.thumbnailsContainer}>
      <PagesControl
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        compareMode={compareMode}
        comparePage={comparePage}
        totalComparePages={totalComparePages}
        onComparePageChange={onComparePageChange}
      />
      {pages.map((page, index) => (
        <Thumbnail
          key={`thumbnail-${index + 1}`}
          page={page}
          pageNumber={index + 1}
          isSelected={currentPage === index + 1}
          onClick={() => onThumbnailClick(index + 1)}
        />
      ))}
    </div>
  );
};
