import { KxxTransformer, KxxTransformerPushCallback } from "./schema/transformer";

export class RecordMerger implements KxxTransformer<string, string[]> {

  id: string;  
  lines: string[] = [];

  push: KxxTransformerPushCallback<string[]>;

  async start(push: KxxTransformerPushCallback<string[]>) {
    this.push = push;
  }

  async transform(line: any) {
    
    line = String(line);
    
    const type = line.substr(2, 1);
    const id = type === "@" ? line.substr(5, 9) : line.substr(7, 9);

    if (id === this.id) this.lines.push(line);
    else {
      if (this.lines.length) this.push(this.lines);
      this.id = id;
      this.lines = [line];
    }

  }

  async flush() {
    if (this.lines.length) this.push(this.lines);
  }
}