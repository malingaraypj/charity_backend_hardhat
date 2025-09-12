const express = require("express");
const router = express.Router();
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

let charityDonationContract;
let charityDonationAddress;
let adminSigner;

// Helper to get contract ABI
const getContractAbi = () => {
  const buildInfoPath = path.resolve(
    __dirname,
    "../artifacts/contracts/CharityDonation.sol/CharityDonation.json"
  );
  if (!fs.existsSync(buildInfoPath)) {
    throw new Error(
      "CharityDonation.json not found. Ensure contract is compiled."
    );
  }
  const contractJson = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
  return contractJson.abi;
};

// POST /api/blockchain/deploy-charity-donation
router.post("/deploy-charity-donation", async (req, res) => {
  try {
    const [deployer] = await ethers.getSigners();
    adminSigner = deployer; // Set admin signer for later use

    const CharityDonationFactory = await ethers.getContractFactory(
      "CharityDonation",
      adminSigner
    );
    const charityDonation = await CharityDonationFactory.deploy(
      adminSigner.address
    );
    await charityDonation.waitForDeployment();

    charityDonationContract = charityDonation; // Store contract instance
    charityDonationAddress = await charityDonation.getAddress(); // Store contract address

    res.status(200).json({
      success: true,
      message: "CharityDonation contract deployed successfully",
      address: charityDonationAddress,
      deployer: adminSigner.address,
    });
  } catch (error) {
    console.error("Deployment error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Middleware to ensure contract is deployed before other interactions
router.use((req, res, next) => {
  if (!charityDonationContract) {
    return res.status(400).json({
      success: false,
      error: "CharityDonation contract not deployed. Please deploy it first.",
    });
  }
  next();
});

// POST /api/blockchain/campaigns for createCampaign
router.post("/campaigns", async (req, res) => {
  try {
    const { receiver, cause, description, targetAmount, deadline } = req.body;
    const tx = await charityDonationContract.createCampaign(
      receiver,
      cause,
      description,
      ethers.parseEther(targetAmount.toString()),
      deadline
    );
    await tx.wait();
    res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      txHash: tx.hash,
    });
  } catch (error) {
    console.error("Create campaign error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/blockchain/campaigns/:id/approve
router.put("/campaigns/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const tx = await charityDonationContract
      .connect(adminSigner)
      .approveCampaign(id);
    await tx.wait();
    res.status(200).json({
      success: true,
      message: `Campaign ${id} approved`,
      txHash: tx.hash,
    });
  } catch (error) {
    console.error("Approve campaign error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/blockchain/campaigns/:id/block
router.put("/campaigns/:id/block", async (req, res) => {
  try {
    const { id } = req.params;
    const tx = await charityDonationContract
      .connect(adminSigner)
      .blockCampaign(id);
    await tx.wait();
    res.status(200).json({
      success: true,
      message: `Campaign ${id} blocked`,
      txHash: tx.hash,
    });
  } catch (error) {
    console.error("Block campaign error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/blockchain/campaigns/:id/donate
router.post("/campaigns/:id/donate", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const donor = (await ethers.getSigners())[1]; // Using a different signer for donation
    const tx = await charityDonationContract
      .connect(donor)
      .donate(id, { value: ethers.parseEther(amount.toString()) });
    await tx.wait();
    res.status(200).json({
      success: true,
      message: `Donation to campaign ${id} successful`,
      txHash: tx.hash,
    });
  } catch (error) {
    console.error("Donate error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/blockchain/campaigns/:id/withdraw
router.post("/campaigns/:id/withdraw", async (req, res) => {
  try {
    const { id } = req.params;
    // Assuming the receiver is the one calling this endpoint, or we get a specific signer
    const receiverSigner = (await ethers.getSigners())[0]; // For simplicity, using deployer as receiver if needed
    const tx = await charityDonationContract
      .connect(receiverSigner)
      .withdrawFunds(id);
    await tx.wait();
    res.status(200).json({
      success: true,
      message: `Funds withdrawn from campaign ${id}`,
      txHash: tx.hash,
    });
  } catch (error) {
    console.error("Withdraw funds error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/blockchain/campaigns/:id/refund
router.post("/campaigns/:id/refund", async (req, res) => {
  try {
    const { id } = req.params;
    const donorSigner = (await ethers.getSigners())[1]; // Assuming donor is calling this
    const tx = await charityDonationContract
      .connect(donorSigner)
      .claimRefund(id);
    await tx.wait();
    res.status(200).json({
      success: true,
      message: `Refund claimed for campaign ${id}`,
      txHash: tx.hash,
    });
  } catch (error) {
    console.error("Claim refund error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/blockchain/campaigns for getAllCampaigns
router.get("/campaigns", async (req, res) => {
  try {
    const campaigns = await charityDonationContract.getAllCampaigns();
    // Format the output for better readability
    const formattedCampaigns = campaigns.map((campaign) => ({
      campaignId: campaign.id.toString(),
      receiver: campaign.receiver,
      cause: campaign.cause,
      description: campaign.description,
      targetAmount: ethers.formatEther(campaign.targetAmount),
      raisedAmount: ethers.formatEther(campaign.amountRaised),
      deadline: campaign.deadline.toString(),
      status: getCampaignStatusString(campaign.status),
      fundsWithdrawn: campaign.fundsWithdrawn,
    }));
    res.status(200).json({ success: true, campaigns: formattedCampaigns });
  } catch (error) {
    console.error("Get all campaigns error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to convert status enum to string
function getCampaignStatusString(statusCode) {
  const statuses = ["Pending", "Approved", "Blocked", "Completed", "Failed"];
  return statuses[statusCode] || "Unknown";
}

// GET /api/blockchain/campaigns/:id for getCampaign
router.get("/campaigns/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await charityDonationContract.getCampaign(id);
    res.status(200).json({
      success: true,
      campaign: {
        receiver: campaign.receiver,
        cause: campaign.cause,
        description: campaign.description,
        targetAmount: ethers.formatEther(campaign.targetAmount),
        raisedAmount: ethers.formatEther(campaign.amountRaised),
        deadline: campaign.deadline.toString(),
        status: getCampaignStatusString(campaign.status),
        fundsWithdrawn: campaign.fundsWithdrawn,
        creator: campaign.creator,
      },
    });
  } catch (error) {
    console.error("Get campaign error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/blockchain/campaigns/:id/donations for getDonations
router.get("/campaigns/:id/donations", async (req, res) => {
  try {
    const { id } = req.params;
    const donations = await charityDonationContract.getDonations(id);
    const formattedDonations = donations.map((donation) => ({
      donorAddress: donation.donor,
      amount: ethers.formatEther(donation.amount),
      timestamp: donation.timestamp.toString(),
    }));
    res.status(200).json({ success: true, donations: formattedDonations });
  } catch (error) {
    console.error("Get donations error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/blockchain/campaigns/:id/donations/:donorAddress for getDonationAmount
router.get("/campaigns/:id/donations/:donorAddress", async (req, res) => {
  try {
    const { id, donorAddress } = req.params;
    const amount = await charityDonationContract.getDonationAmount(
      id,
      donorAddress
    );
    res.status(200).json({
      success: true,
      donorAddress,
      amount: ethers.formatEther(amount),
    });
  } catch (error) {
    console.error("Get donation amount error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
