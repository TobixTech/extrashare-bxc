// admin.js

// Ensure Web3.js is available
if (typeof window.Web3 === 'undefined') {
    console.error("Web3.js is not loaded. Please ensure the CDN link is correct in your HTML.");
    alert("Blockchain functionalities are not available. Please check your internet connection or browser extensions.");
}

// --- Global Variables and Constants ---
const BSC_CHAIN_ID = '0x38'; // Chain ID for BNB Smart Chain (56 in decimal)

let web3; // Will hold the Web3 instance
let selectedAdminAccount = null;

// Backend URL (Crucial: YOU MUST REPLACE THIS WITH YOUR ACTUAL DEPLOYED BACKEND URL)
const BACKEND_URL = 'https://bxc-backend-1dkpqw.fly.dev'; // <<<--- IMPORTANT: REPLACE THIS LINE

// --- DOM Element References ---
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletModal = document.getElementById('walletModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const walletOptions = document.querySelectorAll('.wallet-option');
const walletStatus = document.getElementById('walletStatus');

// Admin Specific UI Elements
const adminStatusCard = document.getElementById('adminStatusCard');
const adminMessage = document.getElementById('adminMessage');
const adminControls = document.getElementById('adminControls');
const connectedAdminWalletDisplay = document.getElementById('connectedAdminWallet');

// Feature 1: Total Connected Wallets Display
const totalConnectedWalletsDisplay = document.getElementById('totalConnectedWalletsDisplay');

const adminEventTimerDisplay = document.getElementById('adminEventTimer');
const eventTimerLabel = document.getElementById('eventTimerLabel'); 
const adminParticipantsCountDisplay = document.getElementById('adminParticipantsCount');
const adminParticipantsProgressBar = document.getElementById('adminParticipantsProgressBar');

// Admin Action Buttons & Status Displays
const togglePauseBtn = document.getElementById('togglePauseBtn');
const togglePauseStatus = document.getElementById('togglePauseStatus'); 

const newEventDurationInput = document.getElementById('newEventDurationInput');
const setEventDurationBtn = document.getElementById('setEventDurationBtn'); 
const setEventDurationStatus = document.getElementById('setEventDurationStatus'); 

const newMaxSlotsInput = document.getElementById('newMaxSlotsInput'); 
const setMaxSlotsBtn = document.getElementById('setMaxSlotsBtn');     
const setMaxSlotsStatus = document.getElementById('setMaxSlotsStatus'); 
const currentMaxSlotsDisplay = document.getElementById('currentMaxSlotsDisplay'); 

const newStakingWalletAddressInput = document.getElementById('newStakingWalletAddressInput'); 
const setStakingWalletBtn = document.getElementById('setStakingWalletBtn');                 
const setStakingWalletStatus = document.getElementById('setStakingWalletStatus');           
const currentStakingWalletDisplay = document.getElementById('currentStakingWalletDisplay'); 

const newStakeAmountInput = document.getElementById('newStakeAmountInput'); 
const setStakeAmountBtn = document.getElementById('setStakeAmountBtn');     
const setStakeAmountStatus = document.getElementById('setStakeAmountStatus'); 
const currentStakeAmountDisplay = document.getElementById('currentStakeAmountDisplay'); 

const maxAinRewardPoolInput = document.getElementById('maxAinRewardPoolInput'); 
const setMaxAinRewardPoolBtn = document.getElementById('setMaxAinRewardPoolBtn'); 
const setMaxAinRewardPoolStatus = document.getElementById('setMaxAinRewardPoolStatus'); 
const currentMaxAinRewardPoolDisplay = document.getElementById('currentMaxAinRewardPoolDisplay'); 
const totalAinRewardedDisplay = document.getElementById('totalAinRewardedDisplay'); 

const fundUserWalletInput = document.getElementById('fundUserWalletInput'); 
const fundAmountInput = document.getElementById('fundAmountInput');         
const fundTokenTypeSelect = document.getElementById('fundTokenTypeSelect'); 
const fundUserBtn = document.getElementById('fundUserBtn');                 
const fundUserStatus = document.getElementById('fundUserStatus');           

const withdrawalsStatusDisplay = document.getElementById('withdrawalsStatusDisplay');
const toggleWithdrawalsPauseBtn = document.getElementById('toggleWithdrawalsPauseBtn');
const toggleWithdrawalsStatus = document.getElementById('toggleWithdrawalsStatus');

const leaderboardSortBy = document.getElementById('leaderboardSortBy');
const refreshLeaderboardBtn = document.getElementById('refreshLeaderboardBtn');
const leaderboardTableBody = document.getElementById('leaderboardTableBody');
const leaderboardStatus = document.getElementById('leaderboardStatus');
const totalUsersCountDisplay = document.getElementById('totalUsersCountDisplay'); 

// --- Utility Functions ---
function updateStatusMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.remove('hidden', 'text-green-500', 'text-red-500');
    element.classList.add(isError ? 'text-red-500' : 'text-green-500');
    console.log(`Admin Status update for ${element.id || 'unknown'}: ${message}`);
}

