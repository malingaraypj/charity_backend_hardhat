const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment...");
  
  // Get the contract factory
  const SimpleStorage = await hre.ethers.getContractFactory("SimpleStorage");
  
  // Deploy the contract
  console.log("📦 Deploying SimpleStorage contract...");
  const simpleStorage = await SimpleStorage.deploy();
  
  await simpleStorage.waitForDeployment();
  
  const contractAddress = await simpleStorage.getAddress();
  
  console.log("✅ SimpleStorage deployed to:", contractAddress);
  console.log("🔗 Network:", hre.network.name);
  console.log("⛽ Gas used for deployment:", (await simpleStorage.deploymentTransaction().wait()).gasUsed.toString());
  
  // Verify the deployment by calling a function
  console.log("🔍 Verifying deployment...");
  const initialValue = await simpleStorage.get();
  console.log("📊 Initial stored value:", initialValue.toString());
  
  // Set a test value
  console.log("🧪 Setting test value...");
  const tx = await simpleStorage.set(42);
  await tx.wait();
  
  const newValue = await simpleStorage.get();
  console.log("📊 New stored value:", newValue.toString());
  
  console.log("🎉 Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });