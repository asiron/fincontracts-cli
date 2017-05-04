#!/usr/bin/env node --harmony
import * as finlib from 'fincontracts-lib';
import {BigNumber} from 'bignumber.js';
import {Gateway} from '../contracts/bin/gateway';
import {GatewayBool} from '../contracts/bin/gatewaybool';
import {GatewayInteger} from '../contracts/bin/gatewayint';
import {FincontractMarketplace} from '../contracts/bin/marketplace';
import FincontractStorage from './storage';

const commandExists = require('command-exists');
const logSymbols = require('log-symbols');
const figures = require('figures');
const cli = require('vorpal')();
const chalk = require('chalk');
const Web3 = require('web3');

const web3 = new Web3();
let marketplace = null;
let gateway = null;
let gatewayint = null;
let gatewaybool = null;

const error = msg => chalk.bold.red(`${figures.cross} ${msg}`);
const warn = msg => chalk.yellow(`${logSymbols.warning} ${msg}`);
const info = msg => chalk.blue(`${logSymbols.info} ${msg}`);
const ok = msg => chalk.green(`${figures.tick} ${msg}`);

/* Setting up local-storage hook */
cli.localStorage('fincontract-client');
const storage = new FincontractStorage(cli.localStorage);

function parseBigNum(str) {
  try {
    return new BigNumber(str);
  } catch (err) {
    cli.log(error('Error: Not a number!'));
  }
}
const zfill = (num, len) => (Array(len).join('0') + num).slice(-len);
function parseAddress(str) {
  const id = parseBigNum(str) || '0';
  return '0x' + zfill(id.toString(16), 64);
}

const isNodeConnected = () => web3.isConnected() || error('Node is not connected');
function connectToEthereumNode(url) {
  const provider = new web3.providers.HttpProvider(url);
  web3.setProvider(provider);
  if (isNodeConnected() === true) {
    marketplace = FincontractMarketplace(web3);
    gateway = Gateway(web3);
    gatewayint = GatewayInteger(web3);
    gatewaybool = GatewayBool(web3);
    web3.eth.defaultAccount = web3.eth.coinbase;
    return true;
  }
  return false;
}

async function checkAndRegisterAccount() {
  if (!marketplace.isRegistered.call()) {
    return new finlib.Sender(marketplace, web3)
      .send('register', [])
      .watch({event: 'Registered'}, logs => logs.args.user);
  }
}

function generateDOTGraph(fctID, options) {
  return commandExists('dot')
    .then(async () => {
      const dg = new finlib.DotGenerator();
      const f = new finlib.Fetcher(marketplace);
      const fincontract = await f.pullFincontract(fctID);
      const dotString = dg.generate(fincontract);
      const fs = require('fs');
      const basename = (options.graph === true) ? `/tmp/fincontract` : options.graph;
      const dotFilename = `${basename}.dot`;
      const pdfFilename = `${basename}.pdf`;
      fs.writeFile(dotFilename, dotString, err => {
        if (err) {
          return cli.log(error(err));
        }
        cli.log(info(`Written DOT file to: ${dotFilename}`));
      });
      if (options['only-dot']) {
        cli.log(info('--only-dot option was selected, skipping PDF generation...'));
        return;
      }
      const exec = require('child_process').exec;
      const command = `dot -Tpdf ${dotFilename} -o ${pdfFilename}`;
      exec(command, (err, stdout, stderr) => {
        if (stdout) {
          cli.log(info(`stdout: ${stdout}`));
        }
        if (stderr) {
          cli.log(warn(`stderr: ${stderr}`));
        }
        if (err) {
          cli.log(error(err));
        }
      });
    })
    .catch(err => cli.log(error(err)));
}

function printFincontract(name, fincontract, detailed) {
  cli.log(info(`Fincontract:\t ${name}`));
  cli.log(info(`ID:\t ${fincontract.id}`));
  if (detailed) {
    cli.log(info(`Owner:\t\t ${fincontract.owner}`));
    cli.log(info(`Issuer:\t\t ${fincontract.issuer}`));
    cli.log(info(`Proposed Owner:\t ${fincontract.proposedOwner}`));
    cli.log(info(`Description:\t\t ${fincontract.description}`));
  }
  cli.log('');
}

function saveFincontract(fincontract, name, overwrite) {
  const srz = new finlib.Serializer();
  const serialized = srz.serialize(fincontract);
  if (storage.addFincontract(name, serialized, overwrite)) {
    cli.log(info(`Fincontract saved as '${name}'`));
  } else {
    cli.log(warn('Fincontract with this name already exists!'));
  }
}

