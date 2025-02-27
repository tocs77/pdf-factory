import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useGetFilesListQuery, useDeleteFileMutation, useUploadFileMutation } from '@/entities/File';
import { Table } from '@/shared/ui/Table';

import { makeColumns } from '../model/columns';

import classes from './MainPage.module.scss';
export const MainPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const { data: files } = useGetFilesListQuery();
  const [deleteFile] = useDeleteFileMutation();
  const [uploadFile] = useUploadFileMutation();
  const navigate = useNavigate();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
    }
  };
  const handleSubmit = async () => {
    if (file) {
      await uploadFile(file);
    }
  };
  const data = useMemo(() => {
    if (!files) return [];
    return files;
  }, [files]);
  const handleDeleteFile = (id: string) => {
    deleteFile(id);
  };

  const clickRowHandler = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    navigate(`/view/${id}`);
  };

  return (
    <div className={classes.MainPage}>
      <input type='file' onChange={handleFileChange} />
      <button onClick={handleSubmit}>Upload</button>
      <div className={classes.table}>
        <Table
          columns={makeColumns(handleDeleteFile)}
          data={data}
          initialState={{ columnVisibility: { handle: false } }}
          // rowContextHandler={contextMenuHandler}
          rowClickHandler={clickRowHandler}
          textAlign='left'
          //getRowId={(p) => String(p.identifier)}
          getRowId={(p) => String(p.id)}
        />
      </div>
    </div>
  );
};
