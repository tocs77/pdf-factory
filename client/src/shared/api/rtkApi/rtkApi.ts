import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';

const customBaseQuery: BaseQueryFn = async (arg: Promise<Response>, { signal, dispatch, getState }, extraOptions) => {
  const res = await arg;
  console.log('query res', res);
  console.log('Called custom base query with', arg, signal, dispatch, getState, extraOptions);
  return { data: 1 };
};

export const rtkApi = createApi({
  reducerPath: 'rtkApi',
  baseQuery: customBaseQuery,
  endpoints: (_) => ({}),
});