function formatTime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d.toString().padStart(2, '0')}:${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

let adminEventTimerInterval; // Specific interval for admin timer

// Modified startAdminEventTimer to account for isPaused state
function startAdminEventTimer(endTimeTimestamp, isPaused, eventStartTime) {
    if (adminEventTimerInterval) {
        clearInterval(adminEventTimerInterval);
    }

    const eventEndTimeMs = new Date(endTimeTimestamp).getTime();
    const eventStartTimeMs = new Date(eventStartTime).getTime(); 
    const nowMs = new Date().getTime();

    // If already paused, display PAUSED and stop timer
    if (isPaused) {
        adminEventTimerDisplay.textContent = "PAUSED";
        eventTimerLabel.textContent = "Event Status";
        togglePauseBtn.textContent = "Resume Event";
        togglePauseBtn.disabled = false; 
        return;
    }

    // If event hasn't genuinely started yet 
    if (nowMs < eventStartTimeMs) {
        adminEventTimerDisplay.textContent = "NOT STARTED";
        eventTimerLabel.textContent = "Event Status";
        togglePauseBtn.textContent = "Event Not Started"; 
        togglePauseBtn.disabled = true; 
        return;
    }

    // If not paused, start/resume countdown
    adminEventTimerInterval = setInterval(() => {
        const now = new Date().getTime();
        const timeLeft = eventEndTimeMs - now;

        if (timeLeft <= 0) {
            clearInterval(adminEventTimerInterval);
            adminEventTimerDisplay.textContent = "00:00:00:00 (ENDED)";
            eventTimerLabel.textContent = "Event Status";
            togglePauseBtn.textContent = "Event Ended";
            togglePauseBtn.disabled = true; 
            return;
        }

        const secondsLeft = Math.floor(timeLeft / 1000);
        adminEventTimerDisplay.textContent = formatTime(secondsLeft);
        eventTimerLabel.textContent = "Ends In"; // Default label
        togglePauseBtn.textContent = "Pause Event"; // Ensure button says pause if running
        togglePauseBtn.disabled = false;
    }, 1000);
}


// --- Admin API Interactions ---

async function checkAdminStatus(walletAddress) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress })
        });
        const data = await response.json();

        if (response.ok && data.isAdmin) {
            adminMessage.textContent = data.message;
            adminControls.classList.remove('hidden');
            connectedAdminWalletDisplay.textContent = walletAddress;
            return true;
        } else {
            adminMessage.textContent = data.message || "Access Denied: You are not an authorized administrator.";
            adminControls.classList.add('hidden');
            return false;
        }
    } catch (error) {
        console.error("Error checking admin status:", error);
        adminMessage.textContent = "Error verifying admin access. Network issue or backend problem.";
        adminControls.classList.add('hidden');
        return false;
    }
}