function processExecutionResults(result) {
  if (result.type === 'executed') {
    cli.log(ok(`Fincontract was executed completely: ${result.deleted}`));
  } else if (result.type === 'deferred') {
    cli.log(warn(`Fincontract was deferred: ${result.deleted}`));
    result.newFincontracts.forEach(fctID => {
      cli.log(ok(`New Fincontract was created: ${fctID}`));
      cli.log(info(`ID added to autocomplete!`));
      storage.addFincontractID(fctID);
    });
  }
}

function autocompleteAccounts() {
  if (!web3.isConnected()) {
    return [];
  }
  const accounts = web3.eth.accounts;
  const indicies = [...Array(accounts.length).keys()].map(x => x.toString());
  return [...indicies, ...accounts];
}

cli.log(chalk.magenta(`${figures.star} Welcome to Fincontracts CLI ${figures.star}`));

cli
  .command('connect <host>').alias('c')
  .autocomplete(['localhost:8545'])
  .description('Connects to a local Ethereum node')
  .action((args, cb) => {
    const url = `http://${args.host}`;
    if (connectToEthereumNode(url)) {
      cli.log(ok(`Connected to node: ${url}`));
    } else {
      cli.log(error(`Did NOT connect, is node running at ${url} ?`));
    }
    cb();
  });

cli
  .command('register').alias('r')
  .validate(isNodeConnected)
  .description('Registers the currently selected account')
  .action(async (args, cb) => {
    const user = await checkAndRegisterAccount();
    if (user) {
      cli.log(info(`Registered account: ${user}`));
    } else {
      cli.log(warn(`You are already registered!`));
    }
    cb();
  });

cli
  .command('show-balance').alias('sb')
  .validate(isNodeConnected)
  .description('Shows balance of the currently selected account')
  .action((args, cb) => {
    const balance = finlib.Currency.convertToJSON(marketplace.getMyBalance.call());
    cli.log(ok(`Balance of ${web3.eth.defaultAccount}`));
    Object.keys(balance).forEach(k => {
      cli.log(info(`${k}:\t${balance[k].toFixed(2)}`));
    });
    cb();
  });

cli
  .command('select-account <index-or-address>').alias('sa')
  .autocomplete({data: () => autocompleteAccounts()})
  .types({string: ['_']})
  .description('Selects an Ethereum account for sending transactions')
  .validate(isNodeConnected)
  .action((args, cb) => {
    const identifier = args['index-or-address'];
    const accounts = web3.eth.accounts;
    if (accounts.includes(identifier)) {
      web3.eth.defaultAccount = identifier;
      cli.log(ok(`Account selected: ${identifier}`));
    } else if (accounts[identifier]) {
      web3.eth.defaultAccount = accounts[identifier];
      cli.log(ok(`Account selected: ${accounts[identifier]}`));
    } else {
      cli.log(error(`Wrong account address or index: ${identifier}`));
    }
    cb();
  });

cli
  .command('list-accounts').alias('la')
  .description('Lists unlocked Ethereum accounts')
  .validate(isNodeConnected)
  .action((args, cb) => {
    cli.log(info('Unlocked Ethereum accounts:'));
    web3.eth.accounts.forEach((account, index) => {
      cli.log(info(`${index}: ${account}`));
    });
    cb();
  });

cli
  .command('create-fincontract <expr>').alias('cf')
  .option('-i, --issue <address>', 'Issues the Fincontract after deploying to a given <address>')
  .option('-s, --save  <name>', 'Saves the Fincontract after deploying with a given <name>')
  .option('-ow, --overwrite', 'Overwrites the Fincontract if it already exists with the same name!')
  .types({string: ['i', 'issue']})
  .description('Creates a Fincontract and deploys it to the blockchain')
  .validate(isNodeConnected)
  .action(async (args, cb) => {
    const expression = args.expr;
    const p = new finlib.Parser();
    const d = new finlib.Deployer(marketplace, web3);
    try {
      let createdFincontractID;
      const desc = await p.parse(expression);
      if (args.options.issue) {
        const proposedOwner = parseAddress(args.options.issue);
        createdFincontractID = await d.issue(desc, proposedOwner);
      } else {
        createdFincontractID = await d.deploy(desc);
      }
      if (storage.addFincontractID(createdFincontractID)) {
        cli.log(info('ID added to autocomplete!'));
      }
      if (args.options.save) {
        const name = args.options.save;
        const ow = args.options.overwrite;
        const f = new finlib.Fetcher(marketplace);
        const fincontract = await f.pullFincontract(createdFincontractID);
        saveFincontract(fincontract, name, ow);
      }
    } catch (err) {
      cli.log(error(err));
    }
    cb();
  });

