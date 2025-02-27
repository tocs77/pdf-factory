import { BaseModel } from '@/shared/types';

export interface FileDto extends BaseModel {
  filename: string;
  hash: string;
}
