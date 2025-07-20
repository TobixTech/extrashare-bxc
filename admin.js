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

// Backend URL (Crucial: ENSURE THIS EXACTLY MATCHES YOUR DEPLOYED BACKEND URL)
const BACKEND_URL = 'https://bxc-backend-1dkpqw.fly.dev'; // EXAMPLE: Replace with your actual deployed backend URL

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

const adminEventTimerDisplay = document.getElementById('adminEventTimer');
const eventTimerLabel = document.getElementById('eventTimerLabel'); // NEW: For "Ends In" / "Paused"
const adminParticipantsCountDisplay = document.getElementById('adminParticipantsCount');
const adminParticipantsProgressBar = document.getElementById('adminParticipantsProgressBar');

// Admin Action Buttons
const togglePauseBtn = document.getElementById('togglePauseBtn');
const togglePauseStatus = document.getElementById('togglePauseStatus'); // For status messages

const newEventDurationInput = document.getElementById('newEventDurationInput');
const setEventTimeBtn = document.getElementById('setEventTimeBtn');
const setEventTimeStatus = document.getElementById('setEventTimeStatus');

const withdrawalsStatusDisplay = document.getElementById('withdrawalsStatusDisplay');
const toggleWithdrawalsPauseBtn = document.getElementById('toggleWithdrawalsPauseBtn');
const toggleWithdrawalsStatus = document.getElementById('toggleWithdrawalsStatus');

const leaderboardSortBy = document.getElementById('leaderboardSortBy');
const refreshLeaderboardBtn = document.getElementById('refreshLeaderboardBtn');
const leaderboardTableBody = document.getElementById('leaderboardTableBody');
const leaderboardStatus = document.getElementById('leaderboardStatus');


