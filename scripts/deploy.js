const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment...");
  
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  
  // Get the contract factory
  const CharityDonation = await hre.ethers.getContractFactory("CharityDonation");
  
  // Deploy the contract
  console.log("📦 Deploying CharityDonation contract...");
  const charityDonation = await CharityDonation.deploy(deployer.address);
  
  await charityDonation.waitForDeployment();
  
  const contractAddress = await charityDonation.getAddress();
  
  console.log("✅ CharityDonation deployed to:", contractAddress);
  console.log("🔗 Network:", hre.network.name);
  console.log("⛽ Gas used for deployment:", (await charityDonation.deploymentTransaction().wait()).gasUsed.toString());
  
  console.log("🎉 Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });