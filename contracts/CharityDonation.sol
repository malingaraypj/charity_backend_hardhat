// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CharityDonation {
    /* ========== EVENTS ========== */
    event CampaignCreated(uint256 indexed id, address indexed receiver, string cause, uint256 targetAmount, uint256 deadline);
    event CampaignApproved(uint256 indexed id);
    event CampaignBlocked(uint256 indexed id);
    event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event FundsWithdrawn(uint256 indexed campaignId, address indexed receiver, uint256 amount);
    event RefundClaimed(uint256 indexed campaignId, address indexed donor, uint256 amount);

    /* ========== ENUM ========== */
    enum CampaignStatus { Pending, Approved, Blocked, Completed, Failed }

    /* ========== STRUCTS & STATE ========== */
    struct Campaign {
        uint256 id;
        address payable receiver;
        string cause;
        string description;
        uint256 targetAmount;
        uint256 deadline;
        uint256 amountRaised;
        bool fundsWithdrawn;
        address creator;
        CampaignStatus status;
    }

    struct Donation {
        address donor;
        uint256 amount;
        uint256 timestamp;
    }

    address public admin;
    uint256 private nextCampaignId;

    function getNextCampaignId() public view returns (uint256) {
        return nextCampaignId;
    }
    
    // Changed from array to mapping for gas efficiency
    mapping(uint256 => Campaign) private campaigns;
    uint256[] private campaignIds;

    mapping(uint256 => Donation[]) private donationsByCampaign;
    mapping(uint256 => mapping(address => uint256)) private donatedAmount;
    mapping(uint256 => mapping(address => bool)) private refundClaimed;

    // Reentrancy guard - using uint256 instead of bool for better practice
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    /* ========== MODIFIERS ========== */
    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    modifier validCampaignId(uint256 _campaignId) {
        require(_campaignId > 0 && _campaignId < nextCampaignId, "invalid campaign");
        _;
    }

    constructor(address _admin) {
        admin = _admin == address(0) ? msg.sender : _admin;
        nextCampaignId = 1;
        _status = _NOT_ENTERED;
    }

    /* ========== CAMPAIGN MANAGEMENT ========== */
    function createCampaign(
        address payable _receiver,
        string calldata _cause,
        string calldata _description,
        uint256 _targetAmount,
        uint256 _deadline
    ) external returns (uint256) {
        require(_receiver != address(0), "invalid receiver");
        require(_targetAmount > 0, "target must be > 0");
        require(_deadline > block.timestamp, "deadline must be in future");

        uint256 campaignId = nextCampaignId++;

        campaigns[campaignId] = Campaign({
            id: campaignId,
            receiver: _receiver,
            cause: _cause,
            description: _description,
            targetAmount: _targetAmount,
            deadline: _deadline,
            amountRaised: 0,
            fundsWithdrawn: false,
            creator: msg.sender,
            status: CampaignStatus.Pending
        });
        
        campaignIds.push(campaignId);

        emit CampaignCreated(campaignId, _receiver, _cause, _targetAmount, _deadline);
        return campaignId;
    }

    function approveCampaign(uint256 _campaignId) external onlyAdmin validCampaignId(_campaignId) {
        Campaign storage c = campaigns[_campaignId];
        require(c.status == CampaignStatus.Pending, "not pending");
        c.status = CampaignStatus.Approved;
        emit CampaignApproved(_campaignId);
    }

    function blockCampaign(uint256 _campaignId) external onlyAdmin validCampaignId(_campaignId) {
        Campaign storage c = campaigns[_campaignId];
        require(c.status == CampaignStatus.Pending || c.status == CampaignStatus.Approved, "cannot block");
        c.status = CampaignStatus.Blocked;
        emit CampaignBlocked(_campaignId);
    }

    /* ========== DONATIONS ========== */
    function donate(uint256 _campaignId) external payable nonReentrant validCampaignId(_campaignId) {
        require(msg.value > 0, "donation must be > 0");
        Campaign storage c = campaigns[_campaignId];
        require(c.status == CampaignStatus.Approved, "campaign not approved");
        require(block.timestamp <= c.deadline, "campaign ended");

        donationsByCampaign[_campaignId].push(Donation({ donor: msg.sender, amount: msg.value, timestamp: block.timestamp }));
        donatedAmount[_campaignId][msg.sender] += msg.value;
        c.amountRaised += msg.value;

        // Update status only when target is reached
        if (c.amountRaised >= c.targetAmount && c.status != CampaignStatus.Completed) {
            c.status = CampaignStatus.Completed;
        }

        emit DonationReceived(_campaignId, msg.sender, msg.value);
    }

    /* ========== WITHDRAWALS & REFUNDS ========== */
    function withdrawFunds(uint256 _campaignId) external nonReentrant validCampaignId(_campaignId) {
        Campaign storage c = campaigns[_campaignId];
        require(msg.sender == c.receiver, "only receiver");
        require(!c.fundsWithdrawn, "already withdrawn");
        require(c.status == CampaignStatus.Completed, "not completed");

        uint256 amount = c.amountRaised;
        c.fundsWithdrawn = true;

        (bool ok, ) = c.receiver.call{ value: amount }("");
        require(ok, "transfer failed");

        emit FundsWithdrawn(_campaignId, c.receiver, amount);
    }

    function claimRefund(uint256 _campaignId) external nonReentrant validCampaignId(_campaignId) {
        Campaign storage c = campaigns[_campaignId];
        require(block.timestamp > c.deadline, "still active");
        require(c.amountRaised < c.targetAmount, "campaign successful");
        require(c.status != CampaignStatus.Blocked, "blocked campaigns don't refund");

        uint256 donated = donatedAmount[_campaignId][msg.sender];
        require(donated > 0, "no donation");
        require(!refundClaimed[_campaignId][msg.sender], "already claimed");

        refundClaimed[_campaignId][msg.sender] = true;
        donatedAmount[_campaignId][msg.sender] = 0;

        (bool ok, ) = msg.sender.call{ value: donated }("");
        require(ok, "refund failed");

        // Only set to failed if not already set
        if (c.status != CampaignStatus.Failed) {
            c.status = CampaignStatus.Failed;
        }

        emit RefundClaimed(_campaignId, msg.sender, donated);
    }

    /* ========== VIEWS ========== */
    function getAllCampaigns() external view returns (Campaign[] memory) {
        uint256 count = campaignIds.length;
        Campaign[] memory result = new Campaign[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = campaigns[campaignIds[i]];
        }
        return result;
    }

    // FIXED: Renamed parameter to avoid shadowing the _status state variable
    function getCampaignsByStatus(CampaignStatus statusFilter) public view returns (Campaign[] memory) {
        uint256 count;
        for (uint256 i = 0; i < campaignIds.length; i++) {
            if (campaigns[campaignIds[i]].status == statusFilter) count++;
        }
        
        Campaign[] memory result = new Campaign[](count);
        uint256 index;
        for (uint256 i = 0; i < campaignIds.length; i++) {
            uint256 campaignId = campaignIds[i];
            if (campaigns[campaignId].status == statusFilter) {
                result[index] = campaigns[campaignId];
                index++;
            }
        }
        return result;
    }

    function getCampaign(uint256 _campaignId) external view validCampaignId(_campaignId) returns (Campaign memory) {
        return campaigns[_campaignId];
    }

    function getActiveCampaigns() external view returns (Campaign[] memory) {
        return getCampaignsByStatus(CampaignStatus.Approved);
    }

    function getCompletedCampaigns() external view returns (Campaign[] memory) {
        return getCampaignsByStatus(CampaignStatus.Completed);
    }

    function getFailedCampaigns() external view returns (Campaign[] memory) {
        return getCampaignsByStatus(CampaignStatus.Failed);
    }

    function getDonations(uint256 _campaignId) external view validCampaignId(_campaignId) returns (Donation[] memory) {
        return donationsByCampaign[_campaignId];
    }

    function getDonationAmount(uint256 _campaignId, address _donor) external view validCampaignId(_campaignId) returns (uint256) {
        return donatedAmount[_campaignId][_donor];
    }
}