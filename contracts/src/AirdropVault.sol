// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ============ Custom Errors (Gas Optimization) ============
error AlreadyClaimed();
error InsufficientLockedBalance();
error InsufficientPoolBalance();
error NotAuthorizedSpender();
error InvalidAddress();
error InvalidAmount();

/**
 * @title AirdropVault
 * @notice Manages locked DGNE distribution for initial player access.
 * @dev Players can claim once. Locked balance can only be spent via authorized game contracts.
 *      When locked balance is spent:
 *        - 3,500/5,100 (~68.6%) is recycled back to the airdrop pool
 *        - 1,600/5,100 (~31.4%) is sent to the WinBoost wallet for enhanced battle rewards
 */
contract AirdropVault is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    
    /// @notice Amount of DGNE given per claim (5,100 DGNE)
    uint256 public constant CLAIM_AMOUNT = 5100 ether;
    
    /// @notice Recycling ratio numerator (3,500 out of 5,100)
    uint256 public constant RECYCLE_NUMERATOR = 3500;
    
    /// @notice WinBoost ratio numerator (1,600 out of 5,100)
    uint256 public constant WINBOOST_NUMERATOR = 1600;
    
    /// @notice Ratio denominator (5,100)
    uint256 public constant RATIO_DENOMINATOR = 5100;
    
    // ============ State Variables ============
    
    /// @notice The DGNE token contract
    IERC20 public immutable dgneToken;
    
    /// @notice Wallet that receives WinBoost portion for enhanced battle rewards
    address public winBoostWallet;
    
    /// @notice Locked balance per user (non-transferable, spendable only via authorized contracts)
    mapping(address => uint256) public lockedBalance;
    
    /// @notice Tracks whether an address has already claimed
    mapping(address => bool) public hasClaimed;
    
    /// @notice Contracts authorized to spend locked balance (MintGate, BattleGate, HPManager)
    mapping(address => bool) public authorizedSpenders;
    
    /// @notice Total locked balance distributed (for stats)
    uint256 public totalDistributed;
    
    /// @notice Total recycled back to pool (for stats)
    uint256 public totalRecycled;
    
    /// @notice Total sent to WinBoost wallet (for stats)
    uint256 public totalToWinBoost;
    
    /// @notice Number of unique claimers
    uint256 public claimerCount;
    
    // ============ Events ============
    
    event Claimed(address indexed user, uint256 amount);
    event LockedBalanceSpent(address indexed user, uint256 amount, uint256 recycled, uint256 toWinBoost);
    event LockedBalanceRestored(address indexed user, uint256 amount);
    event LockedBalanceFinalized(uint256 amount, uint256 recycled, uint256 toWinBoost);
    event AuthorizedSpenderSet(address indexed spender, bool authorized);
    event WinBoostWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event PoolFunded(address indexed funder, uint256 amount);
    
    // ============ Constructor ============
    
    /**
     * @notice Initialize the AirdropVault
     * @param _dgneToken Address of the DGNE token contract
     * @param _winBoostWallet Address that receives WinBoost portion
     */
    constructor(
        address _dgneToken,
        address _winBoostWallet
    ) Ownable(msg.sender) {
        if (_dgneToken == address(0)) revert InvalidAddress();
        if (_winBoostWallet == address(0)) revert InvalidAddress();
        
        dgneToken = IERC20(_dgneToken);
        winBoostWallet = _winBoostWallet;
    }
    
    // ============ Modifiers ============
    
    modifier onlyAuthorizedSpender() {
        if (!authorizedSpenders[msg.sender]) revert NotAuthorizedSpender();
        _;
    }
    
    // ============ Public Functions ============
    
    /**
     * @notice Claim airdrop DGNE (once per wallet)
     * @dev Gives 5,100 DGNE as locked balance. Can only be called once per address.
     */
    function claim() external nonReentrant whenNotPaused {
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();
        
        // Check pool has enough balance
        uint256 poolBalance = dgneToken.balanceOf(address(this));
        if (poolBalance < CLAIM_AMOUNT) revert InsufficientPoolBalance();
        
        // Mark as claimed and credit locked balance
        hasClaimed[msg.sender] = true;
        lockedBalance[msg.sender] = CLAIM_AMOUNT;
        
        // Update stats
        totalDistributed += CLAIM_AMOUNT;
        claimerCount++;
        
        emit Claimed(msg.sender, CLAIM_AMOUNT);
    }
    
    /**
     * @notice Spend locked balance on behalf of user (called by BattleGate for pending battles)
     * @param user Address whose locked balance to spend
     * @param amount Amount to spend
     * @return spent Actual amount spent from locked balance
     * @dev Does NOT transfer to WinBoost yet - that happens in finalizeLockedSpend
     *      This allows for full refunds if battle is cancelled
     */
    function spendLockedBalance(
        address user, 
        uint256 amount
    ) external nonReentrant onlyAuthorizedSpender returns (uint256 spent) {
        if (amount == 0) revert InvalidAmount();
        
        uint256 userBalance = lockedBalance[user];
        if (userBalance == 0) return 0;
        
        // Spend up to available balance
        spent = amount > userBalance ? userBalance : amount;
        lockedBalance[user] -= spent;
        
        // Just track it - don't split yet (allows full refund on cancel)
        // The tokens stay in the vault until battle completion
        
        emit LockedBalanceSpent(user, spent, 0, 0);
    }
    
    /**
     * @notice Finalize locked balance spend after battle completion
     * @param amount Amount to finalize (split between recycle and WinBoost)
     * @dev Called by BattleGate when battle completes (winner determined)
     *      NOW we do the 68.6%/31.4% split
     */
    function finalizeLockedSpend(
        uint256 amount
    ) external nonReentrant onlyAuthorizedSpender {
        if (amount == 0) return;
        
        // Calculate recycling split
        uint256 toRecycle = (amount * RECYCLE_NUMERATOR) / RATIO_DENOMINATOR;
        uint256 toWinBoost = amount - toRecycle;
        
        // WinBoost portion: transfer real DGNE to WinBoost wallet
        if (toWinBoost > 0) {
            dgneToken.safeTransfer(winBoostWallet, toWinBoost);
            totalToWinBoost += toWinBoost;
        }
        
        // Recycle portion stays in contract
        totalRecycled += toRecycle;
        
        emit LockedBalanceFinalized(amount, toRecycle, toWinBoost);
    }
    
    /**
     * @notice Restore locked balance for battle cancellations/refunds (100% refund)
     * @param user Address to restore balance to
     * @param amount Full amount to restore
     * @dev Only authorized spenders can call this (BattleGate)
     */
    function restoreLockedBalance(
        address user, 
        uint256 amount
    ) external nonReentrant onlyAuthorizedSpender {
        if (amount == 0) revert InvalidAmount();
        if (user == address(0)) revert InvalidAddress();
        
        // Restore the FULL locked balance (100% refund)
        lockedBalance[user] += amount;
        
        emit LockedBalanceRestored(user, amount);
    }
    
    /**
     * @notice Check how much locked balance a user has
     * @param user Address to check
     * @return balance Locked balance amount
     */
    function getLockedBalance(address user) external view returns (uint256 balance) {
        return lockedBalance[user];
    }
    
    /**
     * @notice Check if user has already claimed
     * @param user Address to check
     * @return claimed Whether user has claimed
     */
    function hasUserClaimed(address user) external view returns (bool claimed) {
        return hasClaimed[user];
    }
    
    /**
     * @notice Get available pool balance for new claims
     * @return available DGNE tokens available in the vault
     */
    function getPoolBalance() external view returns (uint256 available) {
        return dgneToken.balanceOf(address(this));
    }
    
    /**
     * @notice Get vault statistics
     * @return distributed Total DGNE distributed as locked balance
     * @return recycled Total DGNE recycled back to pool
     * @return sentToWinBoost Total DGNE sent to WinBoost wallet
     * @return claimers Number of unique addresses that have claimed
     * @return poolBalance Current pool balance available for claims
     */
    function getStats() external view returns (
        uint256 distributed,
        uint256 recycled,
        uint256 sentToWinBoost,
        uint256 claimers,
        uint256 poolBalance
    ) {
        return (
            totalDistributed,
            totalRecycled,
            totalToWinBoost,
            claimerCount,
            dgneToken.balanceOf(address(this))
        );
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set authorized spender status (MintGate, BattleGate, HPManager)
     * @param spender Address to authorize/deauthorize
     * @param authorized Whether address can spend locked balances
     */
    function setAuthorizedSpender(address spender, bool authorized) external onlyOwner {
        if (spender == address(0)) revert InvalidAddress();
        authorizedSpenders[spender] = authorized;
        emit AuthorizedSpenderSet(spender, authorized);
    }
    
    /**
     * @notice Update WinBoost wallet address
     * @param _winBoostWallet New WinBoost wallet address
     */
    function setWinBoostWallet(address _winBoostWallet) external onlyOwner {
        if (_winBoostWallet == address(0)) revert InvalidAddress();
        address oldWallet = winBoostWallet;
        winBoostWallet = _winBoostWallet;
        emit WinBoostWalletUpdated(oldWallet, _winBoostWallet);
    }
    
    /**
     * @notice Fund the airdrop pool with DGNE tokens
     * @param amount Amount of DGNE to deposit
     * @dev Caller must have approved this contract to spend their DGNE
     */
    function fundPool(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        dgneToken.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(msg.sender, amount);
    }
    
    /// @notice Pause claiming for emergency
    function pause() external onlyOwner {
        _pause();
    }
    
    /// @notice Resume claiming
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency withdraw (only owner, only when paused)
     * @param to Address to send tokens to
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner whenPaused {
        if (to == address(0)) revert InvalidAddress();
        dgneToken.safeTransfer(to, amount);
    }
}
