import { AppDispatch } from '@/App/providers/StoreProvider';
import { useDispatch } from 'react-redux';

export const useAppDispatch: () => AppDispatch = useDispatch;
