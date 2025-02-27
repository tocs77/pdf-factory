export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type OptionalRecord<K extends keyof any, T> = {
  [P in K]?: T;
};
