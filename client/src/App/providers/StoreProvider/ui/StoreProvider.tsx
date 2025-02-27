import { PropsWithChildren } from 'react';
import { Provider } from 'react-redux';
import { ReducersMapObject } from '@reduxjs/toolkit';

import { createReduxStore } from '../config/store';
import { StateSchema } from '../config/StateSchema';
import { DeepPartial } from '@/shared/helpers';

interface StoreProviderProps {
  initialState?: StateSchema;
  asyncReducers?: DeepPartial<ReducersMapObject<StateSchema>>;
}

export const StoreProvider = (props: PropsWithChildren<StoreProviderProps>) => {
  const { children, initialState, asyncReducers } = props;
  const store = createReduxStore(initialState, asyncReducers as ReducersMapObject<StateSchema>);
  return <Provider store={store}>{children}</Provider>;
};
