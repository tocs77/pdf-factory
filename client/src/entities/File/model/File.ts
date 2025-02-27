import { BaseModel } from '@/shared/types';

export interface FileDto extends BaseModel {
  id: string;
  filename: string;
  hash: string;
}
