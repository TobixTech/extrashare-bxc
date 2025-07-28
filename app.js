// app.js

// Ensure Web3.js is available
if (typeof window.Web3 === 'undefined') {
    console.error("Web3.js is not loaded. Please ensure the CDN link is correct in your HTML.");
    alert("Blockchain functionalities are not available. Please check your internet connection or browser extensions.");
}

// --- Global Variables and Constants ---
const BSC_CHAIN_ID = '0x38'; // Chain ID for BNB Smart Chain (56 in decimal)
const AIN_USD_PRICE = 0.137; // Current price of AIN in USD for calculation
const BXC_ACCRUAL_PER_SECOND = 0.001;

let web3; // Will hold the Web3 instance
let selectedAccount = null;
let participantsTotalSlots = 30000; // Default, will be updated by backend
let eventEndTime = null; // Will store the timestamp when the event ends
let bxcAccrualInterval = null; // To hold the interval for BXC accrual
let mainEventTimerInterval = null; // Global for the main dApp timer

// Backend URL (Crucial: ENSURE THIS EXACTLY MATCHS YOUR DEPLOYED BACKEND URL)
const BACKEND_URL = 'https://bxc-backend-1dkpqw.fly.dev'; // Your actual deployed backend URL

// --- DOM Element References ---
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletModal = document.getElementById('walletModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const walletOptions = document.querySelectorAll('.wallet-option');
const walletStatus = document.getElementById('walletStatus');

// NEW: Inline Notification Elements
const inlineNotification = document.getElementById('inlineNotification');
const notificationText = document.getElementById('notificationText');


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
    console.log(`Status update for ${element.id || 'unknown'}: ${message}`);
}

