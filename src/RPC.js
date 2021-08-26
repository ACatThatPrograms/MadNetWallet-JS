const { default: Axios } = require('axios');
const validator = require("./Validator.js");
const constant = require("./Constants.js");
/**
 * RPC request handler
 * @class RPC
 */
class RPC {
    /**
     * Creates an instance of RPC.
     * @param {Object} Wallet
     * @param {string} [rpcServer=false]
     */
    constructor(Wallet, rpcServer) {
        this.Wallet = Wallet;
        this.rpcServer = rpcServer ? rpcServer : false;
    }

    /**
     * Set RPC provider
     * @param {string} rpcServer
     * @param {number} chainId
     */
    async setProvider(rpcServer) {
        try {
            if (!rpcServer) {
                throw "RPC server not provided"
            }
            this.rpcServer = rpcServer;
            let chainId = await this.getChainId();
            this.Wallet.chainId = chainId;
            return chainId;
        }
        catch (ex) {
            throw new Error("RPC.setProvider: " + String(ex));
        }
    }


    /**
     * Get block header by height
     * @param {number} height
     * @return {number} 
     */
    async getBlockHeader(height) {
        height = validator.isNumber(height)
        try {
            let BH = await this.request("get-block-header", { "Height": height });
            if (!BH["BlockHeader"]) {
                throw "Block header not found"
            }
            return BH["BlockHeader"];
        }
        catch (ex) {
            throw new Error("RPC.getBlockHeader: " + String(ex));
        }
    }

    /**
     * Get current block height
     * @return {number} block height
     */
    async getBlockNumber() {
        try {
            let BN = await this.request("get-block-number")
            if (!BN["BlockHeight"]) {
                throw "Block height not found"
            }
            return BN["BlockHeight"]
        }
        catch (ex) {
            throw new Error("RPC.getBlockNumber: " + String(ex));
        }
    }

    /**
     * Get current chain id
     * @return {number} chain id
     */
    async getChainId() {
        try {
            let CI = await this.request("get-chain-id");
            if (!CI["ChainID"]) {
                throw "Chain id not found"
            }
            return CI["ChainID"]
        }
        catch (ex) {
            throw new Error("RPC.getChainId: " + String(ex));
        }
    }

    /**
     * Get current epoch
     * @return {number} epoch
     */
    async getEpoch() {
        try {
            let epoch = await this.request("get-epoch-number")
            if (!epoch["Epoch"]) {
                throw "Epoch not found"
            }
            return epoch["Epoch"]
        }
        catch (ex) {
            throw new Error("RPC.getEpoch: " + String(ex))
        }
    }

    /**
     * Get UTXOs for account by array of utxo ids
     * @param {hex} address
     * @param {Object} UTXOIDs
     */
    async getUTXOsByIds(UTXOIDs) {
        try {
            let isArray = Array.isArray(UTXOIDs)
            if (!isArray) {
                throw "Invalid arguments"
            }
            let minrequests = Math.ceil(UTXOIDs.length / constant.MaxUTXOs);
            let DataStores = [];
            let ValueStores = [];
            let AtomicSwaps = [];
            for (let i = 0; i < minrequests; i++) {
                let reqData = { "UTXOIDs": UTXOIDs.slice((i * constant.MaxUTXOs), ((i + 1) * constant.MaxUTXOs)) }
                let utxos = await this.request("get-utxo", reqData)
                if (!utxos["UTXOs"]) {
                    utxos["UTXOs"] = []
                }
                for await (let utxo of utxos["UTXOs"]) {
                    if (utxo["DataStore"]) {
                        DataStores.push(utxo["DataStore"]);
                    }
                    else if (utxo["ValueStore"]) {
                        ValueStores.push(utxo["ValueStore"]);
                    }
                    else if (utxo["AtomicSwap"]) {
                        AtomicSwaps.push(utxo["AtomicSwap"]);
                    }
                }
            }
            return [DataStores, ValueStores, AtomicSwaps];
        }
        catch (ex) {
            throw new Error("RPC.getUTXOsByIds: " + String(ex))
        }
    }

    /**
     * Get value store UTXO IDs
     * @param {hex} address
     * @param {number} curve
     * @param {number} minValue
     */
    async getValueStoreUTXOIDs(address, curve, minValue) {
        try {
            if (!address || !curve || !minValue) {
                throw "Invalid arguments"
            }
            address = validator.isAddress(address)
            curve = validator.isNumber(curve)
            minValue = validator.numToHex(minValue)
            let valueForOwner = { "CurveSpec": curve, "Account": address, "Minvalue": minValue.toString() }
            let value = await this.request("get-value-for-owner", valueForOwner)
            if (!value["UTXOIDs"] || !value["TotalValue"]) {
                value = {};
                value["UTXOIDs"] = [];
                value["TotalValue"] = "0"
            }
            return [value["UTXOIDs"], value["TotalValue"]];
        }
        catch (ex) {
            throw new Error("RPC.getValueStoreUTXOIDs: " + String(ex))
        }
    }

