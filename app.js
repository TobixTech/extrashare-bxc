// app.js

// Ensure Web3.js is available
if (typeof window.Web3 === 'undefined') {
    console.error("Web3.js is not loaded. Please ensure the CDN link is correct in your HTML.");
    // For a production app, you might disable buttons or show a prominent error message here
}

// --- Global Variables and Constants ---
const BSC_CHAIN_ID = '0x38'; // Chain ID for BNB Smart Chain (56 in decimal)
const AIN_USD_PRICE = 0.137; // Current price of AIN in USD for calculation
const BXC_ACCRUAL_PER_SECOND = 0.001;
const EVENT_DURATION_SECONDS = 95 * 60 * 60; // 95 hours in seconds

let web3; // Will hold the Web3 instance
let selectedAccount = null;
let participantsTotalSlots = 30000;
let eventEndTime = null; // Will store the timestamp when the event ends
let bxcAccrualInterval = null; // To hold the interval for BXC accrual

// Backend URL (Crucial: ENSURE THIS EXACTLY MATCHES YOUR DEPLOYED BACKEND URL)
const BACKEND_URL = 'https://bxc-backend-1dkpqw.fly.dev'; // EXAMPLE: Replace with your actual deployed backend URL

// --- DOM Element References ---
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletModal = document.getElementById('walletModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const walletOptions = document.querySelectorAll('.wallet-option');
const walletStatus = document.getElementById('walletStatus');

// Dashboard Elements
const eventTimerDisplay = document.getElementById('eventTimer');
const participantsCountDisplay = document.getElementById('participantsCount');
const participantsPercentageDisplay = document.getElementById('participantsPercentage');
const participantsProgressBar = document.getElementById('participantsProgressBar');
const currentStakeValueDisplay = document.getElementById('currentStakeValue');
const stakeBtn = document.getElementById('stakeBtn');
const withdrawStakeBtn = document.getElementById('withdrawStakeBtn');
const stakeStatus = document.getElementById('stakeStatus');

const bxcBalanceDisplay = document.getElementById('bxcBalance');
const withdrawBxcBtn = document.getElementById('withdrawBxcBtn');
const bxcWithdrawStatus = document.getElementById('bxcWithdrawStatus');

const rewardFlipCard = document.getElementById('rewardFlipCard');
const flipRewardBtn = document.getElementById('flipRewardBtn');
const revealedRewardAmountDisplay = document.getElementById('revealedRewardAmount');
const collectRewardBtn = document.getElementById('collectRewardBtn');
const rewardStatus = document.getElementById('rewardStatus');

const partneredCoinEarnedDisplay = document.getElementById('partneredCoinEarned');
const withdrawPartneredCoinBtn = document.getElementById('withdrawPartneredCoinBtn');
const partneredCoinStatus = document.getElementById('partneredCoinStatus');

const referralCodeDisplay = document.getElementById('referralCodeDisplay');
const copyReferralCodeBtn = document.getElementById('copyReferralCodeBtn');
const referralLinkDisplay = document.getElementById('referralLinkDisplay');
const copyReferralLinkBtn = document.getElementById('copyReferralLinkBtn');
const shareReferralLinkBtn = document.getElementById('shareReferralLinkBtn');


// --- Utility Functions ---

function updateStatusMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.remove('hidden', 'text-green-500', 'text-red-500');
    element.classList.add(isError ? 'text-red-500' : 'text-green-500');
    console.log(`Status update for ${element.id || 'unknown'}: ${message}`); // Keep console log for debugging
}

