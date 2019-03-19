export type KxxTransformerPush<T> = (chunk: T) => void;

export type KxxTransformerWarning = (warning: string) => void;

export interface KxxTransformer<I,O> {
  start: (push: KxxTransformerPush<O>, warning: KxxTransformerWarning) => Promise<void>;
  transform: (chunk: I) => Promise<void>;
  flush: () => Promise<void>;  
}