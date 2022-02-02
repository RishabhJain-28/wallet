const bjl = require("bitcoinjs-lib");
const { HDPublicKey, PublicKey, Address, Networks } = bjl;
// const bip32 = require("bip32");
let BIP32Factory = require("bip32").default;
const axios = require("axios");
const ecc = require("tiny-secp256k1");
const coinselect = require("coinselect");

const bip32 = BIP32Factory(ecc);

class Wallet {
  constructor(network) {
    this.network = network;
    this.token = "5849c99db61a468db0ab443bab0a9a22";
  }

  address_list(xpub, chain, start, end) {
    const pk = bip32.fromBase58(xpub, this.network).derive(chain);
    const addressList = [];
    for (let i = start; i < end; i++) {
      const pubkey = pk.derive(i);

      const address = bjl.payments.p2pkh({
        pubkey: pubkey.publicKey,
        network: this.network,
      }).address;

      console.log("address", address);
      addressList.push(address);
    }
    return addressList;
  }

  //this function will generate bitcoin testnet addresses using "xpub" for "chain" index = 0 or 1 from range index "start" to "end".

  add_wallet(name, addresses) {}

  //this function will add the "addresses" list on blockcypher database. This list is recognised by the "name" argument.

  add_addresses(name, addresses) {}

  //this function will add the "addresses" on blockcypher database to an already existing wallet recognised by the "name" argument.

  async fetch_wallet(name) {}

  //this function will fetch the "addresses" from blockcypher database of an already existing wallet recognised by the "name" argument.

  async fetch_utxo(recieve, change) {}

  //this function will fetch "UTXOs" using wallet name provided in "receive" and "change" argumnets using blockcypher APIs

  async generate_unsigned_transaction(xpub, output_address, amount) {
    this.address_list(
      "tpubDDstPjuTiifdCGdDTHTZWRn96GfDPQtycNB6uotgJ8kdg6ydeuD8yT3xHiBgfxRpJ1ih96DuKQWb6VP7U9UtYRNpvUDfUtsjcnXhdLXT9x9",
      0,
      0,
      1
    );
  }

  //this fucntion will generate unsigned txn using "xpub" to send "amount" to "output_address"
}

let a = new Wallet(bjl.networks.testnet);

a.generate_unsigned_transaction(
  "tpubDCXQSRz1QR71xTm78eE75gXcV4goo6sYG5yRuSVeTfpLbT2P4Aaf4KBgQpHpZ1GhaR6Z4ktazi1hHbzMeJG6htSyiracJYmz1zQReiJmLsN",
  "n3AUMFmYXE9FNgXHWkXZQVkkmxfCF5kbnd",
  500
);