function formatTime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d.toString().padStart(2, '0')}:${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// --- UI Update Functions ---

function updateParticipantsUI(stakedSlots) {
    const percentage = (stakedSlots / participantsTotalSlots) * 100;
    participantsCountDisplay.textContent = `${stakedSlots}/${participantsTotalSlots}`;
    participantsPercentageDisplay.textContent = `${percentage.toFixed(2)}%`;
    participantsProgressBar.style.width = `${percentage}%`;
}

function startEventTimer(endTimeTimestamp) {
    eventEndTime = new Date(endTimeTimestamp).getTime();
    
    // Clear any existing timer to prevent multiple intervals
    if (window.eventTimerInterval) {
        clearInterval(window.eventTimerInterval);
    }

    window.eventTimerInterval = setInterval(() => {
        const now = new Date().getTime();
        const timeLeft = eventEndTime - now;

        if (timeLeft <= 0) {
            clearInterval(window.eventTimerInterval);
            eventTimerDisplay.textContent = "00:00:00:00";
            console.log("Event has ended.");
            // Disable staking and enable reward revealing after event ends
            stakeBtn.disabled = true;
            // Additional logic if event ends
            return;
        }

        const secondsLeft = Math.floor(timeLeft / 1000);
        eventTimerDisplay.textContent = formatTime(secondsLeft);
    }, 1000);
}

function updateDashboardUI(data) {
    // Update Participants
    updateParticipantsUI(data.global.totalSlotsUsed || 0);

    // Update Event Timer (if an end time is provided by backend)
    if (data.global.eventEndTime) {
        startEventTimer(data.global.eventEndTime);
    } else {
        eventTimerDisplay.textContent = "00:00:00:00"; // Display 0s if event not started
        stakeBtn.disabled = false; // Allow stake to start event
        flipRewardBtn.disabled = true; // No reveal if event not active
    }
    
    // Update User-Specific Info if connected
    if (data.user) {
        currentStakeValueDisplay.textContent = `$${(data.user.stakedUSDValue || 0).toFixed(2)}`;
        bxcBalanceDisplay.textContent = `${(data.user.BXC_Balance || 0).toFixed(4)} BXC`;
        partneredCoinEarnedDisplay.textContent = `${(data.user.AIN_Balance || 0).toFixed(4)} AIN`; // Assuming AIN_Balance field from backend
        
        // Referral Code & Link
        referralCodeDisplay.textContent = data.user.referralCode || 'Connect Wallet';
        referralLinkDisplay.textContent = `${window.location.origin}/?ref=${data.user.referralCode || 'YOURCODE'}`; // Update base URL as needed

        // Handle button states based on user data
        stakeBtn.disabled = data.user.slotsStaked > 0; // Disable stake if already staked
        withdrawStakeBtn.disabled = !(data.user.slotsStaked > 0); // Enable withdraw only if staked

        // Enable flip if event has ended AND user staked AND user hasn't revealed yet for this cycle
        const now = new Date().getTime();
        const eventEnded = data.global.eventEndTime && now >= new Date(data.global.eventEndTime).getTime();
        const hasNotRevealedThisCycle = !data.user.claimedEventRewardTime || (data.global.eventStartTime && new Date(data.user.claimedEventRewardTime).getTime() < new Date(data.global.eventStartTime).getTime());
        
        flipRewardBtn.disabled = !(data.user.slotsStaked > 0 && eventEnded && hasNotRevealedThisCycle);
        
        // Enable collect button only if reward revealed and not collected for this cycle
        const hasRevealedAndNotCollected = data.user.lastRevealedUSDAmount > 0 && (!data.user.collectedEventRewardTime || (data.global.eventStartTime && new Date(data.user.collectedEventRewardTime).getTime() < new Date(data.global.eventStartTime).getTime()));
        collectRewardBtn.disabled = !hasRevealedAndNotCollected;
        
        withdrawBxcBtn.disabled = !(data.user.BXC_Balance > 0); // Enable BXC withdraw if balance > 0
        withdrawPartneredCoinBtn.disabled = !(data.user.AIN_Balance > 0); // Enable AIN withdraw if balance > 0

        // If user has staked and eventEndTime is available, start BXC accrual
        if (data.user.slotsStaked > 0 && data.global.eventEndTime) {
            startBXCAccrual(data.user.BXC_Balance, data.global.eventEndTime, data.user.lastBXCAccrualTime);
        } else {
             if (bxcAccrualInterval) clearInterval(bxcAccrualInterval); // Stop accrual if not staked or event hasn't started/ended
        }

    } else {
        // If no user connected, reset user-specific UI
        currentStakeValueDisplay.textContent = `$0.00`;
        bxcBalanceDisplay.textContent = `0.0000 BXC`;
        partneredCoinEarnedDisplay.textContent = `0.0000 AIN`;
        referralCodeDisplay.textContent = 'Connect Wallet';
        referralLinkDisplay.textContent = `${window.location.origin}/?ref=YOURCODE`;
        
        // Disable user-specific buttons
        stakeBtn.disabled = false; // Allow connecting to then stake
        withdrawStakeBtn.disabled = true;
        withdrawBxcBtn.disabled = true;
        flipRewardBtn.disabled = true;
        collectRewardBtn.disabled = true;
        withdrawPartneredCoinBtn.disabled = true;

        if (bxcAccrualInterval) clearInterval(bxcAccrualInterval); // Stop accrual if no user
    }
}


// --- Backend API Interactions ---

async function fetchStatus(walletAddress = null) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress })
        });
        const data = await response.json();
        if (response.ok) {
            console.log("Status fetched:", data);
            updateDashboardUI(data);
        } else {
            console.error("Failed to fetch status:", data.message);
            updateStatusMessage(stakeStatus, `Failed to load dashboard: ${data.message}`, true);
        }
    } catch (error) {
        console.error("Error fetching status:", error);
        updateStatusMessage(stakeStatus, `Network error loading dashboard. Check console/logs.`, true);
    }
}

