import { createBrowserRouter } from 'react-router';

import { Layout } from '@/features/Layout/ui/Layout';
import { MainPage } from '@/Pages/MainPage';
import { ViewPage } from '@/Pages/ViewPage';
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { path: '/', element: <MainPage /> },
      { path: '/view/:id', element: <ViewPage /> },
    ],
  },
]);
