import { KxxTransformer, KxxTransformerPush } from "./schema/transformer";

export class RecordMerger implements KxxTransformer<string, string[]> {

  lines: string[] = [];

  push: KxxTransformerPush<string[]>;

  async start(push: KxxTransformerPush<string[]>) {
    this.push = push;
  }

  async transform(line: any) {

    switch (line.substr(2, 1)) {
      case "@":
        if (this.lines.length) this.push(this.lines);
        this.lines = [line];
        break;

      default:
        this.lines.push(line);
    }

  }

  async flush() {
    if (this.lines.length) this.push(this.lines);
  }
}