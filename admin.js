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

// Backend URL (THIS IS NOW SET TO YOUR PROVIDED LINK)
const BACKEND_URL = 'https://bxc-backend-1dkpqw.fly.dev'; // <<<--- YOUR ACTUAL BACKEND URL IS HERE

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

// Fund User Elements (UPDATED)
const fundUserOptionSelect = document.getElementById('fundUserOptionSelect');
const selectedUserFundInputContainer = document.getElementById('selectedUserFundInputContainer');
const fundUserWalletInput = document.getElementById('fundUserWalletInput'); 
const fundAmountInput = document.getElementById('fundAmountInput');         
const fundTokenTypeSelect = document.getElementById('fundTokenTypeSelect'); 
const fundUserBtn = document.getElementById('fundUserBtn');                 
const fundUserStatus = document.getElementById('fundUserStatus');           
const fundUserOptionMessage = document.getElementById('fundUserOptionMessage');

// Reset User Elements (UPDATED)
const resetUserOptionSelect = document.getElementById('resetUserOptionSelect');
const selectedUserResetInputContainer = document.getElementById('selectedUserResetInputContainer');
const targetUserWalletToResetInput = document.getElementById('targetUserWalletToResetInput');
const resetUserStakeBtn = document.getElementById('resetUserStakeBtn');
const resetUserStakeStatus = document.getElementById('resetUserStakeStatus');
const resetUserOptionMessage = document.getElementById('resetUserOptionMessage');

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
    console.log(`[Status Update] Element: ${element.id || 'unknown'}, Message: ${message}, IsError: ${isError}`); 
    element.textContent = message;
    element.classList.remove('hidden', 'text-green-500', 'text-red-500');
    element.classList.add(isError ? 'text-red-500' : 'text-green-500');
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
    console.log("Attempting to fetch admin dashboard data from:", `${BACKEND_URL}/api/status`);
    updateStatusMessage(adminMessage, `Loading dashboard data...`, false); 

    try {
        const response = await fetch(`${BACKEND_URL}/api/status`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAdminAccount }) 
        });

        console.log("Raw response from /api/status:", response);
        console.log(`Response Status: ${response.status}, Status Text: ${response.statusText}`);

        if (!response.ok) { 
            const errorData = await response.json().catch(() => ({ message: 'No JSON response' }));
            console.error("Response not OK for /api/status:", errorData);
            updateStatusMessage(adminMessage, `Failed to load dashboard data: ${errorData.message || response.statusText || 'Unknown error'}. Status: ${response.status}`, true);
            return null;
        }

        const data = await response.json();
        console.log("Parsed data from /api/status:", data);

        const globalData = data.global;

        updateStatusMessage(adminMessage, `Access Granted!`, false); 

        totalConnectedWalletsDisplay.textContent = globalData.totalConnectedWallets || 0;

        const participantsTotalSlots = globalData.maxStakeSlots || 30000; 
        const stakedSlots = globalData.totalSlotsUsed || 0;
        const percentage = (stakedSlots / participantsTotalSlots) * 100;

        adminParticipantsCountDisplay.textContent = `${stakedSlots}/${participantsTotalSlots}`;
        adminParticipantsProgressBar.style.width = `${percentage}%`;

        if (globalData.eventEndTime) {
            const isEventPaused = globalData.isPaused || false; 
            const eventStartTime = globalData.eventStartTime; 
            startAdminEventTimer(globalData.eventEndTime, isEventPaused, eventStartTime);
        } else {
            adminEventTimerDisplay.textContent = "No Event Set";
            togglePauseBtn.disabled = true;
            eventTimerLabel.textContent = "Event Status";
        }

        const withdrawalsPaused = globalData.withdrawalsPaused || false;
        withdrawalsStatusDisplay.textContent = withdrawalsPaused ? "Paused" : "Active";
        withdrawalsStatusDisplay.classList.toggle('text-red-500', withdrawalsPaused);
        withdrawalsStatusDisplay.classList.toggle('text-green-600', !withdrawalsPaused); 
        toggleWithdrawalsPauseBtn.textContent = withdrawalsPaused ? "Resume All Withdrawals" : "Pause All Withdrawals";
        toggleWithdrawalsPauseBtn.disabled = false;

        currentStakingWalletDisplay.textContent = globalData.stakingRecipientAddress ? 
            `${globalData.stakingRecipientAddress.substring(0, 6)}...${globalData.stakingRecipientAddress.substring(globalData.stakingRecipientAddress.length - 4)}` : 'Not Set';
        
        currentStakeAmountDisplay.textContent = (globalData.initialStakeAmountUSD || 0).toFixed(2);

        currentMaxSlotsDisplay.textContent = globalData.maxStakeSlots || 0;

        currentMaxAinRewardPoolDisplay.textContent = (globalData.maxAinRewardPool || 0).toFixed(0);
        totalAinRewardedDisplay.textContent = (globalData.totalAinRewarded || 0).toFixed(4);

        fetchUsersLeaderboard(leaderboardSortBy.value); 
        return data;
    } catch (error) {
        console.error("Network or parsing error fetching admin dashboard data:", error);
        updateStatusMessage(adminMessage, `Network error loading admin dashboard data. Please ensure backend is running and URL in admin.js is correct. Error: ${error.message}`, true);
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

// Feature 7: Handle funding a user's balance (UPDATED for dropdown)
async function handleFundUser() {
    if (!selectedAdminAccount) {
        updateStatusMessage(fundUserStatus, "Admin wallet not connected.", true);
        return;
    }

    const fundOption = fundUserOptionSelect.value;
    const tokenType = fundTokenTypeSelect.value;
    const amount = parseFloat(fundAmountInput.value);

    if (isNaN(amount) || amount <= 0) {
        updateStatusMessage(fundUserStatus, "Please enter a positive amount to fund.", true);
        return;
    }
    
    // Check if 'All Users' is selected for funding (not allowed for safety)
    if (fundOption === 'all') {
        updateStatusMessage(fundUserStatus, "Mass funding is not supported via this option for safety reasons. Please select 'Selected User'.", true);
        fundUserBtn.disabled = false; // Re-enable button
        return;
    }

    const targetWalletAddress = fundUserWalletInput.value.trim();
    if (!targetWalletAddress || !/^0x[a-fA-F0-9]{40}$/.test(targetWalletAddress)) {
        updateStatusMessage(fundUserStatus, "Please enter a valid target wallet address (0x...).", true);
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
            fetchUsersLeaderboard(leaderboardSortBy.value); // Refresh leaderboard after funding
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

// Handle resetting a user's staking profile (UPDATED for dropdown)
async function handleResetUserStake() {
    if (!selectedAdminAccount) {
        updateStatusMessage(resetUserStakeStatus, "Admin wallet not connected.", true);
        return;
    }

    const resetOption = resetUserOptionSelect.value;

    resetUserStakeBtn.disabled = true;
    updateStatusMessage(resetUserStakeStatus, `Processing reset request...`, false);

    try {
        let apiUrl = '';
        let requestBody = {};

        if (resetOption === 'all') {
            apiUrl = `${BACKEND_URL}/api/admin/reset-all-user-stakes`;
            requestBody = { walletAddress: selectedAdminAccount };
            updateStatusMessage(resetUserStakeStatus, `Resetting ALL users' staking profiles... This may take a moment.`, false);
        } else { // 'selected' option
            const targetWalletAddress = targetUserWalletToResetInput.value.trim();
            if (!targetWalletAddress || !/^0x[a-fA-F0-9]{40}$/.test(targetWalletAddress)) {
                updateStatusMessage(resetUserStakeStatus, "Please enter a valid user wallet address (0x...) or select 'All Users'.", true);
                resetUserStakeBtn.disabled = false;
                return;
            }
            apiUrl = `${BACKEND_URL}/api/admin/reset-user-profile`;
            requestBody = {
                adminWalletAddress: selectedAdminAccount,
                targetWalletAddress: targetWalletAddress
            };
            updateStatusMessage(resetUserStakeStatus, `Resetting staking profile for ${targetWalletAddress}...`, false);
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        const data = await response.json();

        if (response.ok) {
            updateStatusMessage(resetUserStakeStatus, data.message, false);
            if (resetOption === 'selected') {
                targetUserWalletToResetInput.value = ''; // Clear input on success for selected user
            }
            fetchAdminDashboardData(); // Refresh dashboard data to reflect changes
        } else {
            updateStatusMessage(resetUserStakeStatus, `Failed to reset: ${data.message}`, true);
            resetUserStakeBtn.disabled = false;
        }
    } catch (error) {
        console.error("Error during reset operation:", error);
        updateStatusMessage(resetUserStakeStatus, `Network error during reset.`, true);
        resetUserStakeBtn.disabled = false;
    }
}


// Feature 4: Fetch and display users leaderboard
async function fetchUsersLeaderboard(sortBy = 'referralCount') {
    if (!selectedAdminAccount) {
        updateStatusMessage(leaderboardStatus, "Admin wallet not connected.", true);
        // Corrected colspan for empty state when admin wallet is not connected
        leaderboardTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500">Connect wallet to view leaderboard.</td></tr>';
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
                            <td class="py-2 px-3 admin-table-address">${user.walletAddress.substring(0, 6)}...${user.walletAddress.substring(user.walletAddress.length - 4)}</td>
                            <td class="py-2 px-3">${user.referralCount || 0}</td>
                            <td class="py-2 px-3">${(user.BXC_Balance || 0).toFixed(2)}</td>
                            <td class="py-2 px-3">${(user.AIN_Balance || 0).toFixed(4)}</td>
                            <td class="py-2 px-3">$${(user.stakedUSDValue || 0).toFixed(2)}</td>
                            <td class="py-2 px-3">${createdAtDate}</td>
                            <td class="py-2 px-3">
                                <button class="select-user-btn bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1 px-2 rounded" data-wallet="${user.walletAddress}">Select</button>
                            </td>
                        </tr>
                    `;
                    leaderboardTableBody.innerHTML += row;
                });
            } else {
                leaderboardTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No users found.</td></tr>'; 
            }
        } else {
            updateStatusMessage(leaderboardStatus, `Failed to fetch leaderboard: ${data.message}`, true);
            leaderboardTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500">Error fetching data.</td></tr>'; 
            totalUsersCountDisplay.textContent = '0';
        }
    } catch (error) {
        console.error("Error fetching users leaderboard:", error);
        updateStatusMessage(leaderboardStatus, `Network error fetching leaderboard.`, true);
        leaderboardTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500">Network error.</td></tr>'; 
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
        
        connectWalletBtn.textContent = `Connected: ${selectedAdminAccount.substring(0, 6)}...${selectedAdminAccount.substring(selectedAdminAccount.length - 4)}`;
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
            connectWalletBtn.textContent = 'Connect Admin Wallet'; 
            adminMessage.textContent = "Access Denied: Your connected wallet is not an authorized administrator.";
            adminControls.classList.add('hidden');
        }
        return true;

    } catch (error) {
        console.error(`Error connecting admin wallet:`, error);
        updateStatusMessage(walletStatus, `Connection failed for ${walletName}. ${error.message}`, true);
        connectWalletBtn.textContent = 'Connect Admin Wallet'; 
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
resetUserStakeBtn.addEventListener('click', handleResetUserStake); 

// Listener for Reset User Option Select (ADDED)
resetUserOptionSelect.addEventListener('change', () => {
    const selectedOption = resetUserOptionSelect.value;
    if (selectedOption === 'all') {
        selectedUserResetInputContainer.classList.add('hidden');
        resetUserOptionMessage.textContent = "Staking profiles for ALL users will be reset.";
        resetUserOptionMessage.classList.remove('hidden');
        targetUserWalletToResetInput.value = ''; // Clear input when "All Users" is selected
        resetUserStakeBtn.textContent = "Reset ALL Users' Stakes (Caution!)";
        resetUserStakeStatus.classList.add('hidden'); // Clear status message
    } else { // selected
        selectedUserResetInputContainer.classList.remove('hidden');
        resetUserOptionMessage.classList.add('hidden');
        resetUserStakeBtn.textContent = "Reset Selected User";
        resetUserStakeStatus.classList.add('hidden'); // Clear status message
    }
});

// Listener for Fund User Option Select (ADDED)
fundUserOptionSelect.addEventListener('change', () => {
    const selectedOption = fundUserOptionSelect.value;
    if (selectedOption === 'all') {
        selectedUserFundInputContainer.classList.add('hidden');
        fundUserOptionMessage.textContent = "Warning: Mass funding is generally NOT recommended. Only 'Selected User' is supported for funding.";
        fundUserOptionMessage.classList.remove('hidden');
        fundUserWalletInput.value = ''; // Clear input
        fundAmountInput.value = ''; // Clear amount
        fundUserBtn.textContent = "Fund (Select Specific User)";
        fundUserBtn.disabled = true; // Disable button for mass funding
        fundUserStatus.classList.add('hidden'); // Clear status message
    } else { // selected
        selectedUserFundInputContainer.classList.remove('hidden');
        fundUserOptionMessage.classList.add('hidden');
        fundUserBtn.textContent = "Fund Selected User";
        fundUserBtn.disabled = false; // Re-enable button
        fundUserStatus.classList.add('hidden'); // Clear status message
    }
});


// Add event listener for selecting a user from the leaderboard table using event delegation
leaderboardTableBody.addEventListener('click', (event) => {
    const targetButton = event.target.closest('.select-user-btn');
    if (targetButton) {
        const walletAddress = targetButton.dataset.wallet;
        if (walletAddress) {
            // Check current selection option and set input/dropdown
            if (resetUserOptionSelect.value !== 'selected') {
                resetUserOptionSelect.value = 'selected';
                resetUserOptionSelect.dispatchEvent(new Event('change')); // Trigger change to show input
            }
            targetUserWalletToResetInput.value = walletAddress; // Populate the reset input
            updateStatusMessage(resetUserStakeStatus, `Selected wallet for reset: ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`, false);
            
            if (fundUserOptionSelect.value !== 'selected') {
                fundUserOptionSelect.value = 'selected';
                fundUserOptionSelect.dispatchEvent(new Event('change')); // Trigger change to show input
            }
            fundUserWalletInput.value = walletAddress;           // Also populate the fund user input for convenience
            updateStatusMessage(fundUserStatus, `Selected wallet for funding: ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`, false);
        }
    }
});


// Listen for account/chain changes
if (window.ethereum) {
    window.ethereum.on('accountsChanged', async (accounts) => {
        console.log('accountsChanged event fired:', accounts); // Debug log
        if (accounts.length === 0) {
            console.log('Admin Wallet disconnected.');
            selectedAdminAccount = null;
            connectWalletBtn.textContent = 'Connect Admin Wallet'; 
            adminMessage.textContent = "Please connect your wallet to verify admin access.";
            adminControls.classList.add('hidden');
            if (adminEventTimerInterval) clearInterval(adminEventTimerInterval); 
        } else {
            selectedAdminAccount = accounts[0];
            console.log('Admin Account changed to:', selectedAdminAccount);
            connectWalletBtn.textContent = `Connected: ${selectedAdminAccount.substring(0, 6)}...${selectedAdminAccount.substring(selectedAdminAccount.length - 4)}`; 
            if (await checkAdminStatus(selectedAdminAccount)) {
                fetchAdminDashboardData();
            } else {
                 adminMessage.textContent = "Access Denied: Your connected wallet is not an authorized administrator.";
                 adminControls.classList.add('hidden');
            }
        }
    });

    window.ethereum.on('chainChanged', async (chainId) => {
        console.log('chainChanged event fired:', chainId); // Debug log
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

// Initial Load / Auto-connect logic (Revised for robustness)
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize dropdowns to their default "selected" state
    resetUserOptionSelect.dispatchEvent(new Event('change'));
    fundUserOptionSelect.dispatchEvent(new Event('change'));

    // Check if a Web3 provider (like MetaMask) is available
    if (window.ethereum) {
        try {
            await initializeWeb3(window.ethereum);

            // Using eth_accounts for passive check, requestAccounts for active prompt
            const accounts = await web3.eth.getAccounts(); 
            if (accounts.length > 0) {
                selectedAdminAccount = accounts[0];
                console.log("Auto-connected account:", selectedAdminAccount);
                connectWalletBtn.textContent = `Connected: ${selectedAdminAccount.substring(0, 6)}...${selectedAdminAccount.substring(selectedAdminAccount.length - 4)}`;
                
                if (await checkAdminStatus(selectedAdminAccount)) {
                    fetchAdminDashboardData();
                } else {
                    connectWalletBtn.textContent = 'Connect Admin Wallet'; 
                    adminMessage.textContent = "Access Denied: Your connected wallet is not an authorized administrator.";
                    adminControls.classList.add('hidden');
                }
            } else {
                console.log("No account pre-connected, ready for manual connection.");
                connectWalletBtn.textContent = 'Connect Admin Wallet'; 
                adminMessage.textContent = "Please connect your wallet to verify admin access.";
                adminControls.classList.add('hidden');
            }
        } catch (err) {
            console.error("Admin auto-connect init failed:", err);
            adminMessage.textContent = "Auto-connect failed. Please connect wallet manually. Error: " + err.message;
            adminMessage.classList.remove('hidden');
            adminMessage.classList.add('text-red-500');
            connectWalletBtn.textContent = 'Connect Admin Wallet'; 
        }
    } else {
        console.warn("No Ethereum provider (like MetaMask) detected.");
        adminMessage.textContent = "No Web3 wallet detected. Please install MetaMask or a compatible browser extension.";
        adminMessage.classList.remove('hidden');
        adminMessage.classList.add('text-red-500');
        connectWalletBtn.disabled = true; 
    }
});
