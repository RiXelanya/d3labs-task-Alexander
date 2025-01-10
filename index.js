const { Alchemy, Network, Utils } = require("alchemy-sdk");
const ethers = require("ethers");
const EthDater = require("ethereum-block-by-date");

require("dotenv").config();

const provider = ethers.getDefaultProvider();

const dater = new EthDater(
  provider, // Ethers provider, required.
);

const config = {
  apiKey: process.env.ALCHEMY_API,
  network: Network.ETH_MAINNET,
};
const alchemy = new Alchemy(config);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const main = async () => {
  const address =
    process.env.Contract ?? "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D";
  const epochs = Date(process.argv[2]) ?? Date.now();
  const { block } = await dater.getDate(epochs);

  // Block number or height
  const options = {
    withTokenBalances: false,
    block: block,
  };

  // Get owners
  const { owners } = await alchemy.nft.getOwnersForContract(address, options);
  const promises = owners.map((query) => {
    return queryValue(query, block);
  });
  // I use map to transform array of owner string to array of promises of eth value

  let result = [];

  await handlePromise(promises, result);

  result.map((res) => {
    console.log(`Address ${res.query} has balance of ${res.balance} ETH`);
  });
};

const handlePromise = async (promises, result) => {
  const response = await Promise.allSettled(promises);
  // I use promises all settled instead of promises all to account
  // for the possibility of failure, making sure that a few error does not invalidate the rest
  let newPromises = [];

  response.forEach((element) => {
    if (element.status === "fulfilled") {
      result.push(element.value);
    } else {
      const promise = queryValue(element.reason.message, block);
      newPromises.push(promise);
    }
  });

  if (newPromises.length === 0) {
    return;
  } else {
    await sleep(5000); // use sleep to give the API time for recovery
    return handlePromise(newPromises, result); // I use recursion to deal with error
  }
};

const queryValue = async (query, block) => {
  return provider
    .getBalance(query, block)
    .then((result) => {
      const balance = ethers.formatEther(result);
      return {
        query: query,
        balance: balance,
      };
    })
    .catch((e) => {
      console.error(e);
      throw new Error(query);
    });
}; // this is a function that returns a promise to get eth value

const runMain = async () => {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
};

runMain();
