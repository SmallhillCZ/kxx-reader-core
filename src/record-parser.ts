import { KxxRecord, KxxTransformer, KxxTransformerPushCallback, KxxTransformerWarningCallback } from "./schema";
import { triggerAsyncId } from "async_hooks";

class RecordParserState {
  org: string;
  month: number;
  year: number;
  type: number;
  input: number;
}

function nameGroups(r: RegExpExecArray, names: string[]): { [key: string]: any } {
  return names.reduce((acc, cur, i) => {
    acc[cur] = r[i + 1];
    return acc;
  }, <{ [key: string]: any }>{})
}

export class RecordParser implements KxxTransformer<string[], KxxRecord> {

  //r_org = /^5\/@(?<id>\d{8})00/;
  //r_period = /^6\/@(?<id>\d{8})(?<month>\d{2})(?<type>\d{2}) (?<input>\d) (?<year>\d{4})/;
  //r_record = /^G\/@(?<day>\d{2})(?<docid>[ 0-9]{9})000(?<su>\d{3})(?<au>\d{4})(?<kap>\d{2})\d\d(?<odpa>\d{4})(?<pol>\d{4})(?<zj>\d{3})(?<uz>\d{9})(?<orj>\d{10})(?<org>\d{13})(?<md>\d{16})(?<md_decimal>\d{2})(?<md_sign>[\-C ])(?<d>\d{16})(?<d_decimal>\d{2})(?<d_sign>[\-C ])/;
  //r_comment = /^G\/\$(?<comment_id>\d{4})(?<docid>[ 0-9]{9})(?<comment>.*)$/;
  //r_meta_line = /^G\/#(?<comment_id>\d{4})(?<docid>[ 0-9]{9})(?<text>.*)$/;
  //r_meta_item = /\*(?<key>[A-Z]+)\-(?<value>[^;]*)(;|$)/g;
  //r_meta_item_sub = /(?<key>[A-Z]+)\-(?<value>.*)/;

  r_org = /^5\/@(\d{8})00/;
  r_org_names: string[] = ["id"];

  r_period = /^6\/@(\d{8})(\d{2})(\d{2}) (\d) (\d{4})/;
  r_period_names: string[] = ["id", "month", "type", "input", "year"];

  r_record = /^G\/@(\d{2})([ 0-9]{9})000(\d{3})([\d ]{4})(\d{2})\d\d(\d{4})(\d{4})(\d{3})(\d{9})(\d{10})(\d{13})(\d{16})(\d{2})([\-C ])(\d{16})(\d{2})([\-C ])/;
  r_record_names: string[] = ["day", "docid", "su", "au", "kap", "odpa", "pol", "zj", "uz", "orj", "org", "md", "md_decimal", "md_sign", "d", "d_decimal", "d_sign"];

  r_comment = /^G\/\$(\d{4})([ 0-9]{9})(.*)$/;
  r_comment_names: string[] = ["comment_id", "docid", "comment"];

  r_meta_line = /^G\/#(\d{4})([ 0-9]{9})(.*)$/;
  r_meta_line_names: string[] = ["comment_id", "docid", "text"];

  r_meta_item = /\*([A-Z]+)\-([^;]*)(;|$)/g;
  r_meta_item_names: string[] = ["key", "value"];

  r_meta_item_sub = /([A-Z]+)\-(.*)/;
  r_meta_item_sub_names: string[] = ["key", "value"];

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

    const matches = this.r_org.exec(lines[0]);
    if (!matches) this.warning("Unexpected record format: " + lines[0])
    const o = nameGroups(matches, this.r_org_names);
    
    this.state.org = o.id;
  }

  parsePeriodRecord(lines: string[]) {

    const matches = this.r_period.exec(lines[0]);
    if (!matches) this.warning("Unexpected record format: " + lines[0])
    const c = nameGroups(matches, this.r_period_names);
    
    this.state.org = c.id;
    this.state.month = Number(c.month);
    this.state.year = Number(c.year);
    this.state.type = Number(c.type);
    this.state.input = Number(c.input);
  }

  parseAccountingRecord(lines: string[]) {

    const record = new KxxRecord();
    record.type = this.state.type;
    record.input = this.state.input;
    record.organization = this.state.org;

    var matches;

    for (let line of lines) {
      switch (line.charAt(2)) {

        case "@":
          matches = this.r_record.exec(line);
          const r: any = matches ? nameGroups(matches, this.r_record_names) : {};
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
          const c: any = matches ? nameGroups(matches, this.r_comment_names) : {};
          record.balances[record.balances.length - 1].comments.push(c.comment);
          break;

        case "#":
          matches = this.r_meta_line.exec(line);
          const t: any = matches ? nameGroups(matches, this.r_meta_line_names) : {};
          const text: string = matches ? t.text : null;

          if (text) {

            if (!text.match(this.r_meta_item)) record.comments.push(text);

            else {
              let match;
              while (match = this.r_meta_item.exec(text)) {
                let m = match ? nameGroups(match, this.r_meta_item_names) : {};
                if (m.key === "EVK") {
                  if (!record.meta[m.key]) record.meta[m.key] = {};
                  let match2 = this.r_meta_item_sub.exec(m.value)
                  let m2 = match2 ? nameGroups(match2, this.r_meta_item_sub_names) : {};
                  if (m2) record.meta["EVK"][m2.key] = m2.value;
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