export type KxxTransformerPushCallback<T> = (chunk: T) => void;

export type KxxTransformerWarningCallback = (warning: string) => void;

export interface KxxTransformer<I,O> {
  start: (push: KxxTransformerPushCallback<O>, warning: KxxTransformerWarningCallback) => Promise<void>;
  transform: (chunk: I) => Promise<void>;
  flush: () => Promise<void>;  
}