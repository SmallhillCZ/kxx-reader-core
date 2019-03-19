import { KxxRecord, KxxTransformer, KxxTransformerPush, KxxTransformerWarning } from "./schema";

class RecordParserState {
  org: string;
  month: number;
  year: number;
  type: number;
  input: number;
}

type RegExpWithGroups = RegExpExecArray & { groups?: { [key: string]: string } };

export class RecordParser implements KxxTransformer<string[],KxxRecord> {

  r_org = /^5\/@(?<id>\d{8})00/;
  r_period = /^6\/@(?<id>\d{8})(?<month>\d{2})(?<type>\d{2}) (?<input>\d) (?<year>\d{4})/;
  r_record = /^G\/@(?<day>\d{2})(?<docid>[ 0-9]{9})000(?<su>\d{3})(?<au>\d{4})(?<kap>\d{2})\d\d(?<paragraph>\d{4})(?<item>\d{4})(?<zj>\d{3})(?<uz>\d{9})(?<orj>\d{10})(?<org>\d{13})(?<debit>\d{16})(?<debit_decimal>\d{2})(?<debit_sign>[\-C ])(?<credit>\d{16})(?<credit_decimal>\d{2})(?<credit_sign>[\-C ])/;

  state: RecordParserState = new RecordParserState();

  push: KxxTransformerPush<KxxRecord>;

  warning: KxxTransformerWarning;

  async start(push: KxxTransformerPush<KxxRecord>, warning: KxxTransformerWarning) {
    this.push = push;
    this.warning = warning;
  }

  async transform(lines: string[]) {
    switch (lines[0].charAt(0)) {
      case "5": this.parseOrgRecord(lines); break;
      case "6": this.parsePeriodRecord(lines); break;
      case "G": this.parseAccountingRecord(lines); break;
      default: this.warning("Unknown record type: " + lines[0].charAt(0))
    }
  }

  async flush() { }

  parseOrgRecord(lines: string[]) {

    const matches: RegExpWithGroups = this.r_org.exec(lines[0]);
    if (!matches) this.warning("Unexpected record format: " + lines[0])

    this.state.org = matches.groups.id;
  }

  parsePeriodRecord(lines: string[]) {

    const matches: RegExpWithGroups = this.r_period.exec(lines[0]);
    if (!matches) this.warning("Unexpected record format: " + lines[0])

    this.state.org = matches.groups.id;
    this.state.month = Number(matches.groups.month);
    this.state.year = Number(matches.groups.year);
    this.state.type = Number(matches.groups.type);
    this.state.input = Number(matches.groups.input);
  }

  parseAccountingRecord(lines: string[]) {
    const matches: RegExpWithGroups = this.r_record.exec(lines[0]);
    const r = matches ? matches.groups : {};

    const record: KxxRecord = {
      ...this.state,
      day: Number(r.day),
      paragraph: r.paragraph,
      item: r.item,
      event: r.org,
      credit: Number(r.credit_sign + r.credit + "." + r.credit_decimal),
      debit: Number(r.debit_sign + r.debit + "." + r.debit_decimal),
      data: lines
    };

    this.push(record)
  }

}