
import { RecordParser } from './record-parser';

import { expect } from 'chai';
import 'mocha';
import { KxxRecord } from './schema';

function check(done: any, f: any) {
  try {
    f();
    done();
  } catch (e) {
    done(e);
  }
}

describe('Record parse test', () => {

  it('should correctly parse record', (done) => {
    const recordParser = new RecordParser();
    
    recordParser.start((chunk: KxxRecord) => {
      check(done, () => expect(chunk).to.deep.equal({
        balances:
          [{
            su: 231,
            au: 800,
            kap: 0,
            odpa: 6171,
            pol: 5167,
            zj: 0,
            uz: 0,
            orj: 920,
            org: 0,
            md: 0,
            d: 5970,
            comments: []
          }],
        comments: [],
        meta: {},
        type: 2,
        input: 2,
        organization: "00063517",
        id: 310000073,
        date: new Date("2019-03-06T23:00:00.000Z")
      }));
    }, () => { });

    recordParser.transform(["5/@000000000003000AB01"]);
    recordParser.transform(["6/@000635170302 2 2019"]);
    recordParser.transform([
      "G/@07310000073000231080000006171516700000000000000000009200000000000000000000000000000000 000000000000597000 "
    ]);
  });

});