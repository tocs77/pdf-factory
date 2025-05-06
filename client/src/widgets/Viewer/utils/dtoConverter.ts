import { Drawing } from '../model/types/Drawings';
import { DrawingDto } from '../model/types/DrawingDto';

export const convertDrawingDtoToDrawing = (drawingDto: DrawingDto): Drawing => {
  return {
    id: drawingDto.id,
    type: drawingDto.type,
    pageNumber: drawingDto.pageNumber,
    image: drawingDto.image,
    boundingBox: drawingDto.boundingBox,
    ...JSON.parse(drawingDto.data),
  };
};

export const convertDrawingToDrawingDto = (drawing: Drawing, fileId: string): DrawingDto => {
  return {
    id: drawing.id,
    fileId: fileId,
    type: drawing.type,
    pageNumber: drawing.pageNumber,
    image: drawing.image || '',
    boundingBox: drawing.boundingBox,
    data: JSON.stringify({
      ...drawing,
      id: undefined,
      type: undefined,
      pageNumber: undefined,
      image: undefined,
      boundingBox: undefined,
    }),
  };
};
