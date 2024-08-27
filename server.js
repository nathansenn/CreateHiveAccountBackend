const express = require('express');
const dhive = require('@hiveio/dhive');
const bitcoinMessage = require("bitcoinjs-message");
const { checkBTCMachineOwnership } = require('./checkBTCMachine');
const cors = require('cors');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const port = 3000;

// Hive client
const client = new dhive.Client('https://api.hive.blog');

// Middleware to parse JSON bodies
app.use(express.json());

// Enable CORS for all routes
app.use(cors());

// File path for storing BTC addresses
const BTC_ADDRESSES_FILE = 'btc_addresses.json';

// Function to verify a Bitcoin message signature
function verifySignature(address, message, signature) {
    try {
        return bitcoinMessage.verify(message, address, signature);
    } catch (error) {
        throw new Error('Signature verification failed');
    }
}

// Function to read BTC addresses from file
async function readBTCAddresses() {
    try {
        const data = await fs.readFile(BTC_ADDRESSES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, return an empty array
            return [];
        }
        throw error;
    }
}

// Function to write BTC addresses to file
async function writeBTCAddresses(addresses) {
    await fs.writeFile(BTC_ADDRESSES_FILE, JSON.stringify(addresses, null, 2));
}

app.post('/check-btc-machine', async (req, res) => {
    const { address } = req.body;

    if (!address) {
        return res.status(400).json({ error: 'Address is required' });
    }

    try {
        const ownsBTCMachine = await checkBTCMachineOwnership(address);
        res.json({ ownsBTCMachine });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to create a new account using claimed accounts with signature verification
app.post('/create-account', async (req, res) => {
    const { username, address, message, signature } = req.body;

    if (!username || !address || !message || !signature) {
        return res.status(400).json({ error: 'Username, address, message, and signature are required' });
    }

    try {
        // Verify the Bitcoin message signature
        const isValid = verifySignature(address, message, signature);

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid signature' });
        }

        // Check if the BTC address has already been used
        const usedAddresses = await readBTCAddresses();
        if (usedAddresses.includes(address)) {
            return res.status(400).json({ error: 'This BTC address has already been used to create an account' });
        }

        const ownsBTCMachine = await checkBTCMachineOwnership(address);
        // if (!ownsBTCMachine) {
        //      return res.status(400).json({ error: 'No Bitcoin Machine' });
        // }

        const accountCreator = process.env.HIVE_ACCOUNT_CREATOR;
        const activeKey = dhive.PrivateKey.fromString(process.env.HIVE_ACCOUNT_CREATOR_ACTIVE_KEY);

        const ownerKey = dhive.PrivateKey.fromLogin(username, 'owner', 'posting');
        const activeKeyNew = dhive.PrivateKey.fromLogin(username, 'active', 'posting');
        const postingKey = dhive.PrivateKey.fromLogin(username, 'posting', 'posting');
        const memoKey = dhive.PrivateKey.fromLogin(username, 'memo', 'posting');

        const publicOwnerKey = ownerKey.createPublic().toString();
        const publicActiveKey = activeKeyNew.createPublic().toString();
        const publicPostingKey = postingKey.createPublic().toString();
        const publicMemoKey = memoKey.createPublic().toString();

        const createAccount = await client.broadcast.sendOperations(
            [
                [
                    'create_claimed_account',
                    {
                        creator: accountCreator,
                        new_account_name: username,
                        owner: {
                            weight_threshold: 1,
                            account_auths: [],
                            key_auths: [[publicOwnerKey, 1]],
                        },
                        active: {
                            weight_threshold: 1,
                            account_auths: [],
                            key_auths: [[publicActiveKey, 1]],
                        },
                        posting: {
                            weight_threshold: 1,
                            account_auths: [],
                            key_auths: [[publicPostingKey, 1]],
                        },
                        memo_key: publicMemoKey,
                        json_metadata: '',
                        extensions: [],
                    },
                ],
            ],
            activeKey
        );

        // Save the BTC address to the JSON file
        usedAddresses.push(address);
        await writeBTCAddresses(usedAddresses);

        res.json({
            success: true,
            result: createAccount,
            keys: {
                owner: ownerKey.toString(),
                active: activeKeyNew.toString(),
                posting: postingKey.toString(),
                memo: memoKey.toString(),
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Hive API listening at http://localhost:${port}`);
});
