import axios from 'axios';

type ResponsePayload<T> = { payload: T; type: 'payload' };
type ResponseError = { type: 'error'; message: string; aborted?: boolean };

export type Response<T> = Promise<ResponsePayload<T> | ResponseError>;

export const instance = axios.create({
  baseURL: '/api/',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseErrorMessage = (error: any): string => {
  const data = error?.response?.data;
  if (!data) {
    if (error?.message) return error.message;
    return 'Ошибка при запросе к серверу';
  }
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    if (data.Exception) console.error(data.Exception);
    if (data?.Message) return data.Message;
    if (data?.message) return data.message;
    if (data?.error_description) return data.error_description;
  }
  try {
    const decoder = new TextDecoder('UTF-8');
    return decoder.decode(data);
  } catch (_err) {
    if (error.message) return error.message;
    if (error.Message) return error.Message;
    return 'Ошибка при запросе к серверу';
  }
};