async function fetchAdminDashboardData() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/status`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAdminAccount }) // Pass admin wallet for user-specific data
        });
        const data = await response.json();

        if (response.ok) {
            const globalData = data.global;

            // Feature 1: Update Total Connected Wallets
            totalConnectedWalletsDisplay.textContent = globalData.totalConnectedWallets || 0;

            const participantsTotalSlots = globalData.maxStakeSlots || 30000; 
            const stakedSlots = globalData.totalSlotsUsed || 0;
            const percentage = (stakedSlots / participantsTotalSlots) * 100;

            adminParticipantsCountDisplay.textContent = `${stakedSlots}/${participantsTotalSlots}`;
            adminParticipantsProgressBar.style.width = `${percentage}%`;

            // Display timer
            if (globalData.eventEndTime) {
                const isEventPaused = globalData.isPaused || false; 
                const eventStartTime = globalData.eventStartTime; 
                startAdminEventTimer(globalData.eventEndTime, isEventPaused, eventStartTime);
            } else {
                adminEventTimerDisplay.textContent = "No Event Set";
                togglePauseBtn.disabled = true;
                eventTimerLabel.textContent = "Event Status";
            }

            // Update withdrawals status display
            const withdrawalsPaused = globalData.withdrawalsPaused || false;
            withdrawalsStatusDisplay.textContent = withdrawalsPaused ? "Paused" : "Active";
            withdrawalsStatusDisplay.classList.toggle('text-red-500', withdrawalsPaused);
            withdrawalsStatusDisplay.classList.toggle('text-highlight-green', !withdrawalsPaused);
            toggleWithdrawalsPauseBtn.textContent = withdrawalsPaused ? "Resume All Withdrawals" : "Pause All Withdrawals";
            toggleWithdrawalsPauseBtn.disabled = false;

            // Feature 2: Update current staking wallet address display
            currentStakingWalletDisplay.textContent = globalData.stakingRecipientAddress ? 
                `${globalData.stakingRecipientAddress.substring(0, 6)}...${globalData.stakingRecipientAddress.substring(globalData.stakingRecipientAddress.length - 4)}` : 'Not Set';
            
            // Feature 5: Update current stake amount display
            currentStakeAmountDisplay.textContent = (globalData.initialStakeAmountUSD || 0).toFixed(2);

            // Feature 6: Update current max slots display
            currentMaxSlotsDisplay.textContent = globalData.maxStakeSlots || 0;

            // Feature 3: Update AIN reward pool displays
            currentMaxAinRewardPoolDisplay.textContent = (globalData.maxAinRewardPool || 0).toFixed(0);
            totalAinRewardedDisplay.textContent = (globalData.totalAinRewarded || 0).toFixed(4);

            fetchUsersLeaderboard(leaderboardSortBy.value); // Fetch leaderboard on dashboard load
            return data;
        } else {
            // This 'else' block implies a response was received but it was not 'ok' (e.g., status 500)
            updateStatusMessage(adminMessage, `Failed to load dashboard data: ${data.message || 'Unknown error'}`, true);
            return null;
        }
    } catch (error) {
        // This 'catch' block handles actual network errors (e.g., backend URL is wrong, server is down)
        console.error("Error fetching admin dashboard data:", error);
        updateStatusMessage(adminMessage, `Network error loading admin dashboard data. Please ensure backend is running and URL is correct.`, true);
        return null;
    }
}

// Handle toggling event pause
async function handleTogglePause() {
    if (!selectedAdminAccount) {
        updateStatusMessage(togglePauseStatus, "Admin wallet not connected.", true);
        return;
    }
    togglePauseBtn.disabled = true; 
    updateStatusMessage(togglePauseStatus, "Toggling event pause state...", false);

    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/toggle-event-pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAdminAccount })
        });
        const data = await response.json();

        if (response.ok) {
            updateStatusMessage(togglePauseStatus, data.message, false);
            fetchAdminDashboardData(); 
        } else {
            updateStatusMessage(togglePauseStatus, `Failed to toggle: ${data.message}`, true);
            togglePauseBtn.disabled = false; 
        }
    } catch (error) {
        console.error("Error toggling event pause:", error);
        updateStatusMessage(togglePauseStatus, `Network error toggling pause.`, true);
        togglePauseBtn.disabled = false; 
    }
}

// Handle setting new event duration
async function handleSetEventDuration() { 
    if (!selectedAdminAccount) {
        updateStatusMessage(setEventDurationStatus, "Admin wallet not connected.", true);
        return;
    }
    const durationHours = parseFloat(newEventDurationInput.value);
    if (isNaN(durationHours) || durationHours <= 0) {
        updateStatusMessage(setEventDurationStatus, "Please enter a valid positive number for duration (hours).", true);
        return;
    }

    setEventDurationBtn.disabled = true;
    updateStatusMessage(setEventDurationStatus, `Setting new event duration to ${durationHours} hours...`, false);

    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/set-event-duration`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAdminAccount, durationHours: durationHours })
        });
        const data = await response.json();

        if (response.ok) {
            updateStatusMessage(setEventDurationStatus, data.message, false);
            newEventDurationInput.value = ''; 
            fetchAdminDashboardData(); 
        } else {
            updateStatusMessage(setEventDurationStatus, `Failed to set event duration: ${data.message}`, true);
            setEventDurationBtn.disabled = false;
        }
    } catch (error) {
        console.error("Error setting event duration:", error);
        updateStatusMessage(setEventDurationStatus, `Network error setting event duration.`, true);
        setEventDurationBtn.disabled = false;
    }
}

