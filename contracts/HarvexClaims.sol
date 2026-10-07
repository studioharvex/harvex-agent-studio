// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HarvexClaims - cumulative merkle claims for Harvex creator earnings (and, later, holder rewards)
/// @notice DRAFT. Not audited, not deployed. Do not send funds to any address claiming to be this contract.
/// @dev One instance per payout token (USDT for creator earnings; a separate instance could pay
///      another token as a holder reward if that token's issuer allows this contract and the recipients).
///      The owner (a multisig) posts a root over leaves
///        keccak256(bytes.concat(keccak256(abi.encode(account, cumulativeAmount))))
///      where cumulativeAmount is everything ever owed to `account`. A claim pays the difference
///      between that and what the account already received, so a new root never double-pays and an
///      old proof can never pay more than once. Anyone may submit a claim, funds only go to `account`.
///      Hourly holder rewards: the owner may name a `rootPoster` (an automated key) that can ONLY post roots. Because a
///      root decides who may claim, a payout limit bounds what can leave per window: a claim larger than what is left
///      in the window is paid in part and the rest stays claimable later. A leaked poster key can therefore drain at
///      most `maxPayoutPerWindow` per window until the owner pauses the vault or replaces the poster.
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

contract HarvexClaims {
    IERC20 public immutable token;
    address public owner;
    address public pendingOwner;
    bytes32 public merkleRoot;
    bool public paused;
    mapping(address => uint256) public claimed;
    address public rootPoster;          // may post roots, nothing else; zero = only the owner posts
    uint256 public maxPayoutPerWindow;  // 0 = no payout limit
    uint256 public windowSeconds;
    uint256 public windowStart;
    uint256 public windowPaid;

    event RootUpdated(bytes32 indexed root, bytes32 indexed previous);
    event Claimed(address indexed account, uint256 amount, uint256 cumulativeAmount);
    event Paused(bool paused);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);
    event Withdrawn(address indexed to, uint256 amount);
    event RootPosterSet(address indexed previous, address indexed next);
    event PayoutLimitSet(uint256 maxPayoutPerWindow, uint256 windowSeconds);

    error NotOwner();
    error IsPaused();
    error InvalidProof();
    error NothingToClaim();
    error TransferFailed();
    error ZeroAddress();
    error NotAuthorized();
    error PayoutLimitReached();
    error InvalidLimit();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IERC20 token_, address owner_) {
        if (address(token_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        token = token_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    /// @notice Pays `account` what its latest cumulative amount allows, within the window's payout limit.
    ///         Claimed carries the amount paid now and the account's new claimed total.
    function claim(address account, uint256 cumulativeAmount, bytes32[] calldata proof) external {
        if (paused) revert IsPaused();
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(account, cumulativeAmount))));
        if (!_verify(proof, merkleRoot, leaf)) revert InvalidProof();
        uint256 already = claimed[account];
        if (cumulativeAmount <= already) revert NothingToClaim();
        uint256 amount = cumulativeAmount - already;
        if (maxPayoutPerWindow != 0) {
            if (block.timestamp >= windowStart + windowSeconds) {
                windowStart = block.timestamp;
                windowPaid = 0;
            }
            uint256 room = maxPayoutPerWindow - windowPaid;
            if (room == 0) revert PayoutLimitReached();
            if (amount > room) amount = room; // paid in part; the rest stays claimable
            windowPaid += amount;
        }
        uint256 total = already + amount;
        claimed[account] = total; // effects before the external call
        _safeTransfer(account, amount);
        emit Claimed(account, amount, total);
    }

    /// @notice The owner or the root poster replaces the root (each root includes everything owed so far).
    function setMerkleRoot(bytes32 root) external {
        if (msg.sender != owner && msg.sender != rootPoster) revert NotAuthorized();
        emit RootUpdated(root, merkleRoot);
        merkleRoot = root;
    }

    /// @notice Names (or removes, with zero) the automated key that may post roots.
    function setRootPoster(address next) external onlyOwner {
        emit RootPosterSet(rootPoster, next);
        rootPoster = next;
    }

    /// @notice Caps what all claims together may pay per window (0 removes the cap). Withdrawals by the owner are not capped.
    function setPayoutLimit(uint256 maxPayout, uint256 seconds_) external onlyOwner {
        if (maxPayout != 0 && seconds_ == 0) revert InvalidLimit();
        maxPayoutPerWindow = maxPayout;
        windowSeconds = seconds_;
        windowStart = block.timestamp;
        windowPaid = 0;
        emit PayoutLimitSet(maxPayout, seconds_);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit Paused(value);
    }

    /// @notice Returns unclaimed funds to the treasury (for example when the program ends).
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        _safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    function transferOwnership(address next) external onlyOwner {
        pendingOwner = next;
        emit OwnershipTransferStarted(owner, next);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    /// @dev OpenZeppelin-compatible MerkleProof.verify with sorted pairs.
    function _verify(bytes32[] calldata proof, bytes32 root, bytes32 leaf) private pure returns (bool) {
        bytes32 h = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            h = h < p ? keccak256(abi.encodePacked(h, p)) : keccak256(abi.encodePacked(p, h));
        }
        return h == root;
    }

    /// @dev Works with tokens that return nothing as well as tokens that return a bool.
    function _safeTransfer(address to, uint256 amount) private {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
