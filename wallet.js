const bjl = require("bitcoinjs-lib");
require("dotenv").config();
const ecc = require("tiny-secp256k1");
const coinSelect = require("coinselect/accumulative");
let BIP32Factory = require("bip32").default;

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
      console.error(err.response.data);
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
      console.error(err.response.data);
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
      console.error(err.response.data);
    }
  }

  //this function will fetch the "addresses" from blockcypher database of an already existing wallet recognised by the "name" argument.
  async fetch_utxo(recieve, change) {
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

    // console.log(addresses);
    // this.add_wallet("testWallet", addresses);
    // this.fetch_wallet("testWallet");
    // this.add_addresses("testWallet", addresses);
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
        // nonWitnessUtxo: Buffer.from("...full raw hex of txId tx...", "hex"),
        // nonWitnessUtxo:  Buffer.from("HOW DO I GET THIS?", "hex"),
      })),
      targets,
      55
    );
    console.log("inputs ", inputs);
    console.log("outputs", outputs);
    if (!inputs || !outputs) return;

    const psbt = new bjl.Psbt();
    psbt.setVersion(1);
    psbt.setLocktime(0);
    inputs.forEach((input) => {
      psbt.addInput({
        hash: input.txId,
        index: input.vout,
        sequence: 0xffffffff,
        sighashType: 1,
        // non-segwit inputs now require passing the whole previous tx as Buffer
        //THIS IS FROM THE DOC OF BITCOINJS_LIB
        //HOW DO I GET THIS FOR CURRENT UTXO?
        // nonWitnessUtxo: Buffer.from(
        //   "0200000001f9f34e95b9d5c8abcd20fc5bd4a825d1517be62f0f775e5f36da944d9" +
        //     "452e550000000006b483045022100c86e9a111afc90f64b4904bd609e9eaed80d48" +
        //     "ca17c162b1aca0a788ac3526f002207bb79b60d4fc6526329bf18a77135dc566020" +
        //     "9e761da46e1c2f1152ec013215801210211755115eabf846720f5cb18f248666fec" +
        //     "631e5e1e66009ce3710ceea5b1ad13ffffffff01" +
        // value in satoshis (Int64LE) = 0x015f90 = 90000
        //     "905f010000000000" +
        // scriptPubkey length
        //     "19" +
        // scriptPubkey
        //     "76a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac" +
        // locktime
        //     "00000000",
        //   "hex"
        // ),

        // If this input was segwit, instead of nonWitnessUtxo, you would add
        // a witnessUtxo as follows. The scriptPubkey and the value only are needed.
        // witnessUtxo: {
        //   script: Buffer.from(input.script, "hex"),
        //   value: 90000,
        // },
      });
    });
    outputs.forEach((output) => {
      // if(!output.)
      psbt.addOutput(output);
    });

    // console.log(psbt.data);
    console.log(psbt.toHex());
  }
  //this fucntion will generate unsigned txn using "xpub" to send "amount" to "output_address"
}

let a = new Wallet(bjl.networks.testnet);

a.generate_unsigned_transaction(
  // "tpubDCXQSRz1QR71xTm78eE75gXcV4goo6sYG5yRuSVeTfpLbT2P4Aaf4KBgQpHpZ1GhaR6Z4ktazi1hHbzMeJG6htSyiracJYmz1zQReiJmLsN",
  "tpubDDstPjuTiifdCGdDTHTZWRn96GfDPQtycNB6uotgJ8kdg6ydeuD8yT3xHiBgfxRpJ1ih96DuKQWb6VP7U9UtYRNpvUDfUtsjcnXhdLXT9x9",
  "n3AUMFmYXE9FNgXHWkXZQVkkmxfCF5kbnd",
  500
);
