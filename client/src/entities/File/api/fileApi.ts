import { rtkApi } from '@/shared/api/rtkApi/rtkApi';
import { FileDto } from '../model/File';
import { fileController } from '@/shared/api/controllers/fileController';
const fileApi = rtkApi.enhanceEndpoints({ addTagTypes: ['files'] }).injectEndpoints({
  endpoints: (build) => ({
    getFilesList: build.query<FileDto[], void>({
      queryFn: async () => {
        const response = await fileController.getFilesList();
        if (response.type === 'error') return { error: response.message };
        return { data: response.payload };
      },
      providesTags: () => [{ type: 'files' }],
    }),
  }),
});

export const { useGetFilesListQuery } = fileApi;