// Feature 2: Handle setting new staking wallet address
async function handleSetStakingWalletAddress() {
    if (!selectedAdminAccount) {
        updateStatusMessage(setStakingWalletStatus, "Admin wallet not connected.", true);
        return;
    }
    const newAddress = newStakingWalletAddressInput.value.trim();
    if (!newAddress || !/^0x[a-fA-F0-9]{40}$/.test(newAddress)) {
        updateStatusMessage(setStakingWalletStatus, "Please enter a valid 0x... wallet address.", true);
        return;
    }

    setStakingWalletBtn.disabled = true;
    updateStatusMessage(setStakingWalletStatus, `Setting new staking address to ${newAddress}...`, false);

    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/set-staking-wallet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAdminAccount, newStakingAddress: newAddress })
        });
        const data = await response.json();

        if (response.ok) {
            updateStatusMessage(setStakingWalletStatus, data.message, false);
            newStakingWalletAddressInput.value = ''; 
            fetchAdminDashboardData(); 
        } else {
            updateStatusMessage(setStakingWalletStatus, `Failed to set address: ${data.message}`, true);
            setStakingWalletBtn.disabled = false;
        }
    } catch (error) {
        console.error("Error setting staking wallet:", error);
        updateStatusMessage(setStakingWalletStatus, `Network error setting address.`, true);
        setStakingWalletBtn.disabled = false;
    }
}

// Feature 5: Handle setting initial stake amount
async function handleSetStakeAmount() {
    if (!selectedAdminAccount) {
        updateStatusMessage(setStakeAmountStatus, "Admin wallet not connected.", true);
        return;
    }
    const amount = parseFloat(newStakeAmountInput.value);
    if (isNaN(amount) || amount <= 0) {
        updateStatusMessage(setStakeAmountStatus, "Please enter a valid positive number for stake amount.", true);
        return;
    }

    setStakeAmountBtn.disabled = true;
    updateStatusMessage(setStakeAmountStatus, `Setting initial stake amount to $${amount.toFixed(2)}...`, false);

    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/set-stake-amount`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAdminAccount, newStakeAmount: amount })
        });
        const data = await response.json();

        if (response.ok) {
            updateStatusMessage(setStakeAmountStatus, data.message, false);
            newStakeAmountInput.value = ''; 
            fetchAdminDashboardData(); 
        } else {
            updateStatusMessage(setStakeAmountStatus, `Failed to set amount: ${data.message}`, true);
            setStakeAmountBtn.disabled = false;
        }
    } catch (error) {
        console.error("Error setting stake amount:", error);
        updateStatusMessage(setStakeAmountStatus, `Network error setting amount.`, true);
        setStakeAmountBtn.disabled = false;
    }
}

// Feature 6: Handle setting maximum slots
async function handleSetMaxSlots() {
    if (!selectedAdminAccount) {
        updateStatusMessage(setMaxSlotsStatus, "Admin wallet not connected.", true);
        return;
    }
    const maxSlots = parseInt(newMaxSlotsInput.value);
    if (isNaN(maxSlots) || maxSlots <= 0 || !Number.isInteger(maxSlots)) {
        updateStatusMessage(setMaxSlotsStatus, "Please enter a valid positive integer for max slots.", true);
        return;
    }

    setMaxSlotsBtn.disabled = true;
    updateStatusMessage(setMaxSlotsStatus, `Setting maximum slots to ${maxSlots}...`, false);

    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/set-max-slots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAdminAccount, newMaxSlots: maxSlots })
        });
        const data = await response.json();

        if (response.ok) {
            updateStatusMessage(setMaxSlotsStatus, data.message, false);
            newMaxSlotsInput.value = ''; 
            fetchAdminDashboardData(); 
        } else {
            updateStatusMessage(setMaxSlotsStatus, `Failed to set max slots: ${data.message}`, true);
            setMaxSlotsBtn.disabled = false;
        }
    } catch (error) {
        console.error("Error setting max slots:", error);
        updateStatusMessage(setMaxSlotsStatus, `Network error setting max slots.`, true);
        setMaxSlotsBtn.disabled = false;
    }
}

// Feature 3: Handle setting max AIN reward pool
async function handleSetMaxAinRewardPool() {
    if (!selectedAdminAccount) {
        updateStatusMessage(setMaxAinRewardPoolStatus, "Admin wallet not connected.", true);
        return;
    }
    const amount = parseFloat(maxAinRewardPoolInput.value);
    if (isNaN(amount) || amount < 0) {
        updateStatusMessage(setMaxAinRewardPoolStatus, "Please enter a non-negative number for AIN pool cap.", true);
        return;
    }

    setMaxAinRewardPoolBtn.disabled = true;
    updateStatusMessage(setMaxAinRewardPoolStatus, `Setting max AIN reward pool to ${amount.toFixed(4)} AIN...`, false);

    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/set-ain-reward-pool`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAdminAccount, newMaxAinRewardPool: amount })
        });
        const data = await response.json();

        if (response.ok) {
            updateStatusMessage(setMaxAinRewardPoolStatus, data.message, false);
            maxAinRewardPoolInput.value = ''; 
            fetchAdminDashboardData(); 
        } else {
            updateStatusMessage(setMaxAinRewardPoolStatus, `Failed to set AIN pool: ${data.message}`, true);
            setMaxAinRewardPoolBtn.disabled = false;
        }
    } catch (error) {
        console.error("Error setting AIN pool:", error);
        updateStatusMessage(setMaxAinRewardPoolStatus, `Network error setting AIN pool.`, true);
        setMaxAinRewardPoolBtn.disabled = false;
    }
}


