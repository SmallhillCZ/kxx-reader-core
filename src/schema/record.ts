
export interface KxxRecordBalance {
  su: number,
  au: number,
  kap: number,
  odpa: number,
  pol: number,
  zj: number,
  uz: number,
  orj: number,
  org: number,

  d: number;
  md: number;

  comments:string[];
}

export class KxxRecord {
  organization: string;
  type: number;
  input: number;
  id: number;

  date: Date;

  balances: KxxRecordBalance[] = [];

  comments: string[] = [];
  meta: any = {};

}