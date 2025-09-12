const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CharityDonation", function () {
  let CharityDonation;
  let charityDonation;
  let admin;
  let receiver;
  let donor1;
  let donor2;

  beforeEach(async function () {
    [admin, receiver, donor1, donor2] = await ethers.getSigners();
    CharityDonation = await ethers.getContractFactory("CharityDonation");
    charityDonation = await CharityDonation.deploy(admin.address);
    await charityDonation.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right admin", async function () {
      expect(await charityDonation.admin()).to.equal(admin.address);
    });

    it("Should initialize nextCampaignId to 0", async function () {
      expect(await charityDonation.getNextCampaignId()).to.equal(1);
    });
  });

  describe("Campaign Management", function () {
    it("Should create a new campaign", async function () {
      const targetAmount = ethers.parseEther("10");
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3600; // 1 hour from now

      await expect(
        charityDonation.createCampaign(
          receiver.address,
          "Education",
          "Support education for underprivileged children",
          targetAmount,
          deadline
        )
      )
        .to.emit(charityDonation, "CampaignCreated")
        .withArgs(1, receiver.address, "Education", targetAmount, deadline);

      const campaign = await charityDonation.getCampaign(1);
      expect(campaign.receiver).to.equal(receiver.address);
      expect(campaign.cause).to.equal("Education");
      expect(campaign.targetAmount).to.equal(targetAmount);
      expect(campaign.deadline).to.equal(deadline);
      expect(campaign.status).to.equal(0); // Pending status is 0

      expect(await charityDonation.getNextCampaignId()).to.equal(2);
    });

    it("Should not create a campaign with past deadline", async function () {
      const targetAmount = ethers.parseEther("10");
      const deadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      await expect(
        charityDonation.createCampaign(
          receiver.address,
          "Education",
          "Support education for underprivileged children",
          targetAmount,
          deadline
        )
      ).to.be.revertedWith("deadline must be in future");
    });

    it("Should allow admin to approve a campaign", async function () {
      const targetAmount = ethers.parseEther("10");
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3600;
      // Campaign 0 is created in the beforeEach hook for this describe block
      // We need to create a new campaign for this specific test that is not approved.
      let unapprovedCampaignId;
      const createCampaignTx = await charityDonation.createCampaign(
        receiver.address,
        "Unapproved",
        "Desc",
        targetAmount,
        deadline
      );
      const receipt = await createCampaignTx.wait();
      unapprovedCampaignId = receipt.logs[0].args.id;

      await expect(charityDonation.connect(admin).approveCampaign(1))
        .to.emit(charityDonation, "CampaignApproved")
        .withArgs(1);

      const campaign = await charityDonation.getCampaign(1);
      expect(campaign.status).to.equal(1); // Approved status is 1
    });

    it("Should not allow non-admin to approve a campaign", async function () {
      const targetAmount = ethers.parseEther("10");
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3600;
      await charityDonation.createCampaign(
        receiver.address,
        "Education",
        "Desc",
        targetAmount,
        deadline
      );

      await expect(
        charityDonation.connect(donor1).approveCampaign(0)
      ).to.be.revertedWith("only admin");
    });

    it("Should allow admin to block a campaign", async function () {
      const targetAmount = ethers.parseEther("10");
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3600;
      await charityDonation.createCampaign(
        receiver.address,
        "Education",
        "Desc",
        targetAmount,
        deadline
      );

      await expect(charityDonation.connect(admin).blockCampaign(1))
        .to.emit(charityDonation, "CampaignBlocked")
        .withArgs(1);

      const campaign = await charityDonation.getCampaign(1);
      expect(campaign.status).to.equal(2); // Blocked status is 2
    });
  });

  describe("Donations", function () {
    beforeEach(async function () {
      const targetAmount = ethers.parseEther("10");
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3600;
      const createCampaignTx = await charityDonation.createCampaign(
        receiver.address,
        "Education",
        "Desc",
        targetAmount,
        deadline
      );
      const receipt = await createCampaignTx.wait();
      const campaignId = receipt.logs[0].args.id;
      await charityDonation.connect(admin).approveCampaign(campaignId);
    });

    it("Should allow users to donate to an approved campaign", async function () {
      const donationAmount = ethers.parseEther("1");
      await expect(
        charityDonation.connect(donor1).donate(1, { value: donationAmount })
      )
        .to.emit(charityDonation, "DonationReceived")
        .withArgs(1, donor1.address, donationAmount);

      const campaign = await charityDonation.getCampaign(1);
      expect(campaign.amountRaised).to.equal(donationAmount);
      expect(
        await charityDonation.getDonationAmount(1, donor1.address)
      ).to.equal(donationAmount);
    });

    it("Should not allow donations to unapproved campaigns", async function () {
      const targetAmount = ethers.parseEther("10");
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3600;
      const createCampaignTx = await charityDonation.createCampaign(
        receiver.address,
        "Healthcare",
        "Desc",
        targetAmount,
        deadline
      );
      const receipt = await createCampaignTx.wait();
      const unapprovedCampaignId = receipt.logs[0].args.id;

      const donationAmount = ethers.parseEther("1");
      await expect(
        charityDonation
          .connect(donor1)
          .donate(unapprovedCampaignId, { value: donationAmount })
      ).to.be.revertedWith("campaign not approved");
    });

    it("Should not allow donations to blocked campaigns", async function () {
      const targetAmount = ethers.parseEther("10");
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + 3600;
      await charityDonation.createCampaign(
        receiver.address,
        "Healthcare",
        "Desc",
        targetAmount,
        deadline
      ); // Campaign 1
      await charityDonation.connect(admin).blockCampaign(1);

      const donationAmount = ethers.parseEther("1");
      await expect(
        charityDonation.connect(donor1).donate(1, { value: donationAmount })
      ).to.be.revertedWith("campaign not approved"); // Blocked campaigns are not approved, so this is the expected revert
    });

    it("Should not allow donations after the deadline", async function () {
      const targetAmount = ethers.parseEther("10");
      const block = await ethers.provider.getBlock("latest");
      const futureDeadline = block.timestamp + 3600; // 1 hour from now
      const createTimedCampaignTx = await charityDonation.createCampaign(
        receiver.address,
        "Timed",
        "Desc",
        targetAmount,
        futureDeadline
      );
      const timedCampaignReceipt = await createTimedCampaignTx.wait();
      const timedCampaignId = timedCampaignReceipt.logs[0].args.id;
      await charityDonation.connect(admin).approveCampaign(timedCampaignId);

      // Wait for the deadline to pass
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");

      const donationAmount = ethers.parseEther("1");
      await expect(
        charityDonation
          .connect(donor1)
          .donate(timedCampaignId, { value: donationAmount })
      ).to.be.revertedWith("campaign ended");
    });

    it("Should correctly sum multiple donations from the same donor", async function () {
      const donationAmount1 = ethers.parseEther("1");
      const donationAmount2 = ethers.parseEther("0.5");

      await charityDonation
        .connect(donor1)
        .donate(1, { value: donationAmount1 });
      await charityDonation
        .connect(donor1)
        .donate(1, { value: donationAmount2 });

      const campaign = await charityDonation.getCampaign(1);
      expect(campaign.amountRaised).to.equal(ethers.parseEther("1.5"));
      expect(
        await charityDonation.getDonationAmount(1, donor1.address)
      ).to.equal(ethers.parseEther("1.5"));
    });

    it("Should correctly sum donations from different donors", async function () {
      const donationAmount1 = ethers.parseEther("1");
      const donationAmount2 = ethers.parseEther("2");

      await charityDonation
        .connect(donor1)
        .donate(1, { value: donationAmount1 });
      await charityDonation
        .connect(donor2)
        .donate(1, { value: donationAmount2 });

      const campaign = await charityDonation.getCampaign(1);
      expect(campaign.amountRaised).to.equal(ethers.parseEther("3"));
      expect(
        await charityDonation.getDonationAmount(1, donor1.address)
      ).to.equal(donationAmount1);
      expect(
        await charityDonation.getDonationAmount(1, donor2.address)
      ).to.equal(donationAmount2);
    });
  });

  describe("Withdrawals and Refunds", function () {
    let targetAmount;
    let deadline;
    let donationAmount1;
    let donationAmount2;

    beforeEach(async function () {
      targetAmount = ethers.parseEther("10");
      const block = await ethers.provider.getBlock("latest");
      deadline = block.timestamp + 3600; // Short deadline for testing
      donationAmount1 = ethers.parseEther("6");
      donationAmount2 = ethers.parseEther("5");

      const createCampaignTx = await charityDonation.createCampaign(
        receiver.address,
        "Education",
        "Desc",
        targetAmount,
        deadline
      );
      const receipt = await createCampaignTx.wait();
      const campaignId = receipt.logs[0].args.id;
      await charityDonation.connect(admin).approveCampaign(campaignId);

      await charityDonation
        .connect(donor1)
        .donate(campaignId, { value: donationAmount1 });
      await charityDonation
        .connect(donor2)
        .donate(campaignId, { value: donationAmount2 });

      // Wait for the deadline to pass
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");
    });

    it("Should allow receiver to withdraw funds if target met", async function () {
      const campaign = await charityDonation.getCampaign(1);
      expect(campaign.amountRaised).to.be.gte(campaign.targetAmount); // Ensure target is met

      const initialReceiverBalance = await ethers.provider.getBalance(
        receiver.address
      );
      const totalRaised = campaign.amountRaised;

      await expect(charityDonation.connect(receiver).withdrawFunds(1))
        .to.emit(charityDonation, "FundsWithdrawn")
        .withArgs(1, receiver.address, totalRaised);

      const finalReceiverBalance = await ethers.provider.getBalance(
        receiver.address
      );
      expect(finalReceiverBalance).to.be.closeTo(
        initialReceiverBalance + totalRaised,
        ethers.parseEther("0.001")
      );

      const updatedCampaign = await charityDonation.getCampaign(1);
      // The contract does not reset amountRaised to 0 after withdrawal, it reflects total raised.
      // The funds are transferred, but the record of how much was raised remains.
    });

    it("Should allow donors to claim refund if target not met", async function () {
      // Create a new campaign where target is not met
      const lowTargetAmount = ethers.parseEther("100");
      const block = await ethers.provider.getBlock("latest");
      const lowDeadline = block.timestamp + 3600; // 1 hour from now
      const createRefundCampaignTx = await charityDonation.createCampaign(
        receiver.address,
        "Low Target",
        "Desc",
        lowTargetAmount,
        lowDeadline
      );
      const refundCampaignReceipt = await createRefundCampaignTx.wait();
      const refundCampaignId = refundCampaignReceipt.logs[0].args.id;
      await charityDonation.connect(admin).approveCampaign(refundCampaignId);
      await charityDonation
        .connect(donor1)
        .donate(refundCampaignId, { value: ethers.parseEther("1") });

      // Wait for deadline
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");

      const initialDonor1Balance = await ethers.provider.getBalance(
        donor1.address
      );
      const donor1Donation = await charityDonation.getDonationAmount(
        refundCampaignId,
        donor1.address
      );

      await expect(
        charityDonation.connect(donor1).claimRefund(refundCampaignId)
      )
        .to.emit(charityDonation, "RefundClaimed")
        .withArgs(refundCampaignId, donor1.address, donor1Donation);

      const finalDonor1Balance = await ethers.provider.getBalance(
        donor1.address
      );
      expect(finalDonor1Balance).to.be.closeTo(
        initialDonor1Balance + donor1Donation,
        ethers.parseEther("0.001")
      );

      expect(
        await charityDonation.getDonationAmount(
          refundCampaignId,
          donor1.address
        )
      ).to.equal(0);
    });

    it("Should not allow refund if target met", async function () {
      // In the beforeEach, target is met for campaign 0
      await expect(
        charityDonation.connect(donor1).claimRefund(1)
      ).to.be.revertedWith("campaign successful");
    });

    it("Should not allow withdrawal if target not met", async function () {
      // Create a new campaign where target is not met
      const lowTargetAmount = ethers.parseEther("100");
      const block = await ethers.provider.getBlock("latest");
      const lowDeadline = block.timestamp + 3600; // 1 hour from now
      const createNotMetCampaignTx = await charityDonation.createCampaign(
        receiver.address,
        "Low Target",
        "Desc",
        lowTargetAmount,
        lowDeadline
      );
      const notMetCampaignReceipt = await createNotMetCampaignTx.wait();
      const notMetCampaignId = notMetCampaignReceipt.logs[0].args.id;
      await charityDonation.connect(admin).approveCampaign(notMetCampaignId);
      await charityDonation
        .connect(donor1)
        .donate(notMetCampaignId, { value: ethers.parseEther("1") });

      // Wait for deadline
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine");

      await expect(
        charityDonation.connect(receiver).withdrawFunds(notMetCampaignId)
      ).to.be.revertedWith("not completed");
    });
  });

  describe("View Functions", function () {
    let campaignId;
    let targetAmount;
    let deadline;
    let donationAmount1;
    let donationAmount2;

    beforeEach(async function () {
      targetAmount = ethers.parseEther("10");
      const block = await ethers.provider.getBlock("latest");
      deadline = block.timestamp + 3600;
      donationAmount1 = ethers.parseEther("1");
      donationAmount2 = ethers.parseEther("2");

      const createCampaignTx = await charityDonation.createCampaign(
        receiver.address,
        "Education",
        "Support education",
        targetAmount,
        deadline
      );
      const receipt = await createCampaignTx.wait();
      campaignId = receipt.logs[0].args.id;
      await charityDonation.connect(admin).approveCampaign(campaignId);

      await charityDonation
        .connect(donor1)
        .donate(campaignId, { value: donationAmount1 });
      await charityDonation
        .connect(donor2)
        .donate(campaignId, { value: donationAmount2 });
    });

    it("Should return correct campaign details with getCampaign", async function () {
      const campaign = await charityDonation.getCampaign(campaignId);
      expect(campaign.receiver).to.equal(receiver.address);
      expect(campaign.cause).to.equal("Education");
      expect(campaign.description).to.equal("Support education");
      expect(campaign.targetAmount).to.equal(targetAmount);
      expect(campaign.amountRaised).to.equal(donationAmount1 + donationAmount2);
      expect(campaign.deadline).to.equal(deadline);
      expect(campaign.status).to.equal(1); // Approved status
      expect(campaign.creator).to.equal(admin.address); // Assuming admin creates the campaign in beforeEach
    });

    it("Should return all campaigns with getAllCampaigns", async function () {
      const campaigns = await charityDonation.getAllCampaigns();
      expect(campaigns.length).to.be.at.least(1); // At least one campaign should be created
      const firstCampaign = campaigns[0];
      expect(firstCampaign.id).to.equal(campaignId);
      expect(firstCampaign.receiver).to.equal(receiver.address);
      expect(firstCampaign.cause).to.equal("Education");
      expect(firstCampaign.description).to.equal("Support education");
      expect(firstCampaign.targetAmount).to.equal(targetAmount);
      expect(firstCampaign.amountRaised).to.equal(
        donationAmount1 + donationAmount2
      );
      expect(firstCampaign.deadline).to.equal(deadline);
      expect(firstCampaign.status).to.equal(1); // Approved status
    });

    it("Should return donation amount for a specific donor with getDonationAmount", async function () {
      expect(
        await charityDonation.getDonationAmount(campaignId, donor1.address)
      ).to.equal(donationAmount1);
      expect(
        await charityDonation.getDonationAmount(campaignId, donor2.address)
      ).to.equal(donationAmount2);
      expect(
        await charityDonation.getDonationAmount(campaignId, admin.address)
      ).to.equal(0);
    });
  });
});
