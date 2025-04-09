import { ColumnDef } from '@tanstack/react-table';

import { FileDto } from '@/entities/File';
import { makeFileSizeString } from '@/shared/utils';

import { FaDownload, FaTrash } from 'react-icons/fa';
import classes from '../ui/MainPage.module.scss';

export const makeColumns = (deleteFile: (id: string) => void, downloadFile: (id: string) => void): ColumnDef<FileDto>[] => [
  {
    id: 'name',
    accessorFn: (p) => p.filename,
    header: 'Наименование',
  },
  {
    id: 'size',
    accessorFn: (p) => makeFileSizeString(p.size),
    header: 'Размер',
    maxSize: 150,
  },
  {
    id: 'created',
    accessorFn: (p) => new Date(p.createdAt).toLocaleDateString(),
    header: 'Дата создания',
    maxSize: 150,
  },
  {
    id: 'delete',
    cell: ({ row }) => (
      <div className={classes.actionIcons}>
        <div className={classes.delete}>
          <FaTrash onClick={() => deleteFile(row.original.id)} />
        </div>
        <div className={classes.download}>
          <FaDownload onClick={() => downloadFile(row.original.id)} />
        </div>
      </div>
    ),
    maxSize: 50,
  },
];
