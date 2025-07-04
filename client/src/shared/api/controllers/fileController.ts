import { instance, Response, parseErrorMessage } from '../axios';
import { FileDto } from '@/entities/File';

class FileController {
  async uploadFile(file: File): Response<void> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await instance.post('/upload', formData);
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
  async deleteFile(id: string): Response<void> {
    try {
      await instance.delete(`/files/${id}`);
      return { payload: undefined, type: 'payload' };
    } catch (error) {
      console.log('Got api load error: ', error);
      return { message: parseErrorMessage(error), type: 'error' };
    }
  }

  async downloadBlobUrl(id: string): Response<string> {
    let response;
    try {
      response = await instance.get<ArrayBuffer>(`/files/${id}/download`, {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/octet-stream',
        },
      });
      if (response.data.byteLength === 0) return { type: 'error', message: 'Не удалось загрузить превью' };
      const url = window.URL.createObjectURL(new Blob([response.data]));
      return { payload: url, type: 'payload' };
    } catch (error) {
      return { type: 'error', message: parseErrorMessage(error) };
    }
  }
  async downloadBlob(id: string) {
    let response;
    try {
      response = await instance.get(`/files/${id}/download`, {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/octet-stream',
        },
      });

      const blob = new Blob([response.data]);
      return { value: blob, error: false };
    } catch (error) {
      return { type: 'error', message: parseErrorMessage(error) };
    }
  }

  async downloadFile(id: string): Response<void> {
    let response;
    try {
      response = await instance.get(`/files/${id}/download`, {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/octet-stream',
        },
      });
    } catch (error) {
      return { type: 'error', message: parseErrorMessage(error) };
    }

    // Extract filename from content-disposition header
    const contentDisposition = response.headers['content-disposition'];
    let fileName = 'downloaded_file'; // Default filename

    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
      if (fileNameMatch && fileNameMatch[1]) {
        fileName = fileNameMatch[1];
        // Remove leading/trailing quotes if present
        fileName = fileName.replace(/^"|"$/g, '');
        // Decode percent-encoded characters and replace '+' with space
        fileName = decodeURIComponent(fileName.replace(/\+/g, ' '));
      } else {
        // Fallback for simpler filename= format if the above fails
        const simplerMatch = contentDisposition.match(/filename="?([^;"]+)"?/i);
        if (simplerMatch && simplerMatch[1]) {
          fileName = simplerMatch[1];
          // Still decode and replace pluses, just in case
          fileName = decodeURIComponent(fileName.replace(/\+/g, ' '));
        }
      }
    }

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url); // Clean up the object URL
    return { type: 'payload', payload: undefined };
  }
}

export const fileController = new FileController();
