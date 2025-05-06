export interface BoundingBox {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface DrawingDto {
  id: string;
  fileId: string;
  type: string;
  pageNumber: number;
  image: string;
  boundingBox: BoundingBox;
  data: string;
}
