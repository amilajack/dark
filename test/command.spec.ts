import path from 'path';
import { spawn, exec } from 'child_process';
import sinonCreator from 'sinon';
import program from '../src';

describe('command', () => {
  let sinon = sinonCreator.createSandbox();

  beforeEach(() => {
    sinon = sinonCreator.createSandbox();
  });

  test('empty action', () => {
    let val = 'some cheese';
    program
      .name('test')
      .command('mycommand')
      .option('-c, --cheese [type]', 'optionally specify the type of cheese')
      .action(({ cheese }) => {
        val = cheese;
      });

    program.parse(['node', 'test', 'mycommand', '--cheese', '']);

    expect(val).toEqual('');
  });

  test('command action', () => {
    let val = false;
    program
      .command('info [options]')
      .option('-C, --no-color', 'turn off color output')
      .action(function() {
        val = this.color;
      });

    program.parse(['node', 'test', 'info']);

    expect(program.commands[0].color).toEqual(val);
  });

  test('command alias help', () => {
    program
      .command('info [thing]')
      .alias('i')
      .action(() => {});

    program
      .command('save [file]')
      .alias('s')
      .action(() => {});

    program.parse(['node', 'test']);

    expect(program.commandHelp()).toContain('info|i');
    expect(program.commandHelp()).toContain('save|s');
    expect(program.commandHelp()).not.toContain('test|');
  });

  test('command allowUnknownOption', () => {
    const stubError = sinon.stub(console, 'error');
    const stubExit = sinon.stub(process, 'exit');

    program.version('0.0.1').option('-p, --pepper', 'add pepper');
    program.parse('node test -m'.split(' '));

    expect(stubError.callCount).toEqual(1);

    function resetStubStatus() {
      stubError.reset();
      stubExit.reset();
    }

    // test subcommand
    resetStubStatus();
    program.command('sub').action(() => {});
    program.parse('node test sub -m'.split(' '));

    expect(stubError.callCount).toEqual(2);
    expect(stubExit.calledOnce).toBe(true);

    // command with `allowUnknownOption`
    resetStubStatus();
    program.version('0.0.1').option('-p, --pepper', 'add pepper');
    program.allowUnknownOption().parse('node test -m'.split(' '));

    expect(stubError.callCount).toEqual(0);
    expect(stubExit.calledOnce).toBe(false);

    // subcommand with `allowUnknownOption`
    resetStubStatus();
    program
      .command('sub2')
      .allowUnknownOption()
      .action(() => {});
    program.parse('node test sub2 -m'.split(' '));

    expect(stubError.callCount).toEqual(1);
    expect(stubExit.calledOnce).toBe(false);
  });

  test('autocompletion single', () => {
    expect(program.hasCompletionRules()).toBe(false);

    program
      .arguments('<filename>')
      .option('--verbose', 'verbose')
      .option('-o, --output <file>', 'output')
      .option('--debug-level <level>', 'debug level')
      .option('-m <mode>', 'mode')
      .complete({
        options: {
          '--output': function() {
            return ['file1', 'file2'];
          },
          '--debug-level': ['info', 'error'],
          '-m': function(typedArgs) {
            return typedArgs;
          }
        },
        arguments: {
          filename: ['file1.c', 'file2.c']
        }
      });

    expect(program.hasCompletionRules()).toBe(true);

    expect(program.autocompleteNormalizeRules()).toEqual({
      options: {
        '--verbose': {
          arity: 0,
          sibling: null,
          reply: []
        },
        '-o': {
          arity: 1,
          sibling: '--output',
          reply: program._completionRules.options['--output']
        },
        '--output': {
          arity: 1,
          sibling: '-o',
          reply: program._completionRules.options['--output']
        },
        '--debug-level': {
          arity: 1,
          sibling: null,
          reply: ['info', 'error']
        },
        '-m': {
          arity: 1,
          sibling: null,
          reply: program._completionRules.options['-m']
        }
      },
      args: [['file1.c', 'file2.c']]
    });

    expect(program.autocompleteCandidates([])).toEqual([
      '--verbose',
      '-o',
      '--output',
      '--debug-level',
      '-m',
      'file1.c',
      'file2.c'
    ]);

    expect(program.autocompleteCandidates(['--verbose'])).toEqual([
      '-o',
      '--output',
      '--debug-level',
      '-m',
      'file1.c',
      'file2.c'
    ]);

    expect(program.autocompleteCandidates(['-o'])).toEqual(['file1', 'file2']);

    expect(program.autocompleteCandidates(['--output'])).toEqual([
      'file1',
      'file2'
    ]);

    expect(program.autocompleteCandidates(['--debug-level'])).toEqual([
      'info',
      'error'
    ]);

    expect(program.autocompleteCandidates(['-m'])).toEqual(['-m']);

    expect(program.autocompleteCandidates(['--verbose', '-m'])).toEqual([
      '--verbose',
      '-m'
    ]);

    expect(
      program.autocompleteCandidates([
        '--verbose',
        '-o',
        'file1',
        '--debug-level',
        'info',
        '-m',
        'production'
      ])
    ).toEqual(['file1.c', 'file2.c']);

    // nothing to complete
    expect(
      program.autocompleteCandidates([
        '--verbose',
        '-o',
        'file1',
        '--debug-level',
        'info',
        '-m',
        'production',
        'file1.c'
      ])
    ).toEqual([]);

    // place arguments in different position
    expect(
      program.autocompleteCandidates([
        'file1.c',
        '-o',
        'file1',
        '--debug-level',
        'info',
        '-m',
        'production'
      ])
    ).toEqual(['--verbose']);

    // should handle the case
    // when provide more args than expected
    expect(
      program.autocompleteCandidates([
        'file1.c',
        'file2.c',
        '--verbose',
        '-o',
        'file1',
        '--debug-level',
        'info',
        '-m',
        'production'
      ])
    ).toEqual([]);
  });

  test('autocompletion subcommand', () => {
    program
      .command('clone <url>')
      .option('--debug-level <level>', 'debug level')
      .complete({
        options: {
          '--debug-level': ['info', 'error']
        },
        arguments: {
          url: ['https://github.com/1', 'https://github.com/2']
        }
      });

    program
      .command('add <file1> <file2>')
      .option('-A', 'add all files')
      .option('--debug-level <level>', 'debug level')
      .complete({
        options: {
          '--debug-level': ['info', 'error']
        },
        arguments: {
          file1: ['file1.c', 'file11.c'],
          file2: ['file2.c', 'file21.c']
        }
      });

    expect(program.hasCompletionRules()).toBe(true);

    const rootReply = sinon.spy();

    program.autocompleteHandleEvent({
      reply: rootReply,
      fragment: 1,
      line: 'git'
    });

    expect(rootReply.calledOnce).toBe(true);
    expect(rootReply.getCall(0).args[0]).toEqual(['clone', 'add', '--help']);

    const cloneReply = sinon.spy();

    program.autocompleteHandleEvent({
      reply: cloneReply,
      fragment: 2,
      line: 'git clone'
    });

    expect(cloneReply.calledOnce).toBe(true);
    cloneReply.getCall(0);
    expect(program.args[0]).toEqual([
      '--debug-level',
      'https://github.com/1',
      'https://github.com/2'
    ]);

    const cloneWithOptionReply = sinon.spy();

    program.autocompleteHandleEvent({
      reply: cloneWithOptionReply,
      fragment: 3,
      line: 'git clone --debug-level'
    });

    expect(cloneWithOptionReply.calledOnce).toBe(true);
    expect(cloneWithOptionReply.getCall(0).args[0]).toEqual(['info', 'error']);

    const addReply = sinon.spy();

    program.autocompleteHandleEvent({
      reply: addReply,
      fragment: 2,
      line: 'git add'
    });

    expect(addReply.calledOnce).toBe(true);
    addReply.getCall(0);
    expect(program.args[0]).toEqual([
      '-A',
      '--debug-level',
      'file1.c',
      'file11.c'
    ]);

    const addWithArgReply = sinon.spy();

    program.autocompleteHandleEvent({
      reply: addWithArgReply,
      fragment: 3,
      line: 'git add file1.c'
    });

    expect(addWithArgReply.calledOnce).toBe(true);
    addWithArgReply.getCall(0);
    expect(program.args[0]).toEqual([
      '-A',
      '--debug-level',
      'file2.c',
      'file21.c'
    ]);
  });

  test('executableSubcommand', () => {
    var bin = path.join(__dirname, './fixtures/pm');
    // not exist
    exec(`${bin} list`, (error, stdout, stderr) => {
      expect(stderr).toEqual('\n  pm-list(1) does not exist, try --help\n\n');
      // TODO error info are not the same in between <=v0.8 and later version
      expect(0).not.toEqual(stderr.length);
    });

    // success case
    exec(`${bin} install`, (error, stdout, stderr) => {
      expect(stdout).toEqual('install\n');
    });

    // subcommand bin file with explicit extension
    exec(`${bin} publish`, (error, stdout, stderr) => {
      expect(stdout).toEqual('publish\n');
    });

    // spawn EACCES
    exec(`${bin} search`, (error, stdout, { length }) => {
      // TODO error info are not the same in between <v0.10 and v0.12
      expect(0).not.toEqual(length);
    });

    // when `bin` is a symbol link for mocking global install
    var bin = path.join(__dirname, './fixtures/pmlink');
    // success case
    exec(`${bin} install`, (error, stdout, stderr) => {
      expect(stdout).toEqual('install\n');
    });
  });

  test('executable subcommand signals hup', () => {
    const bin = path.join(__dirname, './fixtures/pm');
    const proc = spawn(bin, ['listen'], {});

    let output = '';
    proc.stdout.on('data', data => {
      output += data.toString();
    });

    // Set a timeout to give 'proc' time to setup completely
    setTimeout(() => {
      proc.kill('SIGHUP');

      // Set another timeout to give 'prog' time to handle the signal
      setTimeout(() => {
        expect(output).toEqual('SIGHUP\n');
      }, 1000);
    }, 2000);
  });

  test('executable subcommand signals int', () => {
    const bin = path.join(__dirname, './fixtures/pm');
    const proc = spawn(bin, ['listen'], {});

    let output = '';
    proc.stdout.on('data', data => {
      output += data.toString();
    });

    // Set a timeout to give 'proc' time to setup completely
    setTimeout(() => {
      proc.kill('SIGINT');

      // Set another timeout to give 'prog' time to handle the signal
      setTimeout(() => {
        expect(output).toEqual('SIGINT\n');
      }, 1000);
    }, 2000);
  });

  test('term', () => {
    const bin = path.join(__dirname, './fixtures/pm');
    const proc = spawn(bin, ['listen'], {});

    let output = '';
    proc.stdout.on('data', data => {
      output += data.toString();
    });

    // Set a timeout to give 'proc' time to setup completely
    setTimeout(() => {
      proc.kill('SIGTERM');

      // Set another timeout to give 'prog' time to handle the signal
      setTimeout(() => {
        expect(output).toEqual('SIGTERM\n');
      }, 1000);
    }, 2000);
  });

  test('usr1', () => {
    const bin = path.join(__dirname, './fixtures/pm');
    const proc = spawn(bin, ['listen'], {});

    let output = '';
    proc.stdout.on('data', data => {
      output += data.toString();
    });

    // Set a timeout to give 'proc' time to setup completely
    setTimeout(() => {
      proc.kill('SIGUSR1');

      // Set another timeout to give 'prog' time to handle the signal
      setTimeout(() => {
        /*
         * As described at https://nodejs.org/api/process.html#process_signal_events
         * this signal will start a debugger and thus the process might output an
         * additional error message:
         *
         *    "Failed to open socket on port 5858, waiting 1000 ms before retrying".
         *
         * Therefore, we are a bit more lax in matching the output.
         * It must contain the expected output, meaning an empty line containing
         * only "SIGUSR1", but any other output is also allowed.
         */
        expect(output).toMatch(/(^|\n)SIGUSR1\n/);
      }, 1000);
    }, 2000);
  });

  test('usr2', () => {
    const bin = path.join(__dirname, './fixtures/pm');
    const proc = spawn(bin, ['listen'], {});

    let output = '';
    proc.stdout.on('data', data => {
      output += data.toString();
    });

    // Set a timeout to give 'proc' time to setup completely
    setTimeout(() => {
      proc.kill('SIGUSR2');

      // Set another timeout to give 'prog' time to handle the signal
      setTimeout(() => {
        expect(output).toEqual('SIGUSR2\n');
      }, 1000);
    }, 2000);
  });

  test('tsnode', () => {
    const bin = path.join(__dirname, './fixtures-ts/pm.ts');

    // success case
    exec(
      `${process.argv[0]} -r ts-node/register ${bin} install`,
      (error, stdout, stderr) => {
        expect(stdout).toEqual('install\n');
      }
    );
  });

  test('executableSubcommandAlias help', () => {
    // success case
    exec(`${bin} help`, (error, stdout, stderr) => {
      expect(stdout).toContain('install|i');
      expect(stdout).toContain('search|s');
      expect(stdout).toContain('cache|c');
      expect(stdout).toContain('list');
      expect(stdout).toContain('publish|p');
      expect(stdout).not.toContain('pm|');
    });
  });

  test('executableSubcommandAlias alias', () => {
    var bin = path.join(__dirname, './fixtures/pm');

    // success case
    exec(`${bin} i`, (error, stdout, stderr) => {
      expect(stdout).toEqual('install\n');
    });

    // subcommand bin file with explicit extension
    exec(`${bin} p`, (error, stdout, stderr) => {
      expect(stdout).toEqual('publish\n');
    });

    // spawn EACCES
    exec(`${bin} s`, (error, stdout, { length }) => {
      // error info are not the same in between <v0.10 and v0.12
      expect(0).not.toEqual(length);
    });

    // when `bin` is a symbol link for mocking global install
    var bin = path.join(__dirname, './fixtures/pmlink');
    // success case
    exec(`${bin} i`, (error, stdout, stderr) => {
      expect(stdout).toEqual('install\n');
    });
  });

  test('executableSubcommandDefault', () => {
    var bin = path.join(__dirname, './fixtures/pm');
    // success case
    exec(`${bin} default`, (error, stdout, stderr) => {
      expect(stdout).toEqual('default\n');
    });

    // success case (default)
    exec(bin, (error, stdout, stderr) => {
      expect(stdout).toEqual('default\n');
    });

    // not exist
    exec(`${bin} list`, (error, stdout, stderr) => {
      expect(stderr).toEqual('\n  pm-list(1) does not exist, try --help\n\n');
      // TODO error info are not the same in between <=v0.8 and later version
      expect(0).not.toEqual(stderr.length);
    });

    // success case
    exec(`${bin} install`, (error, stdout, stderr) => {
      expect(stdout).toEqual('install\n');
    });

    // subcommand bin file with explicit extension
    exec(`${bin} publish`, (error, stdout, stderr) => {
      expect(stdout).toEqual('publish\n');
    });

    // spawn EACCES
    exec(`${bin} search`, (error, stdout, { length }) => {
      // TODO error info are not the same in between <v0.10 and v0.12
      expect(0).not.toEqual(length);
    });

    // when `bin` is a symbol link for mocking global install
    var bin = path.join(__dirname, './fixtures/pmlink');
    // success case
    exec(`${bin} install`, (error, stdout, stderr) => {
      expect(stdout).toEqual('install\n');
    });
  });

  test('executableSubcommandSubcommand', () => {
    const bin = path.join(__dirname, './fixtures/pm');
    // should list commands at top-level sub command
    exec(`${bin} cache help`, (error, stdout) => {
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('cache');
      expect(stdout).toContain('validate');
    });

    // should run sub-subcommand
    exec(`${bin} cache clear`, (error, stdout, stderr) => {
      expect(stdout).toEqual('cache-clear\n');
      expect(stderr).toEqual('');
    });

    // should print the default command when passed invalid sub-subcommand
    exec(`${bin} cache nope`, (error, stdout, stderr) => {
      expect(stdout).toEqual('cache-validate\n');
      expect(stderr).toEqual('');
    });
  });

  test('executableSubcommandUnknown', () => {
    const bin = path.join(__dirname, './fixtures/cmd');

    exec(`${bin} foo`, (error, stdout, stderr) => {
      expect(stdout).toEqual('foo\n');
    });

    const unknownSubcmd = 'foo_invalid';
    exec(`${bin} ${unknownSubcmd}`, (error, stdout, stderr) => {
      expect(stderr).toEqual(`error: unknown command ${unknownSubcmd}\n`);
    });
  });

  test('failOnSameAlias', () => {
    const bin = path.join(__dirname, './fixtures/cmd');

    exec(`${bin} foo`, (error, stdout, stderr) => {
      expect(stdout).toEqual('foo\n');
    });

    const unknownSubcmd = 'foo_invalid';
    exec(`${bin} ${unknownSubcmd}`, (error, stdout, stderr) => {
      expect(stderr).toEqual(`error: unknown command ${unknownSubcmd}\n`);
    });
  });

  test('help', () => {
    program.command('bare');

    expect(program.commandHelp()).toEqual('Commands:\n  bare\n');

    program.command('mycommand [options]');

    expect(program.commandHelp()).toEqual(
      'Commands:\n  bare\n  mycommand [options]\n'
    );
  });

  test('helpInformation', () => {
    program.command('somecommand');
    program.command('anothercommand [options]');

    const expectedHelpInformation = [
      'Usage:  [options] [command]',
      '',
      'Options:',
      '  -h, --help                output usage information',
      '',
      'Commands:',
      '  somecommand',
      '  anothercommand [options]',
      ''
    ].join('\n');

    expect(program.helpInformation()).toEqual(expectedHelpInformation);
  });

  test('name', () => {
    sinon.stub(process, 'exit');
    sinon.stub(process.stdout, 'write');

    program.command('mycommand [options]', 'this is my command');

    program.parse(['node', 'test']);

    expect(program.name).toBeInstanceOf(Function);
    expect(program.name()).toEqual('test');
    expect(program.commands[0].name()).toEqual('mycommand');
    expect(program.commands[1].name()).toEqual('help');

    const output = process.stdout.write.args[0];

    expect(output[0]).toContain(
      ['  mycommand [options]  this is my command'].join('\n')
    );

    sinon.restore();
  });

  test('name set', () => {
    sinon.stub(process, 'exit');
    sinon.stub(process.stdout, 'write');

    program.name('foobar').description('This is a test.');

    expect(program.name).toBeInstanceOf(Function);
    expect(program.name()).toEqual('foobar');
    expect(program.description()).toEqual('This is a test.');

    const output = process.stdout.write.args[0];

    sinon.restore();
  });

  test('no conflict', () => {
    sinon.stub(process, 'exit');
    sinon.stub(process.stdout, 'write');

    program
      .version('0.0.1')
      .command('version', 'description')
      .action(() => {
        console.log('Version command invoked');
      });

    program.parse(['node', 'test', 'version']);

    var output = process.stdout.write.args[0];
    expect(output[0]).toEqual('Version command invoked\n');

    program.parse(['node', 'test', '--version']);

    var output = process.stdout.write.args[1];
    expect(output[0]).toEqual('0.0.1\n');

    sinon.restore();
  });

  test('no help', () => {
    sinon.stub(process, 'exit');
    sinon.stub(process.stdout, 'write');

    program.command('mycommand [options]', 'this is my command');

    program.command('anothercommand [options]').action(() => {});

    program.command('hiddencommand [options]', "you won't see me", {
      noHelp: true
    });

    program
      .command('hideagain [options]', null, { noHelp: true })
      .action(() => {});

    program.command('hiddencommandwithoutdescription [options]', {
      noHelp: true
    });

    program.parse(['node', 'test']);

    expect(program.name).toBeInstanceOf(Function);
    expect(program.name()).toEqual('test');
    expect(program.commands[0].name()).toEqual('mycommand');
    expect(program.commands[0]._noHelp).toBe(false);
    expect(program.commands[1].name()).toEqual('anothercommand');
    expect(program.commands[1]._noHelp).toBe(false);
    expect(program.commands[2].name()).toEqual('hiddencommand');
    expect(program.commands[2]._noHelp).toBe(true);
    expect(program.commands[3].name()).toEqual('hideagain');
    expect(program.commands[3]._noHelp).toBe(true);
    expect(program.commands[4].name()).toEqual(
      'hiddencommandwithoutdescription'
    );
    expect(program.commands[4]._noHelp).toBe(true);
    expect(program.commands[5].name()).toEqual('help');

    sinon.restore();
    sinon.stub(process.stdout, 'write');
    program.outputHelp();

    expect(process.stdout.write.calledOnce).toBe(true);
    expect(process.stdout.write.args.length).toEqual(1);

    const output = process.stdout.write.args[0];

    const expect = [
      'Commands:',
      '  mycommand [options]       this is my command',
      '  anothercommand [options]',
      '  help [cmd]                display help for [cmd]'
    ].join('\n');
    expect(output[0].indexOf(expect)).not.toEqual(-1);
  });

  test('command asterisk', () => {
    let val = false;
    program
      .version('0.0.1')
      .command('*')
      .description('test')
      .action(() => {
        val = true;
      });

    program.parse(['node', 'test']);

    expect(val).toBe(false);
  });

  test('known', () => {
    sinon.stub(process, 'exit');
    sinon.stub(process.stdout, 'write');

    const stubError = sinon.stub(console, 'error');

    const cmd = 'my_command';

    program.command(cmd, 'description');

    program.parse(['node', 'test', cmd]);

    expect(stubError.callCount).toEqual(0);
    const output = process.stdout.write.args;
    expect(output).toEqual([]);

    sinon.restore();
  });

  test('no command', () => {
    let val = false;
    program
      .option('-C, --no-color', 'turn off color output')
      .action(function() {
        val = this.color;
      });

    program.parse(['node', 'test']);

    expect(program.color).toEqual(val);
  });

  test('literal', () => {
    program
      .version('0.0.1')
      .option('-f, --foo', 'add some foo')
      .option('-b, --bar', 'add some bar');

    program.parse(['node', 'test', '--foo', '--', '--bar', 'baz']);
    expect(program.foo).toBe(true);
    expect(program.bar).toEqual(undefined);
    expect(program.args).toEqual(['--bar', 'baz']);

    // subsequent literals are passed-through as args
    program.parse(['node', 'test', '--', 'cmd', '--', '--arg']);
    expect(program.args).toEqual(['cmd', '--', '--arg']);
  });
});
