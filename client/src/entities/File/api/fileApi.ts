import { rtkApi } from '@/shared/api/rtkApi/rtkApi';
import { FileDto } from '../model/File';
import { fileController } from '@/shared/api/controllers/fileController';
import { compareController, PageMatchResult } from '@/shared/api/controllers/compareController';
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
    matchPages: build.mutation<PageMatchResult, { fileIdA: string; fileIdB: string }>({
      queryFn: async ({ fileIdA, fileIdB }) => {
        const response = await compareController.matchPages(fileIdA, fileIdB);
        if (response.type === 'error') return { error: response.message };
        return { data: response.payload };
      },
    }),
  }),
});

export const {
  useGetFilesListQuery,
  useDeleteFileMutation,
  useUploadFileMutation,
  useGetFileBlobUrlQuery,
  useMatchPagesMutation,
} = fileApi;
