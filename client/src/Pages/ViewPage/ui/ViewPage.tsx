import { useParams } from 'react-router';
import { useGetFileBlobUrlQuery } from '@/entities/File';
import { PdfViewer } from '@/widgets/Viewer';
export const ViewPage = () => {
  const { id } = useParams();
  const { data: fileBlobUrl, isLoading } = useGetFileBlobUrlQuery(id || '');
  if (isLoading) return <div>Loading...</div>;
  return <PdfViewer url={fileBlobUrl || ''} quality={1} />;
};
