import { instance, Response, parseErrorMessage } from '../axios';
import { FileDto } from '@/entities/File';

class FileController {
  async uploadFile(file: File): Response<void> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await instance.post(`upload`, formData);
      return { payload: undefined, type: 'payload' };
    } catch (error) {
      console.log('Got api load error: ', error);
      return { message: parseErrorMessage(error), type: 'error' };
    }
  }
  async getFilesList(): Response<FileDto[]> {
    try {
      const response = await instance.get<FileDto[]>('/files');
      return { payload: response.data, type: 'payload' };
    } catch (error) {
      console.log('Got api load error: ', error);
      return { message: parseErrorMessage(error), type: 'error' };
    }
  }
}

export const fileController = new FileController();