async function handleStake() {
    if (!selectedAccount) {
        updateStatusMessage(stakeStatus, "Please connect your wallet first.", true);
        return;
    }
    updateStatusMessage(stakeStatus, "Initiating stake transaction...", false);

    try {
        // --- Web3.js BNB Transaction Simulation (replace with actual logic) ---
        // Get BNB equivalent of $8
        const responsePrice = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
        const priceData = await responsePrice.json();
        const bnbPriceUsd = priceData.binancecoin.usd;
        const amountUsd = 8;
        const amountBnb = amountUsd / bnbPriceUsd;
        const amountWei = web3.utils.toWei(amountBnb.toFixed(18), 'ether');

        // Address to send BNB to (replace with your actual STAKE_RECIPIENT_ADDRESS from backend config)
        const stakeRecipientAddress = '0xYourStakeRecipientAddressHere'; // <--- UPDATE THIS IN PRODUCTION

        const transactionParameters = {
            to: stakeRecipientAddress,
            from: selectedAccount,
            value: amountWei,
            chainId: BSC_CHAIN_ID, // Ensure on BSC
        };

        const txHash = await web3.eth.sendTransaction(transactionParameters);
        console.log("BNB Transaction successful:", txHash);
        updateStatusMessage(stakeStatus, `Stake transaction sent! TxHash: ${txHash.transactionHash}`, false);
        // --- End Web3.js Transaction Simulation ---

        // Call backend to record stake
        const response = await fetch(`${BACKEND_URL}/api/stake`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress: selectedAccount,
                amountUSD: amountUsd, // Record USD value
                transactionHash: txHash.transactionHash // Send actual tx hash
            })
        });
        const data = await response.json();
        if (response.ok) {
            updateStatusMessage(stakeStatus, `Staking successful! ${data.message}`, false);
            fetchStatus(selectedAccount); // Refresh UI
        } else {
            updateStatusMessage(stakeStatus, `Staking failed: ${data.message}`, true);
        }
    } catch (error) {
        console.error("Stake transaction error:", error);
        updateStatusMessage(stakeStatus, `Stake transaction failed: ${error.message}`, true);
    }
}

async function handleWithdrawStake() {
    if (!selectedAccount) return updateStatusMessage(stakeStatus, "Wallet not connected.", true);
    updateStatusMessage(stakeStatus, "Requesting stake withdrawal...", false);
    try {
        const response = await fetch(`${BACKEND_URL}/api/withdraw-stake`, { // Assuming new endpoint
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAccount })
        });
        const data = await response.json();
        if (response.ok) {
            updateStatusMessage(stakeStatus, `Stake withdrawal initiated: ${data.message}`, false);
            fetchStatus(selectedAccount);
        } else {
            updateStatusMessage(stakeStatus, `Stake withdrawal failed: ${data.message}`, true);
        }
    } catch (error) {
        console.error("Error withdrawing stake:", error);
        updateStatusMessage(stakeStatus, `Network error withdrawing stake.`, true);
    }
}


