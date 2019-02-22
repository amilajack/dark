/**
 * Module dependencies.
 */

const should = require('should');
const { default: program } = require('../dist/index.js');

program
  .version('0.0.1')
  .option('-a, --alpha <a>', 'hyphen')
  .option('-b, --bravo <b>', 'hyphen')
  .option('-c, --charlie <c>', 'hyphen');

program.parse('node test -a - --bravo - --charlie=- - -- - -t1'.split(' '));
program.alpha.should.equal('-');
program.bravo.should.equal('-');
program.charlie.should.equal('-');
program.args[0].should.equal('-');
program.args[1].should.equal('-');
program.args[2].should.equal('-t1');
