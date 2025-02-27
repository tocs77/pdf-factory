import { ColumnDef } from '@tanstack/react-table';

import { FileDto } from '@/entities/File';
import { FaTrash } from 'react-icons/fa';
import classes from '../ui/MainPage.module.scss';
export const makeColumns = (deleteFile: (id: string) => void): ColumnDef<FileDto>[] => [
  {
    id: 'name',
    accessorFn: (p) => p.filename,
    header: 'Наименование',
  },
  {
    id: 'created',
    accessorFn: (p) => p.createdAt,
    header: 'Дата создания',
  },
  {
    id: 'updated',
    accessorFn: (p) => p.updatedAt,
    header: 'Дата обновления',
  },
  {
    id: 'delete',
    cell: ({ row }) => (
      <div className={classes.delete}>
        <FaTrash onClick={() => deleteFile(row.original.id)} />
      </div>
    ),
    maxSize: 50,
  },
];
