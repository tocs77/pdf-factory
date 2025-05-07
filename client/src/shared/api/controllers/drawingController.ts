import { DrawingDto } from '@/widgets/Viewer';

import { instance, Response, parseErrorMessage } from '../axios';

class DrawingController {
  // Create a new drawing
  async createDrawing(drawing: Omit<DrawingDto, 'id'>): Response<DrawingDto> {
    try {
      const response = await instance.post<DrawingDto>('/drawings', drawing);
      return { payload: response.data, type: 'payload' };
    } catch (error) {
      console.log('Got api error creating drawing: ', error);
      return { message: parseErrorMessage(error), type: 'error' };
    }
  }

  // Get all drawings for a file
  async getDrawings(fileId: string): Response<DrawingDto[]> {
    try {
      const response = await instance.get<DrawingDto[]>(`/drawings?fileId=${fileId}`);
      return { payload: response.data, type: 'payload' };
    } catch (error) {
      console.log('Got api error fetching drawings: ', error);
      return { message: parseErrorMessage(error), type: 'error' };
    }
  }

  // Get a single drawing by ID
  async getDrawing(id: number): Response<DrawingDto> {
    try {
      const response = await instance.get<DrawingDto>(`/drawings/${id}`);
      return { payload: response.data, type: 'payload' };
    } catch (error) {
      console.log('Got api error fetching drawing: ', error);
      return { message: parseErrorMessage(error), type: 'error' };
    }
  }

  // Update an existing drawing
  async updateDrawing(id: number, drawing: Partial<DrawingDto>): Response<DrawingDto> {
    try {
      const response = await instance.put<DrawingDto>(`/drawings/${id}`, drawing);
      return { payload: response.data, type: 'payload' };
    } catch (error) {
      console.log('Got api error updating drawing: ', error);
      return { message: parseErrorMessage(error), type: 'error' };
    }
  }

  // Delete a drawing
  async deleteDrawing(id: string): Response<void> {
    try {
      await instance.delete(`/drawings/${id}`);
      return { payload: undefined, type: 'payload' };
    } catch (error) {
      console.log('Got api error deleting drawing: ', error);
      return { message: parseErrorMessage(error), type: 'error' };
    }
  }

  // Delete all drawings for a file
  async deleteDrawingsByFile(fileId: string): Response<void> {
    try {
      await instance.delete(`/drawings/file?fileId=${fileId}`);
      return { payload: undefined, type: 'payload' };
    } catch (error) {
      console.log('Got api error deleting file drawings: ', error);
      return { message: parseErrorMessage(error), type: 'error' };
    }
  }

  // Create multiple drawings in a single request
  async bulkCreateDrawings(drawings: DrawingDto[]): Response<DrawingDto[]> {
    try {
      const response = await instance.post<DrawingDto[]>('/drawings/bulk', drawings);
      return { payload: response.data, type: 'payload' };
    } catch (error) {
      console.log('Got api error bulk creating drawings: ', error);
      return { message: parseErrorMessage(error), type: 'error' };
    }
  }

  // Helper method to parse JSON data from a drawing
  parseDrawingData<T>(drawing: DrawingDto): T {
    try {
      return JSON.parse(drawing.data) as T;
    } catch (error) {
      console.error('Error parsing drawing data:', error);
      throw new Error('Invalid drawing data format');
    }
  }
}

export const drawingController = new DrawingController();