cli
  .command('join-fincontract <id>').alias('jf')
  .autocomplete({data: () => storage.getFincontractIDs()})
  .option('-o, --or <choice>', 'Selects sub-Fincontract given its <id> and a <choice>', ['first', 'second'])
  .types({string: ['_']})
  .validate(isNodeConnected)
  .description('Joins a Fincontract given its <id> from the currently selected account')
  .action(async (args, cb) => {
    const exec = new finlib.Executor(marketplace, gateway, web3);
    const id = parseAddress(args.id);
    try {
      let executed;
      const choice = args.options.or;
      if (['first', 'second'].includes(choice)) {
        const mapping = {first: 1, second: 0};
        executed = await exec.choose(id, mapping[choice]);
      } else {
        executed = await exec.join(id);
      }
      processExecutionResults(executed);
    } catch (err) {
      cli.log(error(err));
    }
    cb();
  });

cli
  .command('pull-fincontract <id>').alias('pf')
  .autocomplete({data: () => storage.getFincontractIDs()})
  .option('-s, --save <name>', `Save the Fincontract's description as <name>`)
  .option('-e, --eval <method>', 'Evaluate the Fincontract using a <method>', ['direct', 'estimate'])
  .option('--convert <base>', 'Converts the result of evaluation to a base currency', Object.values(finlib.Currency.Currencies))
  .option('--overwrite', 'Overwrites the Fincontract if it already exists with the same name!')
  .types({string: ['_']})
  .description('Pulls a Fincontract from the blockchain.')
  .validate(isNodeConnected)
  .action(async (args, cb) => {
    try {
      const id = parseAddress(args.id);
      const f = new finlib.Fetcher(marketplace);

      const fincontract = await f.pullFincontract(id);
      if (storage.addFincontractID(id)) {
        cli.log(info('ID added to autocomplete!'));
      }
      if (args.options.save) {
        const name = args.options.save;
        const ow = args.options.overwrite;
        saveFincontract(fincontract, name, ow);
      }
      if (args.options.eval) {
        const e = new finlib.Evaluator(gateway, web3);
        const base = args.options.convert || 'USD';
        const method = args.options.eval;
        const evaluated = await e.evaluate(fincontract.rootDescription, {method});
        const currencies = finlib.Currency.convertToJSON(evaluated);
        const exchanged = await finlib.Currency.changeAllCurrencies(base, currencies);
        cli.log(ok(`Evaluation results:`));
        Object.keys(currencies).forEach(k => {
          const [a, b] = currencies[k];
          cli.log(info(`${k}:\t[${a.toFixed(2)}, ${b.toFixed(2)}]`));
        });
        const [a, b] = exchanged[base];
        cli.log(ok(`Exchanged to ${base}: [${a.toFixed(2)}, ${b.toFixed(2)}]`));
      }
    } catch (err) {
      cli.log(error(err));
    }
    cb();
  });

cli
  .command('show-fincontract <name>').alias('sf')
  .option('-g, --graph [path]', 'Generate a graph using DOT engine')
  .option('--only-dot', 'If --graph option was selected, it will only save DOT file')
  .autocomplete({data: () => Object.keys(storage.getFincontracts())})
  .validate(isNodeConnected)
  .description('Shows detailed information about a saved Fincontract as text or graph')
  .action((args, cb) => {
    const name = args.name;
    const fincontract = storage.getFincontractByName(name);
    if (fincontract) {
      printFincontract(name, fincontract, true);
      if (args.options.graph) {
        generateDOTGraph(fincontract.id, args.options);
      }
    } else {
      cli.log(error('Contract not found!'));
    }
    cb();
  });

cli
  .command('list-fincontracts').alias('lf')
  .option('-d, --detail', 'Lists detailed description for every saved Fincontract')
  .description('Lists all saved Fincontracts')
  .action((args, cb) => {
    const fincontracts = storage.getFincontracts();
    Object.keys(fincontracts).forEach(name => {
      printFincontract(name, fincontracts[name], args.options.detail);
    });
    cb();
  });

cli
  .command('delete-settings').alias('ds')
  .description('Wipes out all user settings (autocomplete, saved fincontracts)')
  .action(function (args, cb) {
    this.prompt({
      type: 'confirm',
      name: 'continue',
      message: 'Are you sure you want to remove all user settings?'
    }, result => {
      if (result.continue) {
        cli.log(error('All settings were deleted!'));
        storage.wipe();
      } else {
        cli.log(ok('Good move.'));
      }
      cb();
    });
  });

cli
  .command('example <index>').alias('ex')
  .autocomplete(finlib.Examples.AllExamples)
  .validate(isNodeConnected)
  .description('Deploys one of the examples from marketplace smart contract')
  .action(async (args, cb) => {
    try {
      const ex = new finlib.Examples(marketplace, gatewaybool, gatewayint, web3);
      const fctID = await ex.runExample(args.index);
      if (storage.addFincontractID(fctID)) {
        cli.log(info('ID added to autocomplete!'));
      }
    } catch (err) {
      cli.log(error(err));
    }
    cb();
  });

cli.delimiter(chalk.magenta(figures.pointer)).show();
