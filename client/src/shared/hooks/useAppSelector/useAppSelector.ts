import { StateSchema } from '@/App/providers/StoreProvider';
import { TypedUseSelectorHook, useSelector } from 'react-redux';

export const useAppSelector: TypedUseSelectorHook<StateSchema> = useSelector;
