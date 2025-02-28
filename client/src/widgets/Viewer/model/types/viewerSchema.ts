export type ViewerSchema = {
  scale: number;
};

export type ActionTypes = 'setScale';

interface SetScaleAction {
  type: 'setScale';
  payload: number;
}

export type Action = SetScaleAction;