// --- BXC Accrual Logic ---

function startBXCAccrual(initialBalance, eventEndTimestamp, lastAccrualTime = null) {
    if (bxcAccrualInterval) {
        clearInterval(bxcAccrualInterval); // Clear any existing interval
    }

    const eventEndTimeMs = new Date(eventEndTimestamp).getTime();
    let currentBXC = initialBalance;
    let lastCalculatedTime = lastAccrualTime ? new Date(lastAccrualTime).getTime() : Date.now();

    // Initial calculation for any time elapsed since lastAccrualTime (e.g., page load)
    // Only accrue up to eventEndTime if now is past it.
    const now = Date.now();
    const effectiveAccrualEndTime = Math.min(now, eventEndTimeMs);
    
    const timeElapsedSinceLastAccrual = Math.max(0, (effectiveAccrualEndTime - lastCalculatedTime) / 1000); // in seconds
    currentBXC += timeElapsedSinceLastAccrual * BXC_ACCRUAL_PER_SECOND;
    bxcBalanceDisplay.textContent = `${currentBXC.toFixed(4)} BXC`; // Update immediately

    bxcAccrualInterval = setInterval(() => {
        const currentSecondTime = Date.now();
        if (currentSecondTime >= eventEndTimeMs) {
            clearInterval(bxcAccrualInterval);
            console.log("BXC accrual ended: Event time reached.");
            return;
        }
        
        // Accrue for 1 second
        currentBXC += BXC_ACCRUAL_PER_SECOND;
        bxcBalanceDisplay.textContent = `${currentBXC.toFixed(4)} BXC`;

    }, 1000); // Update every second
}

async function handleWithdrawBXC() {
    if (!selectedAccount) return updateStatusMessage(bxcWithdrawStatus, "Wallet not connected.", true);
    updateStatusMessage(bxcWithdrawStatus, "Requesting BXC withdrawal...", false);

    // Stop accrual temporarily if it's running, to prevent race conditions during update
    if (bxcAccrualInterval) {
        clearInterval(bxcAccrualInterval);
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/withdraw`, { // Your existing /api/withdraw endpoint
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAccount, token: 'BXC' }) // Specify token type
        });
        const data = await response.json();
        if (response.ok) {
            updateStatusMessage(bxcWithdrawStatus, `BXC withdrawal initiated: ${data.message}`, false);
            fetchStatus(selectedAccount); // Refresh UI, which will restart accrual if applicable
        } else {
            updateStatusMessage(bxcWithdrawStatus, `BXC withdrawal failed: ${data.message}`, true);
            fetchStatus(selectedAccount); // Refresh UI to get latest data and restart accrual if needed
        }
    } catch (error) {
        console.error("Error withdrawing BXC:", error);
        updateStatusMessage(bxcWithdrawStatus, `Network error withdrawing BXC.`, true);
        fetchStatus(selectedAccount); // Refresh UI in case of network error
    }
}

// --- Reward Flip Card & Partnered Coin Logic ---

async function handleFlipReward() {
    if (!selectedAccount) return updateStatusMessage(rewardStatus, "Wallet not connected.", true);
    updateStatusMessage(rewardStatus, "Revealing your reward...", false);

    // Prevent multiple flips or flips before event end (backend should also enforce)
    flipRewardBtn.disabled = true;

    try {
        const response = await fetch(`${BACKEND_URL}/api/reveal-reward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAccount })
        });
        const data = await response.json(); // Expected: { AIN_Amount: number, isLuckyWinner: boolean }

        if (response.ok) {
            // Flip the card visually
            rewardFlipCard.classList.add('flipped');

            // Determine AIN amount or "try again" message
            if (data.isLuckyWinner && data.AIN_Amount > 0) {
                revealedRewardAmountDisplay.textContent = `${data.AIN_Amount.toFixed(4)} AIN`;
                updateStatusMessage(rewardStatus, "Reward revealed! Click Collect.", false);
                collectRewardBtn.disabled = false; // Enable collect button
            } else {
                revealedRewardAmountDisplay.textContent = "Better luck next time! (0 AIN)"; 
                updateStatusMessage(rewardStatus, "No reward this event. Try again next time!", true);
                collectRewardBtn.disabled = true; // Disable collect button
            }
        } else {
            updateStatusMessage(rewardStatus, `Failed to reveal reward: ${data.message}`, true);
            flipRewardBtn.disabled = false; // Allow retrying if backend failed
        }
    } catch (error) {
        console.error("Error revealing reward:", error);
        updateStatusMessage(rewardStatus, `Network error revealing reward.`, true);
        flipRewardBtn.disabled = false;
    }
}

