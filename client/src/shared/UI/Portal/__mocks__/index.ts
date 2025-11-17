import { PropsWithChildren } from 'react';

interface PortalProps {
  element?: HTMLElement;
}
export const Portal = (props: PropsWithChildren<PortalProps>) => {
  const { children } = props;
  return children;
};
