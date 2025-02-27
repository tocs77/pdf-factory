import { useGetFilesListQuery } from '@/entities/File';
import { fileController } from '@/shared/api/controllers/fileController';
import { useState, useMemo } from 'react';
import { columns } from '../model/columns';
import { Table } from '@/shared/ui/Table';

export const MainPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const { data: files } = useGetFilesListQuery();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
    }
  };
  const handleSubmit = async () => {
    if (file) {
      await fileController.uploadFile(file);
    }
  };
  const data = useMemo(() => {
    if (!files) return [];
    return files;
  }, [files]);
  return (
    <div>
      <input type='file' onChange={handleFileChange} />
      <button onClick={handleSubmit}>Upload</button>
      <Table
        columns={columns}
        data={data}
        initialState={{ columnVisibility: { handle: false } }}
        // rowContextHandler={contextMenuHandler}
        // rowClickHandler={openProject}
        textAlign='left'
        //getRowId={(p) => String(p.identifier)}
        getRowId={(p) => String(p.id)}
      />
    </div>
  );
};