function formatTime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d.toString().padStart(2, '0')}:${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Modified startEventTimer to account for isPaused state from backend
function startEventTimer(endTimeTimestamp, isPaused) {
    if (mainEventTimerInterval) {
        clearInterval(mainEventTimerInterval);
    }

    const eventEndTimeMs = new Date(endTimeTimestamp).getTime();

    // If paused, display PAUSED and stop timer countdown
    if (isPaused) {
        eventTimerDisplay.textContent = "PAUSED";
        return;
    }

    // If not paused, start/resume countdown
    mainEventTimerInterval = setInterval(() => {
        const now = new Date().getTime();
        const timeLeft = eventEndTimeMs - now;

        if (timeLeft <= 0) {
            clearInterval(mainEventTimerInterval);
            eventTimerDisplay.textContent = "00:00:00:00 (ENDED)";
            stakeBtn.disabled = true; // Disable stake if event ended
            return;
        }

        const secondsLeft = Math.floor(timeLeft / 1000);
        eventTimerDisplay.textContent = formatTime(secondsLeft);
    }, 1000);
}

// --- Inline Notification Logic (NEW) ---
const MESSAGES = [
    { text: "Events start August 9th 12PM", duration: 9000 }, // 9 seconds
    { text: "First 150 stake get Reward", duration: 3000 },    // 3 seconds
    { text: "Random 9,000 get AIN rewards", duration: 3000 }   // 3 seconds
];
let messageIndex = 0;

function cycleMessages() {
    if (!notificationText) return; // Ensure element exists

    const currentMessage = MESSAGES[messageIndex];

    // Fade out current text
    notificationText.classList.remove('opacity-100');
    notificationText.classList.add('opacity-0');

    setTimeout(() => {
        // Change text after fade out
        notificationText.textContent = currentMessage.text;
        // Fade in new text
        notificationText.classList.remove('opacity-0');
        notificationText.classList.add('opacity-100');

        // Move to next message after current message's duration
        setTimeout(() => {
            messageIndex = (messageIndex + 1) % MESSAGES.length;
            cycleMessages(); // Call recursively for next cycle
        }, currentMessage.duration);

    }, 500); // Duration of fade-out transition (0.5s as set by Tailwind)
}


// --- UI Update Functions ---

function updateParticipantsUI(stakedSlots, maxSlots) { // Now takes maxSlots
    const percentage = (stakedSlots / maxSlots) * 100;
    participantsCountDisplay.textContent = `${stakedSlots}/${maxSlots}`;
    participantsPercentageDisplay.textContent = `${percentage.toFixed(2)}%`;
    participantsProgressBar.style.width = `${percentage}%`;
}

function updateDashboardUI(data) {
    // Update Participants (use dynamic maxStakeSlots)
    participantsTotalSlots = data.global.maxStakeSlots || 30000; // Update global variable
    updateParticipantsUI(data.global.totalSlotsUsed || 0, participantsTotalSlots);

    // Update Event Timer (Pass isPaused status from backend)
    if (data.global.eventEndTime) {
        startEventTimer(data.global.eventEndTime, data.global.isPaused || false);
    } else {
        eventTimerDisplay.textContent = "00:00:00:00";
        stakeBtn.disabled = false;
        flipRewardBtn.disabled = true;
    }

    // Update User-Specific Info if connected
    if (data.user) {
        currentStakeValueDisplay.textContent = `$${(data.user.stakedUSDValue || 0).toFixed(2)}`;
        bxcBalanceDisplay.textContent = `${(data.user.BXC_Balance || 0).toFixed(4)} BXC`;
        partneredCoinEarnedDisplay.textContent = `${(data.user.AIN_Balance || 0).toFixed(4)} AIN`;

        // Referral Code & Link
        referralCodeDisplay.textContent = data.user.referralCode || 'Connect Wallet';
        referralLinkDisplay.textContent = `${window.location.origin}/?ref=${data.user.referralCode || 'YOURCODE'}`;

        // Handle button states based on user data and global paused states
        const isEventPaused = data.global.isPaused || false;
        const withdrawalsGloballyPaused = data.global.withdrawalsPaused || false;

        stakeBtn.disabled = data.user.slotsStaked > 0 || isEventPaused;

        // All withdrawal buttons now also check withdrawalsGloballyPaused
        withdrawStakeBtn.disabled = !(data.user.slotsStaked > 0) || isEventPaused || withdrawalsGloballyPaused;
        withdrawBxcBtn.disabled = !(data.user.BXC_Balance > 0) || isEventPaused || withdrawalsGloballyPaused;
        withdrawPartneredCoinBtn.disabled = !(data.user.AIN_Balance > 0) || isEventPaused || withdrawalsGloballyPaused;


        // Enable flip if event has ended AND user staked AND user hasn't revealed yet for this cycle AND not paused
        const now = new Date().getTime();
        const eventEnded = data.global.eventEndTime && now >= new Date(data.global.eventEndTime).getTime();
        const hasNotRevealedThisCycle = !data.user.claimedEventRewardTime || (data.global.eventStartTime && new Date(data.user.claimedEventRewardTime).getTime() < new Date(data.global.eventStartTime).getTime());

        flipRewardBtn.disabled = !(data.user.slotsStaked > 0 && eventEnded && hasNotRevealedThisCycle && !isEventPaused);

        // Enable collect button only if reward revealed and not collected for this cycle AND not paused
        const hasRevealedAndNotCollected = data.user.lastRevealedUSDAmount > 0 && (!data.user.collectedEventRewardTime || (data.global.eventStartTime && new Date(data.user.collectedEventRewardTime).getTime() < new Date(data.global.eventStartTime).getTime()));
        collectRewardBtn.disabled = !hasRevealedAndNotCollected || isEventPaused;

        // If user has staked and eventEndTime is available, start BXC accrual (only if not paused)
        if (data.user.slotsStaked > 0 && data.global.eventEndTime && !isEventPaused) {
            startBXCAccrual(data.user.BXC_Balance, data.global.eventEndTime, data.user.lastBXCAccrualTime);
        } else {
             if (bxcAccrualInterval) clearInterval(bxcAccrualInterval); // Stop accrual if not staked, event hasn't started/ended, OR PAUSED
        }

    } else {
        // If no user connected, reset user-specific UI
        currentStakeValueDisplay.textContent = `$0.00`;
        bxcBalanceDisplay.textContent = `0.0000 BXC`;
        partneredCoinEarnedDisplay.textContent = `0.0000 AIN`;
        referralCodeDisplay.textContent = 'Connect Wallet';
        referralLinkDisplay.textContent = `${window.location.origin}/?ref=YOURCODE`;

        // Disable user-specific buttons (unless needed to initiate connection/stake)
        const isEventPaused = data.global.isPaused || false;
        const withdrawalsGloballyPaused = data.global.withdrawalsPaused || false;

        stakeBtn.disabled = isEventPaused;
        withdrawStakeBtn.disabled = true || isEventPaused || withdrawalsGloballyPaused;
        withdrawBxcBtn.disabled = true || isEventPaused || withdrawalsGloballyPaused;
        flipRewardBtn.disabled = true;
        collectRewardBtn.disabled = true;
        withdrawPartneredCoinBtn.disabled = true || isEventPaused || withdrawalsGloballyPaused;

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
    console.log("Stake button clicked - handleStake function entered."); 

    if (!selectedAccount) {
        updateStatusMessage(stakeStatus, "Please connect your wallet first.", true);
        console.log("selectedAccount is null. Exiting handleStake."); 
        return;
    }
    updateStatusMessage(stakeStatus, "Initiating stake transaction...", false);
    console.log("selectedAccount is NOT null. Proceeding to fetch status."); 

    try {
        const statusResponse = await fetch(`${BACKEND_URL}/api/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAccount })
        });
        const statusData = await statusResponse.json();

        if (!statusResponse.ok || !statusData.global) {
            updateStatusMessage(stakeStatus, `Failed to get current staking details: ${statusData.message || 'Error'}`, true);
            console.log("Failed to get current staking details. Exiting handleStake."); 
            return;
        }

        const currentInitialStakeAmount = statusData.global.initialStakeAmountUSD || 8;
        const stakeRecipientAddress = statusData.global.stakingRecipientAddress || '0xYourDefaultStakeRecipientAddressHere'; 

        if (stakeRecipientAddress === '0xYourDefaultStakeRecipientAddressHere' || !/^0x[a-fA-F0-9]{40}$/.test(stakeRecipientAddress)) {
             updateStatusMessage(stakeStatus, "Staking recipient address is not properly configured by admin.", true);
             console.log("Staking recipient address invalid. Exiting handleStake."); 
             return;
        }

        const responsePrice = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
        const priceData = await responsePrice.json();
        const bnbPriceUsd = priceData.binancecoin.usd;
        
        const amountUsd = currentInitialStakeAmount; 
        const amountBnb = amountUsd / bnbPriceUsd;
        const amountWei = web3.utils.toWei(amountBnb.toFixed(18), 'ether');

        // --- IMPORTANT CHANGE HERE: Using ethereum.request directly ---
        const transactionParameters = {
            to: stakeRecipientAddress,
            from: selectedAccount,
            value: web3.utils.toHex(amountWei), // Convert to hex string for RPC call
            chainId: BSC_CHAIN_ID, // Ensure chainId is correctly set
        };

        console.log("Attempting to send transaction with parameters (using ethereum.request):", transactionParameters);

        // Using ethereum.request directly as it often has better wallet compatibility
        // This is the common way for EIP-1193 providers
        const txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [transactionParameters],
        });
        
        // Note: The above returns the transaction hash directly, not an object like web3.eth.sendTransaction
        console.log("BNB Transaction successful, TxHash:", txHash);
        updateStatusMessage(stakeStatus, `Stake transaction sent! TxHash: ${txHash}`, false);

        const response = await fetch(`${BACKEND_URL}/api/stake`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress: selectedAccount,
                amountUSD: amountUsd,
                transactionHash: txHash // Pass the raw hash
            })
        });
        const data = await response.json();
        if (response.ok) {
            updateStatusMessage(stakeStatus, `Staking successful! ${data.message}`, false);
            fetchStatus(selectedAccount);
        } else {
            updateStatusMessage(stakeStatus, `Staking failed: ${data.message}`, true);
        }
    } catch (error) {
        console.error("Stake transaction failed in handleStake() catch block:", error);
        if (error.code === 4001) {
            updateStatusMessage(stakeStatus, "Transaction rejected by wallet.", true);
        } else if (error.message && error.message.includes("insufficient funds")) {
            updateStatusMessage(stakeStatus, "Insufficient BNB for gas fees.", true);
        } else if (error.code === -32603) { // Generic RPC error, often "User denied transaction signature"
            updateStatusMessage(stakeStatus, `Wallet error: ${error.message || 'Check your wallet for details.'}`, true);
        }
        else {
            updateStatusMessage(stakeStatus, `Stake transaction failed: ${error.message || 'Unknown error'}. Please check your wallet.`, true);
        }
    }
}

async function handleWithdrawStake() {
    if (!selectedAccount) return updateStatusMessage(stakeStatus, "Wallet not connected.", true);
    updateStatusMessage(stakeStatus, "Requesting stake withdrawal...", false);
    try {
        const response = await fetch(`${BACKEND_URL}/api/withdraw-stake`, {
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
        clearInterval(bxcAccrualInterval);
    }

    const eventEndTimeMs = new Date(eventEndTimestamp).getTime();
    let currentBXC = initialBalance;
    let lastCalculatedTime = lastAccrualTime ? new Date(lastAccrualTime).getTime() : Date.now();

    const now = Date.now();
    const effectiveAccrualEndTime = Math.min(now, eventEndTimeMs);

    const timeElapsedSinceLastAccrual = Math.max(0, (effectiveAccrualEndTime - lastCalculatedTime) / 1000);
    currentBXC += timeElapsedSinceLastAccrual * BXC_ACCRUAL_PER_SECOND;
    bxcBalanceDisplay.textContent = `${currentBXC.toFixed(4)} BXC`;

    bxcAccrualInterval = setInterval(() => {
        const currentSecondTime = Date.now();
        if (currentSecondTime >= eventEndTimeMs) {
            clearInterval(bxcAccrualInterval);
            console.log("BXC accrual ended: Event time reached.");
            return;
        }

        currentBXC += BXC_ACCRUAL_PER_SECOND;
        bxcBalanceDisplay.textContent = `${currentBXC.toFixed(4)} BXC`;

    }, 1000);
}

async function handleWithdrawBXC() {
    if (!selectedAccount) return updateStatusMessage(bxcWithdrawStatus, "Wallet not connected.", true);
    updateStatusMessage(bxcWithdrawStatus, "Requesting BXC withdrawal...", false);

    if (bxcAccrualInterval) {
        clearInterval(bxcAccrualInterval);
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAccount, token: 'BXC' })
        });
        const data = await response.json();
        if (response.ok) {
            updateStatusMessage(bxcWithdrawStatus, `BXC withdrawal initiated: ${data.message}`, false);
            fetchStatus(selectedAccount);
        } else {
            updateStatusMessage(bxcWithdrawStatus, `BXC withdrawal failed: ${data.message}`, true);
            fetchStatus(selectedAccount);
        }
    } catch (error) {
        console.error("Error withdrawing BXC:", error);
        updateStatusMessage(bxcWithdrawStatus, `Network error withdrawing BXC.`, true);
        fetchStatus(selectedAccount);
    }
}

// --- Reward Flip Card & Partnered Coin Logic ---

async function handleFlipReward() {
    if (!selectedAccount) return updateStatusMessage(rewardStatus, "Wallet not connected.", true);
    updateStatusMessage(rewardStatus, "Revealing your reward...", false);

    flipRewardBtn.disabled = true;

    try {
        const response = await fetch(`${BACKEND_URL}/api/reveal-reward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAccount })
        });
        const data = await response.json();

        if (response.ok) {
            rewardFlipCard.classList.add('flipped');

            if (data.isLuckyWinner && data.AIN_Amount > 0) {
                revealedRewardAmountDisplay.textContent = `${data.AIN_Amount.toFixed(4)} AIN`;
                updateStatusMessage(rewardStatus, "Reward revealed! Click Collect.", false);
                collectRewardBtn.disabled = false;
            } else {
                revealedRewardAmountDisplay.textContent = "Better luck next time! (0 AIN)";
                updateStatusMessage(rewardStatus, "No reward this event. Try again next time!", true);
                collectRewardBtn.disabled = true;
            }
        } else {
            updateStatusMessage(rewardStatus, `Failed to reveal reward: ${data.message}`, true);
            flipRewardBtn.disabled = false;
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
    collectRewardBtn.disabled = true;

    try {
        const response = await fetch(`${BACKEND_URL}/api/collect-reward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAccount })
        });
        const data = await response.json();

        if (response.ok) {
            updateStatusMessage(partneredCoinStatus, `AIN collected successfully! ${data.message}`, false);
            fetchStatus(selectedAccount);
            rewardFlipCard.classList.remove('flipped');
            flipRewardBtn.disabled = true;
        } else {
            updateStatusMessage(partneredCoinStatus, `Failed to collect AIN: ${data.message}`, true);
            collectRewardBtn.disabled = false;
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
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/withdrawAIN`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAccount })
        });
        const data = await response.json();
        if (response.ok) {
            updateStatusMessage(partneredCoinStatus, `AIN withdrawal initiated: ${data.message}`, false);
            fetchStatus(selectedAccount);
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
            updateStatusMessage(stakeStatus, "Referral code copied!", false);
            
            await fetch(`${BACKEND_URL}/api/referral-copied`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: selectedAccount, type: 'code_copy' })
            });
            fetchStatus(selectedAccount);
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
    if (referralLink && referralLink.includes(window.location.origin)) {
        try {
            await navigator.clipboard.writeText(referralLink);
            updateStatusMessage(stakeStatus, "Referral link copied!", false);
            
            await fetch(`${BACKEND_URL}/api/referral-copied`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: selectedAccount, type: 'link_copy' })
            });
            fetchStatus(selectedAccount);
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


