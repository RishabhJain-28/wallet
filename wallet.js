const bjl = require("bitcoinjs-lib");
require("dotenv").config();
const ecc = require("tiny-secp256k1");
const coinSelect = require("coinselect/accumulative");
const fs = require("fs");
const BIP32Factory = require("bip32").default;
const path = require("path");

const bip32 = BIP32Factory(ecc);
const axios = require("axios").create({
  baseURL:
    process.env.NETWORK === "testnet"
      ? "https://api.blockcypher.com/v1/btc/test3/"
      : "",
});

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
      addressList.push(address);
    }
    return addressList;
  }

  //this function will generate bitcoin testnet addresses using "xpub" for "chain" index = 0 or 1 from range index "start" to "end".

  async add_wallet(name, addresses) {
    try {
      const { data } = await axios.post("/wallets", {
        token: process.env.BLOCKCYPHER_TOKEN,
        name,
        addresses,
      });
      return data;
    } catch (err) {
      console.error(err.message);
      if (err.response) console.error(err.response.data);
    }
  }

  //this function will add the "addresses" list on blockcypher database. This list is recognised by the "name" argument.

  async add_addresses(name, addresses) {
    try {
      const { data } = await axios.post(`/wallets/${name}/addresses`, {
        token: process.env.BLOCKCYPHER_TOKEN,
        addresses,
      });
      return data;
    } catch (err) {
      console.error(err.message);
      if (err.response) console.error(err.response.data);
    }
  }

  //this function will add the "addresses" on blockcypher database to an already existing wallet recognised by the "name" argument.

  async fetch_wallet(name) {
    try {
      const { data } = await axios.get(
        `/wallets/${name}?token=${process.env.BLOCKCYPHER_TOKEN}`
      );
    } catch (err) {
      console.error(err.message);
      if (err.response) console.error(err.response.data);
    }
  }

  //this function will fetch the "addresses" from blockcypher database of an already existing wallet recognised by the "name" argument.
  async fetch_utxo(recieve, change) {
    return [
      {
        tx_hash:
          "63002ad757775c58745425634fbacc4bf50653dbe3fc87bcbae5c16c31e95c13",
        block_height: 2139116,
        tx_input_n: -1,
        tx_output_n: 1,
        value: 1372213,
        ref_balance: 1438418,
        spent: false,
        confirmations: 4,
        confirmed: "2022-02-04T09:28:31Z",
        double_spend: false,
        script: "76a914ff8c4284da5caa787bcb371d79270b1c3f2b126a88ac",
      },
      {
        tx_hash:
          "c29ff3cc2f72539fa2fbd37b22018cba4faadfb23776b9d52e2cea38be442284",
        block_height: 2139115,
        tx_input_n: -1,
        tx_output_n: 1,
        value: 66205,
        ref_balance: 66205,
        spent: false,
        confirmations: 5,
        confirmed: "2022-02-04T09:21:52Z",
        double_spend: false,
        script: "76a914ff8c4284da5caa787bcb371d79270b1c3f2b126a88ac",
      },
    ];
    try {
      const { data: recieveData } = await axios.get(
        `/addrs/${recieve}?unspentOnly=true&includeScript=true`
      );
      const { data: changeData } = await axios.get(
        `/addrs/${change}?unspentOnly=true&includeScript=true`
      );
      const result = [
        ...(recieveData.txrefs || []),
        ...(changeData.txrefs || []),
      ];
      console.log("result", result);
      return result;
    } catch (err) {
      console.error(err.message);
      if (err.response) console.error(err.response.data);
    }
  }

  //this function will fetch "UTXOs" using wallet name provided in "receive" and "change" argumnets using blockcypher APIs

  async generate_unsigned_transaction(xpub, output_address, amount) {
    const addresses = this.address_list(xpub, 0, 0, 20);
    const changeAddress = this.address_list(xpub, 1, 0, 20);

    const utxos = await this.fetch_utxo(addresses[0], changeAddress[0]);
    let targets = [
      {
        address: output_address,
        value: amount,
      },
    ];

    let { inputs, outputs } = coinSelect(
      utxos.map((u) => ({
        txId: u.tx_hash,
        vout: u.tx_output_n,
        value: u.value,
        script: u.script,
      })),
      targets,
      55
    );
    if (!inputs || !outputs) return;

    var txBuilder = new bjl.TransactionBuilder(bjl.networks.testnet);
    inputs.forEach((input) => {
      txBuilder.addInput(
        input.txId,
        input.vout,
        0xffffffff,
        Buffer.from(input.script, "hex")
      );
    });

    outputs.forEach((output) => {
      if (!output.address) output.address = changeAddress[0];
      txBuilder.addOutput(output.address, output.value);
    });

    const tx = txBuilder.buildIncomplete();
    inputs.forEach((input, i) => {
      tx.ins[i].script = Buffer.from(input.script, "hex");
    });
    return tx;
  }
  //this fucntion will generate unsigned txn using "xpub" to send "amount" to "output_address"

  async sign_transaction(unsigned_tx, private_key_wif) {
    const txBuilder = bjl.TransactionBuilder.fromTransaction(
      unsigned_tx,
      this.network
    );
    const keyPair = bjl.ECPair.fromWIF(private_key_wif, this.network);
    console.log("keyPiar: ", keyPair);
    txBuilder.sign(0, keyPair);
    const tx = txBuilder.build();
    return tx;
  }
  //this fucntion will sign an unsigned txn using "private_key_wif"

  async broadcast_transaction(signed_tx) {
    try {
      const { data } = await axios.post(
        `/txs/push?token=${process.env.BLOCKCYPHER_TOKEN}`,
        {
          tx: signed_tx.toHex(),
        }
      );
      return { data, error: null };
    } catch (err) {
      console.error(err.message);
      console.error(err.response.data);
      return { data: null, error: err.response.data };
    }
  }
  //this fucntion will broadcast a signed transaction using blockcypher APIs
}

async function main() {
  let a = new Wallet(bjl.networks.testnet);
  const privateKeyWIF = fs
    .readFileSync(path.join(__dirname, "./.secret"))
    .toString();

  // a.add_wallet("testWallet", addresses);
  // a.fetch_wallet("testWallet");
  // a.add_addresses("testWallet", addresses);

  // "tpubDCXQSRz1QR71xTm78eE75gXcV4goo6sYG5yRuSVeTfpLbT2P4Aaf4KBgQpHpZ1GhaR6Z4ktazi1hHbzMeJG6htSyiracJYmz1zQReiJmLsN",
  const addresses = a.address_list(
    "tpubDDstPjuTiifdCGdDTHTZWRn96GfDPQtycNB6uotgJ8kdg6ydeuD8yT3xHiBgfxRpJ1ih96DuKQWb6VP7U9UtYRNpvUDfUtsjcnXhdLXT9x9",
    0,
    0,
    20
  );
  // this.address_list(xpub, 0, 0, 20);
  const from = addresses[20];

  const tx = await a.generate_unsigned_transaction(
    "tpubDDstPjuTiifdCGdDTHTZWRn96GfDPQtycNB6uotgJ8kdg6ydeuD8yT3xHiBgfxRpJ1ih96DuKQWb6VP7U9UtYRNpvUDfUtsjcnXhdLXT9x9",
    // "n3AUMFmYXE9FNgXHWkXZQVkkmxfCF5kbnd",
    from,
    500
  );
  const signedTx = await a.sign_transaction(tx, privateKeyWIF);
  const broadcastTx = await a.broadcast_transaction(signedTx);
  console.log("FROM: ", from);
  console.log("broadcastTx: ", broadcastTx);
}
main();
