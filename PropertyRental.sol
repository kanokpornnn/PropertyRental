// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PropertyRental {
    address public admin;
    uint256 public propertyCount;
    uint256 public agreementCount;

    bool private locked;

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Admin only");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    // 1. Register Property
    struct Property {
        uint256 id;
        address owner;
        string name;
        uint256 rent;
        uint256 deposit;
    }

    mapping(uint256 => Property) public properties;

    function registerProperty(
        string memory _name,
        uint256 _rent,
        uint256 _deposit
    ) public {
        require(bytes(_name).length > 0, "Name required");
        require(_rent > 0, "Invalid rent");
        require(_deposit > 0, "Invalid deposit");

        propertyCount++;

        properties[propertyCount] = Property(
            propertyCount,
            msg.sender,
            _name,
            _rent,
            _deposit
        );
    }

    // 2. Rental Agreement
    struct Agreement {
        uint256 id;
        uint256 propertyId;
        address tenant;
        uint256 startDate;
        uint256 endDate;
        bool confirmed;
        bool deposited;
        bool refunded;
        bool disputed;
        bool resolved;
        uint256 depositAmount;
        uint256 rentPaid;
        uint256 refundAmount;
        uint256 ownerAmount;
    }

    mapping(uint256 => Agreement) public agreements;

    function createAgreement(
        uint256 _propertyId,
        address _tenant,
        uint256 _startDate,
        uint256 _endDate
    ) public {
        Property storage p = properties[_propertyId];

        require(p.owner == msg.sender, "Not property owner");
        require(_tenant != address(0), "Invalid tenant");
        require(_tenant != msg.sender, "Owner cannot be tenant");
        require(_endDate > _startDate, "Invalid dates");
        require(_endDate > block.timestamp, "End date passed");

        agreementCount++;

        Agreement storage a = agreements[agreementCount];

        a.id = agreementCount;
        a.propertyId = _propertyId;
        a.tenant = _tenant;
        a.startDate = _startDate;
        a.endDate = _endDate;
        a.depositAmount = p.deposit;
    }

    // 3. Confirm Agreement
    function confirmAgreement(uint256 _id) public {
        Agreement storage a = agreements[_id];

        require(a.id != 0, "Agreement not found");
        require(msg.sender == a.tenant, "Tenant only");
        require(!a.confirmed, "Already confirmed");

        a.confirmed = true;
    }

    // 4. Deposit Security
    function depositSecurity(uint256 _id) public payable {
        Agreement storage a = agreements[_id];

        require(a.id != 0, "Agreement not found");
        require(msg.sender == a.tenant, "Tenant only");
        require(a.confirmed, "Confirm first");
        require(!a.deposited, "Already deposited");
        require(block.timestamp < a.endDate, "Agreement ended");
        require(msg.value == a.depositAmount, "Wrong deposit");

        a.deposited = true;
    }

    // 5. Record Rental Payment
    function recordRentalPayment(
        uint256 _id
    ) public payable nonReentrant {
        Agreement storage a = agreements[_id];

        require(a.id != 0, "Agreement not found");
        require(msg.sender == a.tenant, "Tenant only");
        require(a.deposited, "Deposit first");
        require(block.timestamp >= a.startDate, "Not started");
        require(block.timestamp <= a.endDate, "Agreement ended");

        Property storage p = properties[a.propertyId];

        require(msg.value == p.rent, "Wrong rent");

        a.rentPaid += msg.value;

        (bool success, ) = payable(p.owner).call{
            value: msg.value
        }("");

        require(success, "Rent transfer failed");
    }

    // 6. Refund Deposit
    function refundDeposit(
        uint256 _id
    ) public nonReentrant {
        Agreement storage a = agreements[_id];

        require(a.id != 0, "Agreement not found");
        require(a.deposited, "No deposit");
        require(!a.refunded, "Already refunded");
        require(!a.disputed, "Dispute pending");
        require(block.timestamp >= a.endDate, "Not ended");

        Property storage p = properties[a.propertyId];

        require(msg.sender == p.owner, "Owner only");

        a.refunded = true;

        (bool success, ) = payable(a.tenant).call{
            value: a.depositAmount
        }("");

        require(success, "Refund failed");
    }

    // 7. Raise Dispute
    function raiseDispute(uint256 _id) public {
        Agreement storage a = agreements[_id];

        require(a.id != 0, "Agreement not found");
        require(a.deposited, "No deposit");
        require(!a.refunded, "Already refunded");
        require(!a.disputed, "Already disputed");

        Property storage p = properties[a.propertyId];

        require(
            msg.sender == a.tenant || msg.sender == p.owner,
            "Not authorized"
        );

        a.disputed = true;
    }

    // 7. Resolve Dispute
    function resolveDispute(
        uint256 _id,
        uint256 _tenantAmount,
        uint256 _ownerAmount
    ) public onlyAdmin nonReentrant {
        Agreement storage a = agreements[_id];

        require(a.id != 0, "Agreement not found");
        require(a.disputed, "No dispute");
        require(!a.refunded, "Already refunded");

        require(
            _tenantAmount + _ownerAmount == a.depositAmount,
            "Invalid split"
        );

        a.refunded = true;
        a.disputed = false;
        a.resolved = true;

        a.refundAmount = _tenantAmount;
        a.ownerAmount = _ownerAmount;

        Property storage p = properties[a.propertyId];

        if (_tenantAmount > 0) {
            (bool okTenant, ) = payable(a.tenant).call{
                value: _tenantAmount
            }("");

            require(okTenant, "Tenant transfer failed");
        }

        if (_ownerAmount > 0) {
            (bool okOwner, ) = payable(p.owner).call{
                value: _ownerAmount
            }("");

            require(okOwner, "Owner transfer failed");
        }
    }
}
