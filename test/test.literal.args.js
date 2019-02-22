/**
 * Module dependencies.
 */

const should = require('should');
const { default: program } = require('../dist/index.js');

program
  .version('0.0.1')
  .option('-f, --foo', 'add some foo')
  .option('-b, --bar', 'add some bar');

program.parse(['node', 'test', '--foo', '--', '--bar', 'baz']);
program.foo.should.be.true();
should.equal(undefined, program.bar);
program.args.should.eql(['--bar', 'baz']);

// subsequent literals are passed-through as args
program.parse(['node', 'test', '--', 'cmd', '--', '--arg']);
program.args.should.eql(['cmd', '--', '--arg']);
