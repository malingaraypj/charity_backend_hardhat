const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleStorage", function () {
  let SimpleStorage;
  let simpleStorage;
  let owner;
  let addr1;

  beforeEach(async function () {
    // Get the ContractFactory and Signers
    SimpleStorage = await ethers.getContractFactory("SimpleStorage");
    [owner, addr1] = await ethers.getSigners();

    // Deploy the contract
    simpleStorage = await SimpleStorage.deploy();
    await simpleStorage.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the initial value to 0", async function () {
      expect(await simpleStorage.get()).to.equal(0);
    });
  });

  describe("Storage Operations", function () {
    it("Should store and retrieve a value", async function () {
      const testValue = 42;
      await simpleStorage.set(testValue);
      expect(await simpleStorage.get()).to.equal(testValue);
    });

    it("Should increment the stored value", async function () {
      await simpleStorage.set(10);
      await simpleStorage.increment();
      expect(await simpleStorage.get()).to.equal(11);
    });

    it("Should decrement the stored value", async function () {
      await simpleStorage.set(10);
      await simpleStorage.decrement();
      expect(await simpleStorage.get()).to.equal(9);
    });

    it("Should not allow decrementing below zero", async function () {
      await expect(simpleStorage.decrement()).to.be.revertedWith("Cannot decrement below zero");
    });

    it("Should emit DataStored event when setting value", async function () {
      const testValue = 100;
      await expect(simpleStorage.set(testValue))
        .to.emit(simpleStorage, "DataStored")
        .withArgs(testValue, owner.address);
    });
  });
});