// Handle toggling all withdrawals pause
async function handleToggleWithdrawalsPause() {
    if (!selectedAdminAccount) {
        updateStatusMessage(toggleWithdrawalsStatus, "Admin wallet not connected.", true);
        return;
    }
    toggleWithdrawalsPauseBtn.disabled = true;
    updateStatusMessage(toggleWithdrawalsStatus, "Toggling withdrawals pause state...", false);

    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/toggle-withdrawals-pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAdminAccount })
        });
        const data = await response.json();

        if (response.ok) {
            updateStatusMessage(toggleWithdrawalsStatus, data.message, false);
            fetchAdminDashboardData(); 
        } else {
            updateStatusMessage(toggleWithdrawalsStatus, `Failed to toggle: ${data.message}`, true);
            toggleWithdrawalsPauseBtn.disabled = false;
        }
    } catch (error) {
        console.error("Error toggling withdrawals pause:", error);
        updateStatusMessage(toggleWithdrawalsStatus, `Network error toggling withdrawals pause.`, true);
        toggleWithdrawalsPauseBtn.disabled = false;
    }
}

// Feature 7: Handle funding a user's balance
async function handleFundUser() {
    if (!selectedAdminAccount) {
        updateStatusMessage(fundUserStatus, "Admin wallet not connected.", true);
        return;
    }

    const targetWalletAddress = fundUserWalletInput.value.trim();
    const tokenType = fundTokenTypeSelect.value;
    const amount = parseFloat(fundAmountInput.value);

    if (!targetWalletAddress || !/^0x[a-fA-F0-9]{40}$/.test(targetWalletAddress)) {
        updateStatusMessage(fundUserStatus, "Please enter a valid target wallet address (0x...).", true);
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        updateStatusMessage(fundUserStatus, "Please enter a positive amount to fund.", true);
        return;
    }

    fundUserBtn.disabled = true;
    updateStatusMessage(fundUserStatus, `Funding ${targetWalletAddress} with ${amount} ${tokenType}...`, false);

    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/fund-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                walletAddress: selectedAdminAccount, 
                targetWalletAddress: targetWalletAddress, 
                tokenType: tokenType, 
                amount: amount 
            })
        });
        const data = await response.json();

        if (response.ok) {
            updateStatusMessage(fundUserStatus, data.message, false);
            fundUserWalletInput.value = '';
            fundAmountInput.value = '';
            fetchUsersLeaderboard(leaderboardSortBy.value); // Refresh leaderboard to show updated balance
        } else {
            updateStatusMessage(fundUserStatus, `Failed to fund user: ${data.message}`, true);
            fundUserBtn.disabled = false;
        }
    } catch (error) {
        console.error("Error funding user:", error);
        updateStatusMessage(fundUserStatus, `Network error funding user.`, true);
        fundUserBtn.disabled = false;
    }
}


