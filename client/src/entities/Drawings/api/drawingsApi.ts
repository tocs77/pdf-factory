import { rtkApi } from '@/shared/api/rtkApi/rtkApi';
import { DrawingDto } from '@/widgets/Viewer';
import { drawingController } from '@/shared/api';

const drawingsApi = rtkApi.enhanceEndpoints({ addTagTypes: ['drawings', 'drawing'] }).injectEndpoints({
  endpoints: (build) => ({
    getDrawings: build.query<DrawingDto[], string>({
      queryFn: async (fileId) => {
        const response = await drawingController.getDrawings(fileId);
        if (response.type === 'error') return { error: response.message };
        return { data: response.payload };
      },
      providesTags: (_, _1, fileId) => [{ type: 'drawings', id: fileId }],
    }),

    getDrawing: build.query<DrawingDto, number>({
      queryFn: async (id) => {
        const response = await drawingController.getDrawing(id);
        if (response.type === 'error') return { error: response.message };
        return { data: response.payload };
      },
      providesTags: (result) => (result ? [{ type: 'drawing', id: result.id }] : []),
    }),

    createDrawing: build.mutation<DrawingDto, Omit<DrawingDto, 'id'>>({
      queryFn: async (drawing) => {
        const response = await drawingController.createDrawing(drawing);
        if (response.type === 'error') return { error: response.message };
        return { data: response.payload };
      },
      invalidatesTags: (result) => [
        { type: 'drawings', id: result?.fileId },
        result ? { type: 'drawing', id: result.fileId } : { type: 'drawings' },
      ],
    }),

    updateDrawing: build.mutation<DrawingDto, { id: number; drawing: Partial<DrawingDto> }>({
      queryFn: async ({ id, drawing }) => {
        const response = await drawingController.updateDrawing(id, drawing);
        if (response.type === 'error') return { error: response.message };
        return { data: response.payload };
      },
      invalidatesTags: (result) => [result ? { type: 'drawing', id: result.id } : { type: 'drawings' }],
    }),

    deleteDrawing: build.mutation<void, { id: string; fileId: string }>({
      queryFn: async ({ id }) => {
        const response = await drawingController.deleteDrawing(id);
        if (response.type === 'error') return { error: response.message };
        return { data: response.payload };
      },
      invalidatesTags: (_, _1, { fileId }) => [{ type: 'drawings', id: fileId }],
    }),

    deleteDrawingsByFile: build.mutation<void, string>({
      queryFn: async (fileId) => {
        const response = await drawingController.deleteDrawingsByFile(fileId);
        if (response.type === 'error') return { error: response.message };
        return { data: response.payload };
      },
      invalidatesTags: () => [{ type: 'drawings', id: 'LIST' }],
    }),

    bulkCreateDrawings: build.mutation<DrawingDto[], DrawingDto[]>({
      queryFn: async (drawings) => {
        const response = await drawingController.bulkCreateDrawings(drawings);
        if (response.type === 'error') return { error: response.message };
        return { data: response.payload };
      },
      invalidatesTags: (result) => [
        { type: 'drawings', id: 'LIST' },
        ...(result?.map((drawing) => ({ type: 'drawing' as const, id: drawing.fileId })) || []),
      ],
    }),
  }),
});

export const {
  useGetDrawingsQuery,
  useGetDrawingQuery,
  useCreateDrawingMutation,
  useUpdateDrawingMutation,
  useDeleteDrawingMutation,
  useDeleteDrawingsByFileMutation,
  useBulkCreateDrawingsMutation,
} = drawingsApi;
