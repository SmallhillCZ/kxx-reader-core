import { KxxTransformer, KxxTransformerPush } from "./schema/transformer";

export class LineSplit implements KxxTransformer<string,string> {

  data: string = "";

  push: KxxTransformerPush<string>;

  constructor() { }

  async start(push: KxxTransformerPush<string>) {
    this.push = push;
  }

  async transform(chunk: string) {
    this.data += chunk;
    const lines = this.data.split(/\r?\n/);
    this.data = lines[lines.length - 1];
    for (let line of lines.slice(0, lines.length - 1)) this.push(line);
  }

  async flush() {
    this.push(this.data);
  }

}