// Feature 4: Fetch and display users leaderboard
async function fetchUsersLeaderboard(sortBy = 'referralCount') {
    if (!selectedAdminAccount) {
        updateStatusMessage(leaderboardStatus, "Admin wallet not connected.", true);
        leaderboardTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">Connect wallet to view leaderboard.</td></tr>';
        totalUsersCountDisplay.textContent = '0';
        return;
    }
    updateStatusMessage(leaderboardStatus, "Fetching users leaderboard...", false);
    leaderboardStatus.classList.remove('hidden'); 

    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/users-leaderboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAdminAccount, sortBy: sortBy })
        });
        const data = await response.json();

        if (response.ok) {
            leaderboardStatus.classList.add('hidden'); 
            leaderboardTableBody.innerHTML = ''; 
            totalUsersCountDisplay.textContent = data.users ? data.users.length : '0';

            if (data.users && data.users.length > 0) {
                data.users.forEach(user => {
                    const createdAtDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
                    const row = `
                        <tr>
                            <td class="admin-table-address">${user.walletAddress.substring(0, 6)}...${user.walletAddress.substring(user.walletAddress.length - 4)}</td>
                            <td>${user.referralCount || 0}</td>
                            <td>${(user.BXC_Balance || 0).toFixed(2)}</td>
                            <td>${(user.AIN_Balance || 0).toFixed(4)}</td>
                            <td>$${(user.stakedUSDValue || 0).toFixed(2)}</td>
                            <td>${createdAtDate}</td>
                        </tr>
                    `;
                    leaderboardTableBody.innerHTML += row;
                });
            } else {
                leaderboardTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">No users found.</td></tr>';
            }
        } else {
            updateStatusMessage(leaderboardStatus, `Failed to fetch leaderboard: ${data.message}`, true);
            leaderboardTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">Error fetching data.</td></tr>';
            totalUsersCountDisplay.textContent = '0';
        }
    } catch (error) {
        console.error("Error fetching users leaderboard:", error);
        updateStatusMessage(leaderboardStatus, `Network error fetching leaderboard.`, true);
        leaderboardTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500">Network error.</td></tr>';
        totalUsersCountDisplay.textContent = '0';
    }
}


// --- Wallet Connection Logic ---

const initializeWeb3 = async (provider) => {
    web3 = new Web3(provider);
    console.log("Web3 initialized with provider:", provider);
    return true;
};

const connectAdminWallet = async (walletName, provider) => {
    try {
        if (!provider) {
            updateStatusMessage(walletStatus, `${walletName} is not installed. Please install it.`, true);
            return false;
        }

        await initializeWeb3(provider);
        const accounts = await web3.eth.requestAccounts();
        selectedAdminAccount = accounts[0];
        updateStatusMessage(walletStatus, `Wallet connected. Verifying admin status...`, false);

        const chainSwitched = await switchToBSC();
        if (!chainSwitched) {
            updateStatusMessage(walletStatus, `Please switch to BNB Smart Chain (Chain ID 56) manually.`, true);
            return false;
        }

        walletModal.classList.add('hidden'); 
        
        if (await checkAdminStatus(selectedAdminAccount)) {
            fetchAdminDashboardData(); 
        } else {
            adminMessage.textContent = "Access Denied: Your connected wallet is not an authorized administrator.";
            adminControls.classList.add('hidden');
        }
        return true;

    } catch (error) {
        console.error(`Error connecting admin wallet:`, error);
        updateStatusMessage(walletStatus, `Connection failed for ${walletName}. ${error.message}`, true);
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
        await web3.currentProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_CHAIN_ID }] });
        console.log("Successfully switched to BSC.");
        return true;
    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await web3.currentProvider.request({
                    method: 'wallet_addEthereumChain', params: [{
                        chainId: BSC_CHAIN_ID, chainName: 'BNB Smart Chain',
                        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                        rpcUrls: ['https://bsc-dataseed.binance.org/'], blockExplorerUrls: ['https://bscscan.com/']
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
            case 'metamask': if (window.ethereum && window.ethereum.isMetaMask) { provider = window.ethereum; } break;
            case 'bitget': if (window.bitkeep && window.bitkeep.ethereum) { provider = window.bitkeep.ethereum; } else if (window.ethereum && window.ethereum.isBitKeep) { provider = window.ethereum; } break;
            case 'okx': if (window.okxwallet) { provider = window.okxwallet; } break;
            case 'trust': if (window.ethereum && window.ethereum.isTrust) { provider = window.ethereum; } break;
            default: console.warn("Unknown wallet type:", walletType); break;
        }

        if (provider) {
            await connectAdminWallet(walletType, provider);
        } else {
            updateStatusMessage(walletStatus, `${walletType.charAt(0).toUpperCase() + walletType.slice(1)} is not detected. Please install it.`, true);
        }
    });
});

