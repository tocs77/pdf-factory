import { rtkApi } from '@/shared/api/rtkApi/rtkApi';
import { FileDto } from '../model/File';
import { fileController } from '@/shared/api/controllers/fileController';
const fileApi = rtkApi.enhanceEndpoints({ addTagTypes: ['files', 'file'] }).injectEndpoints({
  endpoints: (build) => ({
    getFilesList: build.query<FileDto[], void>({
      queryFn: async () => {
        const response = await fileController.getFilesList();
        if (response.type === 'error') return { error: response.message };
        return { data: response.payload };
      },
      providesTags: () => [{ type: 'files' }],
    }),
    deleteFile: build.mutation<void, string>({
      queryFn: async (id) => {
        const response = await fileController.deleteFile(id);
        if (response.type === 'error') return { error: response.message };
        return { data: response.payload };
      },
      invalidatesTags: () => [{ type: 'files' }],
    }),
    uploadFile: build.mutation<void, File>({
      queryFn: async (file) => {
        const response = await fileController.uploadFile(file);
        if (response.type === 'error') return { error: response.message };
        return { data: response.payload };
      },
      invalidatesTags: () => [{ type: 'files' }],
    }),
    getFileBlobUrl: build.query<string, string>({
      queryFn: async (id) => {
        const response = await fileController.downloadBlobUrl(id);
        if (response.type === 'error') return { error: response.message };
        return { data: response.payload };
      },
      providesTags: () => [{ type: 'file' }],
    }),
  }),
});

export const { useGetFilesListQuery, useDeleteFileMutation, useUploadFileMutation, useGetFileBlobUrlQuery } = fileApi;