// --- Utility Functions ---
function updateStatusMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.remove('hidden', 'text-green-500', 'text-red-500');
    element.classList.add(isError ? 'text-red-500' : 'text-green-500');
    console.log(`Admin Status update: ${message}`);
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
    const eventStartTimeMs = new Date(eventStartTime).getTime(); // New: to check if event has genuinely started

    // If already paused, display PAUSED and stop timer
    if (isPaused) {
        adminEventTimerDisplay.textContent = "PAUSED";
        eventTimerLabel.textContent = "Event Status";
        togglePauseBtn.textContent = "Resume Event";
        togglePauseBtn.disabled = false;
        return;
    }

    // If event hasn't genuinely started yet (e.g. before first stake if logic dictates)
    if (new Date().getTime() < eventStartTimeMs) {
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
            body: JSON.stringify({ walletAddress: selectedAdminAccount })
        });
        const data = await response.json();

        if (response.ok) {
            const globalData = data.global;
            const participantsTotalSlots = globalData.MAX_STAKE_SLOTS;
            const stakedSlots = globalData.totalSlotsUsed || 0;
            const percentage = (stakedSlots / participantsTotalSlots) * 100;

            adminParticipantsCountDisplay.textContent = `${stakedSlots}/${participantsTotalSlots}`;
            adminParticipantsProgressBar.style.width = `${percentage}%`;

            // Display timer
            if (globalData.eventEndTime) {
                const isEventPaused = globalData.isPaused || false; 
                const eventStartTime = globalData.eventStartTime; // Pass eventStartTime
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


            fetchUsersLeaderboard(leaderboardSortBy.value); // Fetch leaderboard on dashboard load
            return data;
        } else {
            updateStatusMessage(adminActionStatus, `Failed to load dashboard data: ${data.message}`, true);
            return null;
        }
    } catch (error) {
        console.error("Error fetching admin dashboard data:", error);
        updateStatusMessage(adminActionStatus, `Network error loading admin dashboard data.`, true);
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
            fetchAdminDashboardData(); // Refresh admin UI to reflect new state
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

// NEW FUNCTION: Handle setting new event time
async function handleSetEventTime() {
    if (!selectedAdminAccount) {
        updateStatusMessage(setEventTimeStatus, "Admin wallet not connected.", true);
        return;
    }
    const durationHours = parseFloat(newEventDurationInput.value);
    if (isNaN(durationHours) || durationHours <= 0) {
        updateStatusMessage(setEventTimeStatus, "Please enter a valid positive number for duration (hours).", true);
        return;
    }

    setEventTimeBtn.disabled = true;
    updateStatusMessage(setEventTimeStatus, `Setting new event duration to ${durationHours} hours...`, false);

    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/set-event-time`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAdminAccount, durationHours: durationHours })
        });
        const data = await response.json();

        if (response.ok) {
            updateStatusMessage(setEventTimeStatus, data.message, false);
            newEventDurationInput.value = ''; // Clear input
            fetchAdminDashboardData(); // Refresh admin UI to show new timer
        } else {
            updateStatusMessage(setEventTimeStatus, `Failed to set event time: ${data.message}`, true);
            setEventTimeBtn.disabled = false;
        }
    } catch (error) {
        console.error("Error setting event time:", error);
        updateStatusMessage(setEventTimeStatus, `Network error setting event time.`, true);
        setEventTimeBtn.disabled = false;
    }
}

// NEW FUNCTION: Handle toggling all withdrawals pause
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
            fetchAdminDashboardData(); // Refresh admin UI to reflect new state
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

// NEW FUNCTION: Fetch and display users leaderboard
async function fetchUsersLeaderboard(sortBy = 'referralCount') {
    if (!selectedAdminAccount) {
        updateStatusMessage(leaderboardStatus, "Admin wallet not connected.", true);
        leaderboardTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500">Connect wallet to view leaderboard.</td></tr>';
        return;
    }
    updateStatusMessage(leaderboardStatus, "Fetching users leaderboard...", false);
    leaderboardStatus.classList.remove('hidden'); // Show status

    try {
        const response = await fetch(`${BACKEND_URL}/api/admin/users-leaderboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAdminAccount, sortBy: sortBy })
        });
        const data = await response.json();

        if (response.ok) {
            leaderboardStatus.classList.add('hidden'); // Hide status on success
            leaderboardTableBody.innerHTML = ''; // Clear previous data
            if (data.users && data.users.length > 0) {
                data.users.forEach(user => {
                    const row = `
                        <tr>
                            <td class="font-mono">${user.walletAddress.substring(0, 6)}...${user.walletAddress.substring(user.walletAddress.length - 4)}</td>
                            <td>${user.referralCount || 0}</td>
                            <td>${(user.BXC_Balance || 0).toFixed(2)}</td>
                            <td>${(user.AIN_Balance || 0).toFixed(2)}</td>
                            <td>$${(user.stakedUSDValue || 0).toFixed(2)}</td>
                        </tr>
                    `;
                    leaderboardTableBody.innerHTML += row;
                });
            } else {
                leaderboardTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500">No users found.</td></tr>';
            }
        } else {
            updateStatusMessage(leaderboardStatus, `Failed to fetch leaderboard: ${data.message}`, true);
            leaderboardTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500">Error fetching data.</td></tr>';
        }
    } catch (error) {
        console.error("Error fetching users leaderboard:", error);
        updateStatusMessage(leaderboardStatus, `Network error fetching leaderboard.`, true);
        leaderboardTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500">Network error.</td></tr>';
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
setEventTimeBtn.addEventListener('click', handleSetEventTime);
toggleWithdrawalsPauseBtn.addEventListener('click', handleToggleWithdrawalsPause);
refreshLeaderboardBtn.addEventListener('click', () => fetchUsersLeaderboard(leaderboardSortBy.value)); // Refresh button
leaderboardSortBy.addEventListener('change', () => fetchUsersLeaderboard(leaderboardSortBy.value)); // Sort by dropdown


// Listen for account/chain changes
if (window.ethereum) {
    window.ethereum.on('accountsChanged', async (accounts) => {
        if (accounts.length === 0) {
            console.log('Admin Wallet disconnected.');
            selectedAdminAccount = null;
            adminMessage.textContent = "Please connect your wallet to verify admin access.";
            adminControls.classList.add('hidden');
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
            updateStatusMessage(adminActionStatus, `Please switch to BNB Smart Chain (Chain ID 56). Current: ${chainId}`, true);
            adminControls.classList.add('hidden');
        } else {
            updateStatusMessage(adminActionStatus, `Successfully switched to BSC.`, false);
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