// Admin specific button listeners
togglePauseBtn.addEventListener('click', handleTogglePause);
setEventDurationBtn.addEventListener('click', handleSetEventDuration); 
setMaxSlotsBtn.addEventListener('click', handleSetMaxSlots); 
setStakingWalletBtn.addEventListener('click', handleSetStakingWalletAddress); 
setStakeAmountBtn.addEventListener('click', handleSetStakeAmount); 
setMaxAinRewardPoolBtn.addEventListener('click', handleSetMaxAinRewardPool); 
fundUserBtn.addEventListener('click', handleFundUser); 
toggleWithdrawalsPauseBtn.addEventListener('click', handleToggleWithdrawalsPause);
refreshLeaderboardBtn.addEventListener('click', () => fetchUsersLeaderboard(leaderboardSortBy.value)); 
leaderboardSortBy.addEventListener('change', () => fetchUsersLeaderboard(leaderboardSortBy.value)); 


// Listen for account/chain changes
if (window.ethereum) {
    window.ethereum.on('accountsChanged', async (accounts) => {
        if (accounts.length === 0) {
            console.log('Admin Wallet disconnected.');
            selectedAdminAccount = null;
            adminMessage.textContent = "Please connect your wallet to verify admin access.";
            adminControls.classList.add('hidden');
            if (adminEventTimerInterval) clearInterval(adminEventTimerInterval); 
        } else {
            selectedAdminAccount = accounts[0];
            console.log('Admin Account changed to:', selectedAdminAccount);
            if (await checkAdminStatus(selectedAdminAccount)) {
                fetchAdminDashboardData();
            } else {
                 adminMessage.textContent = "Access Denied: Your connected wallet is not an authorized administrator.";
                 adminControls.classList.add('hidden');
            }
        }
    });

    window.ethereum.on('chainChanged', async (chainId) => {
        console.log('Chain changed to:', chainId);
        if (web3.utils.toHex(chainId) !== BSC_CHAIN_ID) {
            updateStatusMessage(adminMessage, `Please switch to BNB Smart Chain (Chain ID 56). Current: ${chainId}`, true);
            adminControls.classList.add('hidden');
            if (adminEventTimerInterval) clearInterval(adminEventTimerInterval); 
        } else {
            updateStatusMessage(adminMessage, `Successfully switched to BSC.`, false);
            if (selectedAdminAccount) {
                if (await checkAdminStatus(selectedAdminAccount)) {
                    fetchAdminDashboardData();
                } else {
                     adminMessage.textContent = "Access Denied: Your connected wallet is not an authorized administrator.";
                     adminControls.classList.add('hidden');
                }
            }
        }
    });
}

// Initial Load
document.addEventListener('DOMContentLoaded', async () => {
    if (window.ethereum && window.ethereum.selectedAddress) {
        selectedAdminAccount = window.ethereum.selectedAddress;
        try {
            await initializeWeb3(window.ethereum);
            if (await checkAdminStatus(selectedAdminAccount)) {
                fetchAdminDashboardData();
            }
        } catch (err) {
            console.error("Admin auto-connect init failed:", err);
            adminMessage.textContent = "Auto-connect failed. Please connect wallet manually.";
        }
    }
});
