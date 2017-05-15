# fincontract-cli
Copyright (C) 2017 - Maciej Żurad, University of Luxembourg

Client for managing Fincontracts deployed on the Ethereum blockchain.
For more information about Fincontracts see the paper:
[Findel: Secure Derivative Contracts for Ethereum](https://orbilu.uni.lu/handle/10993/30975). For the Smart Contract implementation in Ethereum, see: https://github.com/cryptolu/findel

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You will need the following software:

- jq  [1.5]
- npm [4.1.2]
- nodejs [v7.7.4]
- geth [1.6.0-stable]
- solc [0.4.10]
- ruby [1.9.3]
- graphviz [2.40.1] if you want to generate DOT graphs

#### Installing prerequisites on macOS using homebrew

```shell
$ brew update
$ brew upgrade
$ brew install node jq graphviz
$ brew tap ethereum/ethereum
$ brew install ethereum solidity
```

#### Install prerequisites on Debian/Ubuntu


#### Install `node.js`, `npm`, `jq` and `graphviz`
```shell
$ sudo apt-get update
$ sudo apt-get install nodejs npm jq graphviz
```

#### Install `geth` and `solc`

```shell
$ sudo apt-get install software-properties-common
$ sudo add-apt-repository -y ppa:ethereum/ethereum
$ sudo apt-get update
$ sudo apt-get install ethereum solc
```

### Building

Initialize submodules and pull them by running (from the root of this repository)

```shell
$ git submodule init
$ git submodule update
```

Install all node dependecies and compile source files to ES5 using
```shell
$ npm install
$ npm run build
```

You can also **"make install"** your CLI, such that it's visible from anywhere:
```shell
$ npm install -g
```
Alternatively, you can create a link to it:
```shell
$ npm link
```

### Usage

#### Setup
You have to setup the private blockchain, create accounts and pre-allocate some ether at the beginning in order to deploy your contracts. This command will also automatically compile and deploy contracts to your private blockchain. It might take a while.
```shell
$ ./blockchain setup
```
The blockchain will be running in the background after initialization.

#### Deploy
 If you just want to deploy or re-deploy your Smart Contracts, then run:
```shell
$ ./blockchain deploy
```

Blockchain has to be initialized (using `./blockchain setup`) and cannot be running in the background.

#### Stop, Start, Restart and Attach
You can also stop, start, restart and attach to the current session.
```shell
$ ./blockchain stop
$ ./blockchain start
$ ./blockchain restart
$ ./blockchain attach
```

### `$ fincli`

#### Before running `fincli`
If you have linked or globally installed the package, you can run `fincli` to start the CLI and interact with Fincontracts on the blockchain. Before running `fincli` make sure your private blockchain is running, run `$ ./blockchain restart` to make sure. By default `geth` is logging all activity to `.geth_data/geth.log` so you can view the log in real-time with `$ tail -f .geth_data/geth.log`.

#### Running `fincli`

Run `$ fincli` and then type `help` to view all options.

### Development

Remember to re-deploy contracts if you have changed Solidity contracts from `contracts/` directory and remember to run `$ npm run build` if you changed any of the JavaScript source files form `src`. [Pull requests](https://github.com/asiron/fincontracts-cli/pulls) or [Issues](https://github.com/asiron/fincontracts-cli/issues) are welcome!
