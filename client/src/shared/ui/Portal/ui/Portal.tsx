import { PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  element?: HTMLElement;
}
export const Portal = (props: PropsWithChildren<PortalProps>) => {
  const { children } = props;
  let element = props.element;
  if (!element) {
    element = document.getElementById('root') as HTMLElement;
    if (!element) {
      element = document.body;
    }
  }
  return createPortal(children, element);
};