async function handleCollectReward() {
    if (!selectedAccount) return updateStatusMessage(partneredCoinStatus, "Wallet not connected.", true);
    updateStatusMessage(partneredCoinStatus, "Collecting your AIN reward...", false);
    collectRewardBtn.disabled = true; // Disable to prevent double-click

    try {
        const response = await fetch(`${BACKEND_URL}/api/collect-reward`, { // Backend endpoint to claim revealed reward
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAccount })
        });
        const data = await response.json(); // Expected to confirm AIN added to balance

        if (response.ok) {
            updateStatusMessage(partneredCoinStatus, `AIN collected successfully! ${data.message}`, false);
            fetchStatus(selectedAccount); // Refresh UI to show updated AIN balance
            rewardFlipCard.classList.remove('flipped'); // Reset card after collection
            flipRewardBtn.disabled = true; // Disable flip after collecting for this event
        } else {
            updateStatusMessage(partneredCoinStatus, `Failed to collect AIN: ${data.message}`, true);
            collectRewardBtn.disabled = false; // Re-enable if collection failed
        }
    } catch (error) {
        console.error("Error collecting AIN:", error);
        updateStatusMessage(partneredCoinStatus, `Network error collecting AIN.`, true);
        collectRewardBtn.disabled = false;
    }
}

async function handleWithdrawPartneredCoin() {
    if (!selectedAccount) return updateStatusMessage(partneredCoinStatus, "Wallet not connected.", true);
    updateStatusMessage(partneredCoinStatus, "Requesting AIN withdrawal...", false);
    
    // **IMPORTANT**: Your backend now has /api/withdrawAIN endpoint.
    try {
        const response = await fetch(`${BACKEND_URL}/api/withdrawAIN`, { // Using the NEW /api/withdrawAIN endpoint
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAccount })
        });
        const data = await response.json();
        if (response.ok) {
            updateStatusMessage(partneredCoinStatus, `AIN withdrawal initiated: ${data.message}`, false);
            fetchStatus(selectedAccount); // Refresh UI
        } else {
            updateStatusMessage(partneredCoinStatus, `AIN withdrawal failed: ${data.message}`, true);
        }
    } catch (error) {
        console.error("Error withdrawing AIN:", error);
        updateStatusMessage(partneredCoinStatus, `Network error withdrawing AIN.`, true);
    }
}


// --- Referral System Logic ---

async function handleCopyReferralCode() {
    const referralCode = referralCodeDisplay.textContent;
    if (referralCode && referralCode !== '••••••' && referralCode !== 'Connect Wallet') {
        try {
            await navigator.clipboard.writeText(referralCode);
            updateStatusMessage(stakeStatus, "Referral code copied!", false); // Using stakeStatus for general short messages
            
            // Send 50 BXC bonus to backend
            await fetch(`${BACKEND_URL}/api/referral-copied`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: selectedAccount, type: 'code_copy' })
            });
            fetchStatus(selectedAccount); // Refresh BXC balance
        } catch (err) {
            console.error('Failed to copy referral code: ', err);
            updateStatusMessage(stakeStatus, "Failed to copy code.", true);
        }
    } else {
        updateStatusMessage(stakeStatus, "No referral code available to copy.", true);
    }
}

