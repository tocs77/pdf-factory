import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useGetFilesListQuery, useDeleteFileMutation, useUploadFileMutation } from '@/entities/File';
import { SelectableTable } from '@/shared/ui/Table';

import { makeColumns } from '../model/columns';

import classes from './MainPage.module.scss';
import { fileController } from '@/shared/api/controllers/fileController';
export const MainPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const { data: files } = useGetFilesListQuery();
  const [deleteFile] = useDeleteFileMutation();
  const [uploadFile] = useUploadFileMutation();
  const [selectedHandles, setSelectedHandles] = useState<string[]>([]);
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
  const handleDownloadFile = (id: string) => {
    fileController.downloadFile(id);
  };
  const data = useMemo(() => {
    if (!files) return [];
    return files;
  }, [files]);
  const handleDeleteFile = (id: string) => {
    deleteFile(id);
  };

  const handleOpenFiles = () => {
    navigate({ pathname: `/view/${selectedHandles[0]}`, search: selectedHandles[1] ? `?compare=${selectedHandles[1]}` : '' });
  };

  const selectionChangeHandler = (selectedRows: Record<string, boolean>) => {
    const handles = Object.keys(selectedRows).filter((key) => selectedRows[key]);
    setSelectedHandles(handles);
  };

  return (
    <div className={classes.MainPage}>
      <div className={classes.uploadSection}>
        <div className={classes.fileInputWrapper}>
          <label htmlFor='file-upload' className={classes.fileInputLabel}>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='24'
              height='24'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'>
              <path d='M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z'></path>
              <polyline points='13 2 13 9 20 9'></polyline>
            </svg>
            Choose File
          </label>
          <input id='file-upload' type='file' className={classes.fileInput} onChange={handleFileChange} />
        </div>

        <div className={classes.fileNameDisplay}>{file ? file.name : 'No file selected'}</div>

        <button className={classes.uploadButton} onClick={handleSubmit} disabled={!file}>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='24'
            height='24'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'>
            <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'></path>
            <polyline points='17 8 12 3 7 8'></polyline>
            <line x1='12' y1='3' x2='12' y2='15'></line>
          </svg>
          Upload
        </button>
        <button
          className={classes.openButton}
          onClick={handleOpenFiles}
          disabled={selectedHandles.length < 1 || selectedHandles.length > 2}>
          Open
        </button>
      </div>

      <div className={classes.table}>
        <SelectableTable
          columns={makeColumns(handleDeleteFile, handleDownloadFile)}
          data={data}
          initialState={{ columnVisibility: { handle: false } }}
          // rowContextHandler={contextMenuHandler}

          textAlign='left'
          //getRowId={(p) => String(p.identifier)}
          getRowId={(p) => String(p.id)}
          multiSelect
          onSelectionChange={selectionChangeHandler}
        />
      </div>
    </div>
  );
};
