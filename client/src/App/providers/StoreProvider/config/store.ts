import { configureStore, Reducer, ReducersMapObject } from '@reduxjs/toolkit';
import { rtkApi } from '@/shared/api';

import { createReducerManager } from './reducerManager';
import { StateSchema, ThunkExtraArg } from './StateSchema';
import { viewerPageReducer } from '@/Pages/ViewPage/model/slice/viewerPageSlice';
import { VIEWER_PAGE_SLICE_NAME } from '@/Pages/ViewPage';

export const createReduxStore = (intialState?: StateSchema, asyncReducers?: ReducersMapObject<StateSchema>) => {
  const rootReducers: ReducersMapObject<StateSchema> = {
    [rtkApi.reducerPath]: rtkApi.reducer,
    [VIEWER_PAGE_SLICE_NAME]: viewerPageReducer,
    ...asyncReducers,
  };

  const reducerManager = createReducerManager(rootReducers);

  const extraArgument: ThunkExtraArg = {
    // api: $api,
    //navigate,
  };

  const store = configureStore({
    reducer: reducerManager.reduce as Reducer<StateSchema>,
    preloadedState: intialState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: {
          extraArgument,
        },
      }).concat(rtkApi.middleware),
  });
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  store.reducerManager = reducerManager;

  return store;
};

export type RootState = StateSchema;
export type AppDispatch = ReturnType<typeof createReduxStore>['dispatch'];