    /**
     * Get Data Store UTXO IDs for account
     * @param {hex} address
     * @param {number} limit
     * @param {number} offset
     */
    async getDataStoreUTXOIDs(address, curve, limit, offset) {
        try {
            if (!address || !curve) {
                throw "Invalid arguments"
            }
            address = validator.isAddress(address)
            curve = validator.isNumber(curve)
            let getAll = false;
            if (!limit || limit > constant.MaxUTXOs) {
                if (!limit) {
                    getAll = true;
                }
                limit = constant.MaxUTXOs;
            }
            else {
                limit = validator.isNumber(limit);
            }
            if (!offset) {
                offset = "";
            }
            else {
                offset = validator.isHex(offset)
            }
            let DataStoreUTXOIDs = [];
            while (true) {
                let reqData = { "CurveSpec": curve, "Account": address, "Number": limit, "StartIndex": offset }
                let dataStoreIDs = await this.request("iterate-name-space", reqData);
                if (!dataStoreIDs["Results"]) {
                    break
                } 
                DataStoreUTXOIDs = DataStoreUTXOIDs.concat(dataStoreIDs["Results"]);
                if (dataStoreIDs["Results"].length <= limit && !getAll) {
                    break;
                }
                offset = dataStoreIDs["Results"][dataStoreIDs["Results"].length - 1]["Index"];
            }
            return DataStoreUTXOIDs;
        }
        catch (ex) {
            throw new Error("RPC.getDataStoreUTXOIDs: " + String(ex))
        }

    }

    /**
     * Get raw data for a data store
     * @param {hex} address
     * @param {hex} index
     * @return {hex} raw data
     */
    async getData(address, curve, index) {
        try {
            address = validator.isAddress(address)
            curve = validator.isNumber(curve);
            index = validator.isHex(index);
            if (!address || !index || !curve) {
                throw "Invalid arguments"
            }
            let reqData = { "Account": address, "CurveSpec": curve, "Index": index }
            let dataStoreData = await this.request("get-data", reqData);
            if (!dataStoreData["Rawdata"]) {
                throw "Data not found"
            }
            return dataStoreData["Rawdata"];
        }
        catch (ex) {
            throw new Error("RPC.getData: " + String(ex))
        }
    }

    /**
     * 
     * @param {hex} address 
     * @param {number} curve 
     * @param {hex} index
     * @return {Object} DataStore 
     */
    async getDataStoreByIndex(address, curve, index) {
        try {
            let dsUTXOID = await this.getDataStoreUTXOIDs(address, curve, 1, index);
            let dsUTXOIDS = []
            for ( let i = 0; i < dsUTXOID.length; i++) {
                dsUTXOIDS.push(dsUTXOID[i]["UTXOID"])
            }
            if (dsUTXOIDS.length > 0) {
                let [DS, VS, AS] = await this.getUTXOsByIds(dsUTXOIDS);
                if (DS.length > 0) {
                    return DS[0];
                }
            }
            return false;
        }
        catch (ex) {
            throw new Error("RPC.getDataStoreByIndex: " + String(ex))
        }
    }

    /**
     * Send transaction
     * @param {Object} Tx
     * @return {hex} transaction hash 
     */
    async sendTransaction(Tx) {
        try {
            let sendTx = await this.request("send-transaction", Tx);
            if (!sendTx["TxHash"]) {
                throw "Transaction error"
            }
            return sendTx["TxHash"];
        }
        catch (ex) {
            throw new Error("RPC.sendTransaction: " + String(ex))
        }
    }

    /**
     * Get mined transaction
     * @param {hex} txHash
     * @return {Object} transaction object 
     */
    async getMinedTransaction(txHash) {
        try {
            let getMined = await this.request("get-mined-transaction", { "TxHash": txHash });
            if (!getMined["Tx"]) {
                throw "Transaction not mined"
            }
            return getMined;
        }
        catch (ex) {
            throw new Error("RPC.getMinedTransaction: " + String(ex));
        }
    }
    
    /**
     * Get pending transaction
     * @param {hex} txHash
     * @return {Object} transaction object 
     */
     async getPendingTransaction(txHash) {
        try {
            let getPending = await this.request("get-pending-transaction", { "TxHash": txHash });
            if (!getPending["Tx"]) {
                throw "Transaction not pending"
            }
            return getPending["Tx"];
        }
        catch(ex) {
            throw new Error("RPC.getPendingTransaction: " + String(ex));
        }
    }

    /**
     * Get block height of a transaction
     * @param {hex} txHash
     * @return {number} Block height
     */
    async getTxBlockHeight(txHash) {
        try {
            let txHeight = await this.request('get-tx-block-number', {"TxHash": txHash});
            if (!txHeight["BlockHeight"]) {
                throw "Block height not found"
            }
            return txHeight['BlockHeight'];
        }
        catch(ex) {
            throw new Error("RPC.getTxBlockHeight: " + String(ex));
        }
    }

    /**
     * Send a request to the rpc server
     * @param {string} route
     * @param {Object} data
     * @return {Object} response
     */
    async request(route, data) {
        try {
            if (!this.Wallet.chainId && this.rpcServer) {
                await this.setProvider(this.provider);
            }
            if (!this.rpcServer) {
                throw "No rpc provider"
            }
            if (!route) {
                throw "No route provided";
            }
            if (!data) {
                data = {};
            }
            let resp = await Axios.post(this.rpcServer + route, data, { timeout: constant.ReqTimeout, validateStatus: function (status) { return status } });
            if (!resp || !resp.data) {
                throw "Bad response";
            }
            if (resp.data["error"]) {
                throw JSON.stringify(resp.data["error"])
            }
            return resp.data;
        }
        catch (ex) {
            throw new Error("RPC.request: " + String(ex));
        }
    }
}
module.exports = RPC;