async function handleCopyReferralLink() {
    const referralLink = referralLinkDisplay.textContent;
    if (referralLink && referralLink.includes(window.location.origin)) { // Ensure it's a valid link
        try {
            await navigator.clipboard.writeText(referralLink);
            updateStatusMessage(stakeStatus, "Referral link copied!", false); // Using stakeStatus for general short messages
            
            // Send 50 BXC bonus to backend
            await fetch(`${BACKEND_URL}/api/referral-copied`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: selectedAccount, type: 'link_copy' })
            });
            fetchStatus(selectedAccount); // Refresh BXC balance
        } catch (err) {
            console.error('Failed to copy referral link: ', err);
            updateStatusMessage(stakeStatus, "Failed to copy link.", true);
        }
    } else {
        updateStatusMessage(stakeStatus, "No referral link available to copy.", true);
    }
}

async function handleShareReferralLink() {
    const referralLink = referralLinkDisplay.textContent;
    if (navigator.share && referralLink && referralLink.includes(window.location.origin)) {
        try {
            await navigator.share({
                title: 'Join XtraShare BXC Staking!',
                text: 'Stake $8 and earn BXC, plus a chance for AIN rewards!',
                url: referralLink,
            });
            updateStatusMessage(stakeStatus, "Referral link shared!", false);
            // Optionally, send 50 BXC bonus to backend (if sharing is considered a copy event)
            await fetch(`${BACKEND_URL}/api/referral-copied`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: selectedAccount, type: 'share_event' })
            });
            fetchStatus(selectedAccount);
        } catch (error) {
            console.error('Error sharing:', error);
            updateStatusMessage(stakeStatus, "Failed to share link.", true);
        }
    } else {
        updateStatusMessage(stakeStatus, "Web Share API not supported or no link available.", true);
    }
}


// --- Wallet Connection Logic (from previous steps, adapted) ---

const initializeWeb3 = async (provider) => {
    web3 = new Web3(provider);
    console.log("Web3 initialized with provider:", provider);
    return true;
};

const connectWallet = async (walletName, provider) => {
    try {
        if (!provider) {
            updateStatusMessage(walletStatus, `${walletName} is not installed. Please install it to continue.`, true);
            return false;
        }

        await initializeWeb3(provider);

        const accounts = await web3.eth.requestAccounts();
        selectedAccount = accounts[0];
        console.log(`Connected with ${walletName}:`, selectedAccount);
        updateStatusMessage(walletStatus, `Connected: ${selectedAccount.substring(0, 6)}...${selectedAccount.substring(selectedAccount.length - 4)}`, false);

        const chainSwitched = await switchToBSC();
        if (!chainSwitched) {
            updateStatusMessage(walletStatus, `Please switch to BNB Smart Chain (Chain ID 56) manually.`, true);
            return false;
        }

        walletModal.classList.add('hidden'); // Close modal on success
        console.log("Wallet connected and on BSC. Fetching status..."); 
        fetchStatus(selectedAccount); // Fetch user status on successful connection
        return true;

    } catch (error) {
        console.error(`Error connecting to ${walletName}:`, error);
        updateStatusMessage(walletStatus, `Connection failed for ${walletName}. ${error.message}`, true);
        return false;
    }
};

const switchToBSC = async () => {
    if (!web3 || !web3.currentProvider) {
        console.error("Web3 not initialized. Cannot switch chain.");
        return false;
    }

    const currentChainId = await web3.eth.getChainId(); // Get current chain ID
    if (web3.utils.toHex(currentChainId) === BSC_CHAIN_ID) {
        console.log("Already on BSC.");
        return true;
    }

    try {
        await web3.currentProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BSC_CHAIN_ID }],
        });
        console.log("Successfully switched to BSC.");
        return true;
    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await web3.currentProvider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: BSC_CHAIN_ID,
                        chainName: 'BNB Smart Chain',
                        nativeCurrency: {
                            name: 'BNB',
                            symbol: 'BNB',
                            decimals: 18
                        },
                        rpcUrls: ['https://bsc-dataseed.binance.org/'],
                        blockExplorerUrls: ['https://bscscan.com/']
                    }]
                });
                console.log("BSC network added and switched to.");
                return true;
            } catch (addError) {
                console.error("Failed to add BSC network:", addError);
                return false;
            }
        } else {
            console.error("Failed to switch to BSC:", switchError);
            return false;
        }
    }
};

