const sinon = require('sinon');
const should = require('should');
const { default: program } = require('../dist/index.js');

sinon.stub(process, 'exit');
sinon.stub(process.stdout, 'write');

program
  .version('0.0.1')
  .command('version', 'description')
  .action(function() {
    console.log('Version command invoked');
  });

program.parse(['node', 'test', 'version']);

var output = process.stdout.write.args[0];
output[0].should.equal('Version command invoked\n');

program.parse(['node', 'test', '--version']);

var output = process.stdout.write.args[1];
output[0].should.equal('0.0.1\n');

sinon.restore();
