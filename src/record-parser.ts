import { KxxRecord, KxxTransformer, KxxTransformerPushCallback, KxxTransformerWarningCallback } from "./schema";

class RecordParserState {
  org: string;
  month: number;
  year: number;
  type: number;
  input: number;
}

type RegExpWithGroups = RegExpExecArray & { groups?: { [key: string]: string } };

export class RecordParser implements KxxTransformer<string[], KxxRecord> {

  r_org = /^5\/@(?<id>\d{8})00/;
  r_period = /^6\/@(?<id>\d{8})(?<month>\d{2})(?<type>\d{2}) (?<input>\d) (?<year>\d{4})/;
  r_record = /^G\/@(?<day>\d{2})(?<docid>[ 0-9]{9})000(?<su>\d{3})(?<au>\d{4})(?<kap>\d{2})\d\d(?<odpa>\d{4})(?<pol>\d{4})(?<zj>\d{3})(?<uz>\d{9})(?<orj>\d{10})(?<org>\d{13})(?<md>\d{16})(?<md_decimal>\d{2})(?<md_sign>[\-C ])(?<d>\d{16})(?<d_decimal>\d{2})(?<d_sign>[\-C ])/;
  r_comment = /^G\/\$(?<comment_id>\d{4})(?<docid>[ 0-9]{9})(?<comment>.*)$/;
  r_meta_line = /^G\/#(?<comment_id>\d{4})(?<docid>[ 0-9]{9})(?<text>.*)$/;
  r_meta_item = /\*(?<key>[A-Z]+)\-(?<value>[^;]*)(;|$)/g;
  r_meta_item_sub = /(?<key>[A-Z]+)\-(?<value>.*)/;

  state: RecordParserState = new RecordParserState();

  push: KxxTransformerPushCallback<KxxRecord>;

  warning: KxxTransformerWarningCallback;

  async start(push: KxxTransformerPushCallback<KxxRecord>, warning: KxxTransformerWarningCallback) {
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

    const record = new KxxRecord();
    record.type = this.state.type;
    record.input = this.state.input;
    record.organization = this.state.org;

    var matches: RegExpWithGroups;

    for (let line of lines) {
      switch (line.charAt(2)) {

        case "@":
          matches = this.r_record.exec(line);
          const r: any = matches ? matches.groups : {};
          record.id = Number(r.docid);
          record.date = new Date(this.state.year, this.state.month - 1, r.day);
          record.balances.push({
            su: Number(r.su),
            au: Number(r.au),
            kap: Number(r.kap),
            odpa: Number(r.odpa),
            pol: Number(r.pol),
            zj: Number(r.zj),
            uz: Number(r.uz),
            orj: Number(r.orj),
            org: Number(r.org),
            md: Number(r.md_sign + r.md + "." + r.md_decimal),
            d: Number(r.d_sign + r.d + "." + r.d_decimal),
            comments: []
          });
          break;

        case "$":
          matches = this.r_comment.exec(line);
          const c: any = matches ? matches.groups : {};
          record.balances[record.balances.length - 1].comments.push(c.comment);
          break;

        case "#":
          matches = this.r_meta_line.exec(line);
          const text: string = matches ? matches.groups.text : null;

          if (text) {

            if (!text.match(this.r_meta_item)) record.comments.push(text);

            else {
              let match: RegExpWithGroups;
              while (match = this.r_meta_item.exec(text)) {
                let m = match ? match.groups : {};
                if (m.key === "EVK") {
                  if (!record.meta[m.key]) record.meta[m.key] = {};
                  let m2: RegExpWithGroups = this.r_meta_item_sub.exec(m.value)
                  if (m2) record.meta["EVK"][m2.groups.key] = m2.groups.value;
                }
                else record.meta[m.key] = m.value;
              }
            }

          }
          break;

        default:
          this.warning("Unknown record type: " + line);
      }
    }

    this.push(record);
  }

}