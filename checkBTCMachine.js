const axios = require('axios');

// Function to check if a BTC address holds a specific NFT or asset
async function checkBTCMachineOwnership(address) {
    try {
        // Construct the API URL with the provided Bitcoin address
        const apiUrl = `https://api-mainnet.magiceden.dev/v2/ord/btc/runes/wallet/activities/${address}`;

        // Make the request to the API with the Authorization header
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': 'Bearer 3d0a7719-4280-45cc-807c-335eada01fc8',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        const assets = response.data;
        console.log(assets);
        // Check if any asset has a rune starting with "MACHINE" and formattedAmount is 777
        const hasBTCMachine = assets.some(asset =>
            asset.rune.startsWith('MACHINE') && asset.formattedAmount === '777'
        );

        return hasBTCMachine;
    } catch (error) {
        console.error('Error fetching or processing data:', error.message);
        throw error;
    }
}

module.exports = { checkBTCMachineOwnership };
