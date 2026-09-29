import { instance, Response, parseErrorMessage } from '../axios';

export type PageMatchStatus = 'matched' | 'removed' | 'added';

export interface PageMatchPair {
  page_a: number | null;
  page_b: number | null;
  score: number;
  status: PageMatchStatus;
}

export interface PageMatchResult {
  pairs: PageMatchPair[];
  summary: {
    matched: number;
    removed: number;
    added: number;
  };
}

class CompareController {
  async matchPages(fileIdA: string, fileIdB: string): Response<PageMatchResult> {
    try {
      const response = await instance.post<PageMatchResult>('/compare/match', {
        file_id_a: fileIdA,
        file_id_b: fileIdB,
      });
      return { payload: response.data, type: 'payload' };
    } catch (error) {
      console.log('Got api load error: ', error);
      return { message: parseErrorMessage(error), type: 'error' };
    }
  }
}

export const compareController = new CompareController();