// --- Wallet Connection Logic ---

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
        
        // Update the main connect button text to show connected address and green background
        connectWalletBtn.textContent = `Connected: ${selectedAccount.substring(0, 6)}...${selectedAccount.substring(selectedAccount.length - 4)}`;
        connectWalletBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        connectWalletBtn.classList.add('bg-green-600', 'hover:bg-green-700');

        updateStatusMessage(walletStatus, `Connected: ${selectedAccount.substring(0, 6)}...${selectedAccount.substring(selectedAccount.length - 4)}`, false);

        const chainSwitched = await switchToBSC();
        if (!chainSwitched) {
            updateStatusMessage(walletStatus, `Please switch to BNB Smart Chain (Chain ID 56) manually.`, true);
            // Revert button color if chain switch fails
            connectWalletBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
            connectWalletBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
            connectWalletBtn.textContent = 'Connect Wallet'; // Reset text
            return false;
        }

        walletModal.classList.add('hidden');
        console.log("Wallet connected and on BSC. Fetching status..."); 
        fetchStatus(selectedAccount);
        return true;

    } catch (error) {
        console.error(`Error connecting to ${walletName}:`, error);
        updateStatusMessage(walletStatus, `Connection failed for ${walletName}. ${error.message}`, true);
        // Ensure button reverts to original state on failure
        connectWalletBtn.textContent = 'Connect Wallet';
        connectWalletBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        connectWalletBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        return false;
    }
};