// --- Event Listeners ---

// Wallet Connection Modal
connectWalletBtn.addEventListener('click', () => {
    walletModal.classList.remove('hidden');
    walletStatus.classList.add('hidden'); // Clear previous status messages
});

closeModalBtn.addEventListener('click', () => {
    walletModal.classList.add('hidden');
});

walletModal.addEventListener('click', (e) => {
    if (e.target === walletModal) {
        walletModal.classList.add('hidden');
    }
});

walletOptions.forEach(button => {
    button.addEventListener('click', async () => {
        const walletType = button.dataset.wallet;
        let provider = null;

        switch (walletType) {
            case 'metamask':
                if (window.ethereum && window.ethereum.isMetaMask) {
                    provider = window.ethereum;
                }
                break;
            case 'bitget':
                if (window.bitkeep && window.bitkeep.ethereum) {
                    provider = window.bitkeep.ethereum;
                } else if (window.ethereum && window.ethereum.isBitKeep) {
                     provider = window.ethereum;
                }
                break;
            case 'okx':
                if (window.okxwallet) {
                    provider = window.okxwallet;
                }
                break;
            case 'trust':
                if (window.ethereum && window.ethereum.isTrust) {
                    provider = window.ethereum;
                }
                break;
            default:
                console.warn("Unknown wallet type:", walletType);
                break;
        }

        if (provider) {
            await connectWallet(walletType, provider);
        } else {
            updateStatusMessage(walletStatus, `${walletType.charAt(0).toUpperCase() + walletType.slice(1)} is not detected. Please install it.`, true);
        }
    });
});

// Listen for account/chain changes
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        console.log("Accounts changed event.");
        if (accounts.length === 0) {
            console.log('Wallet disconnected.');
            selectedAccount = null;
            updateDashboardUI({}); // Clear dashboard
            if (bxcAccrualInterval) clearInterval(bxcAccrualInterval); // Stop accrual
        } else {
            selectedAccount = accounts[0];
            console.log('Account changed to:', selectedAccount);
            fetchStatus(selectedAccount); // Fetch new account's status
        }
    });

    window.ethereum.on('chainChanged', (chainId) => {
        console.log("Chain changed event.");
        console.log('Chain changed to:', chainId);
        if (web3.utils.toHex(chainId) !== BSC_CHAIN_ID) {
            updateStatusMessage(stakeStatus, `Please switch to BNB Smart Chain (Chain ID 56). Current: ${chainId}`, true);
            if (bxcAccrualInterval) clearInterval(bxcAccrualInterval); // Stop accrual if wrong chain
        } else {
            updateStatusMessage(stakeStatus, `Successfully switched to BSC.`, false);
            if (selectedAccount) { // If an account is already connected, re-fetch status
                fetchStatus(selectedAccount);
            }
        }
    });
}

// Dashboard Buttons
stakeBtn.addEventListener('click', handleStake);
withdrawStakeBtn.addEventListener('click', handleWithdrawStake);
withdrawBxcBtn.addEventListener('click', handleWithdrawBXC);
flipRewardBtn.addEventListener('click', handleFlipReward);
collectRewardBtn.addEventListener('click', handleCollectReward);
withdrawPartneredCoinBtn.addEventListener('click', handleWithdrawPartneredCoin);
copyReferralCodeBtn.addEventListener('click', handleCopyReferralCode);
copyReferralLinkBtn.addEventListener('click', handleCopyReferralLink);
shareReferralLinkBtn.addEventListener('click', handleShareReferralLink);


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired.");
    // Attempt to auto-connect or fetch status if wallet is already connected (e.g., on refresh)
    if (window.ethereum && window.ethereum.selectedAddress) {
        selectedAccount = window.ethereum.selectedAddress;
        initializeWeb3(window.ethereum).then(() => {
            fetchStatus(selectedAccount);
        }).catch(err => {
            console.error("Auto-connect initialization failed:", err);
            updateStatusMessage(stakeStatus, "Auto-connect failed. Please connect wallet manually.", true);
        });
    } else {
        // Fetch global status if no wallet is connected
        fetchStatus(); // Pass null to fetch global status only
    }
});
