import { ColumnDef } from '@tanstack/react-table';

import { FileDto } from '@/entities/File';

export const columns: ColumnDef<FileDto>[] = [
  {
    id: 'name',
    accessorFn: (p) => p.filename,
    header: 'Наименование',
  },
  {
    id: 'created',
    accessorFn: (p) => p.created,
    header: 'Дата создания',
  },
  {
    id: 'updated',
    accessorFn: (p) => p.updated,
    header: 'Дата обновления',
  },
];