const switchToBSC = async () => {
    if (!web3 || !web3.currentProvider) {
        console.error("Web3 not initialized. Cannot switch chain.");
        return false;
    }

    const currentChainId = await web3.eth.getChainId();
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
    walletStatus.classList.add('hidden');
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


// Listen for account/chain changes
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        console.log("Accounts changed event.");
        if (accounts.length === 0) {
            console.log('Wallet disconnected.');
            selectedAccount = null;
            updateDashboardUI({});
            if (bxcAccrualInterval) clearInterval(bxcAccrualInterval);
            if (mainEventTimerInterval) clearInterval(mainEventTimerInterval);
            // Reset connect button
            connectWalletBtn.textContent = 'Connect Wallet';
            connectWalletBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
            connectWalletBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        } else {
            selectedAccount = accounts[0];
            console.log('Account changed to:', selectedAccount);
            // Update connect button
            connectWalletBtn.textContent = `Connected: ${selectedAccount.substring(0, 6)}...${selectedAccount.substring(selectedAccount.length - 4)}`;
            connectWalletBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            connectWalletBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            fetchStatus(selectedAccount);
        }
    });

    window.ethereum.on('chainChanged', (chainId) => {
        console.log("Chain changed event.");
        console.log('Chain changed to:', chainId);
        if (web3.utils.toHex(chainId) !== BSC_CHAIN_ID) {
            updateStatusMessage(stakeStatus, `Please switch to BNB Smart Chain (Chain ID 56). Current: ${chainId}`, true);
            if (bxcAccrualInterval) clearInterval(bxcAccrualInterval);
            if (mainEventTimerInterval) clearInterval(mainEventTimerInterval);
            // Reset connect button
            connectWalletBtn.textContent = 'Connect Wallet';
            connectWalletBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
            connectWalletBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        } else {
            updateStatusMessage(stakeStatus, `Successfully switched to BSC.`, false);
            if (selectedAccount) {
                fetchStatus(selectedAccount);
            }
        }
    });
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    // Start the inline notification message cycling
    cycleMessages(); 

    console.log("DOMContentLoaded fired.");
    if (window.ethereum && window.ethereum.selectedAddress) {
        selectedAccount = window.ethereum.selectedAddress;
        initializeWeb3(window.ethereum).then(() => {
            // Update connect button on auto-connect
            connectWalletBtn.textContent = `Connected: ${selectedAccount.substring(0, 6)}...${selectedAccount.substring(selectedAccount.length - 4)}`;
            connectWalletBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            connectWalletBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            fetchStatus(selectedAccount);
        }).catch(err => {
            console.error("Auto-connect initialization failed:", err);
            updateStatusMessage(stakeStatus, "Auto-connect failed. Please connect wallet manually.", true);
            // Reset connect button on auto-connect failure
            connectWalletBtn.textContent = 'Connect Wallet';
            connectWalletBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            connectWalletBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        });
    } else {
        fetchStatus();
    }
});
