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
const adminParticipantsCountDisplay = document.getElementById('adminParticipantsCount');
const adminParticipantsProgressBar = document.getElementById('adminParticipantsProgressBar');
const togglePauseBtn = document.getElementById('togglePauseBtn');
const adminActionStatus = document.getElementById('adminActionStatus');


// --- Utility Functions (Copied from app.js, can be a shared utility file later) ---
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

function startAdminEventTimer(endTimeTimestamp, isPaused) {
    if (adminEventTimerInterval) {
        clearInterval(adminEventTimerInterval);
    }

    const eventEndTimeMs = new Date(endTimeTimestamp).getTime();

    adminEventTimerInterval = setInterval(() => {
        const now = new Date().getTime();
        const timeLeft = eventEndTimeMs - now;

        if (timeLeft <= 0 || isPaused) { // Stop/pause timer display if event ended or is paused
            clearInterval(adminEventTimerInterval);
            adminEventTimerDisplay.textContent = isPaused ? "PAUSED" : "00:00:00:00 (ENDED)";
            togglePauseBtn.textContent = "Resume Event"; // Update button if paused or ended
            togglePauseBtn.disabled = isPaused ? false : true; // Can't resume ended event
            return;
        }

        const secondsLeft = Math.floor(timeLeft / 1000);
        adminEventTimerDisplay.textContent = formatTime(secondsLeft);
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
        const response = await fetch(`${BACKEND_URL}/api/status`, { // Re-use general status endpoint
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: selectedAdminAccount }) // Pass admin wallet for user-specific data
        });
        const data = await response.json();

        if (response.ok) {
            const globalData = data.global;
            const participantsTotalSlots = globalData.MAX_STAKE_SLOTS; // Get total from global data
            const stakedSlots = globalData.totalSlotsUsed || 0;
            const percentage = (stakedSlots / participantsTotalSlots) * 100;

            adminParticipantsCountDisplay.textContent = `${stakedSlots}/${participantsTotalSlots}`;
            adminParticipantsProgressBar.style.width = `${percentage}%`;

            // Display timer
            if (globalData.eventEndTime) {
                // Check for new isPaused field from backend (will add this to backend later)
                const isEventPaused = globalData.isPaused || false; 
                startAdminEventTimer(globalData.eventEndTime, isEventPaused);
                togglePauseBtn.textContent = isEventPaused ? "Resume Event" : "Pause Event";
                togglePauseBtn.disabled = false; // Enable if timer valid
            } else {
                adminEventTimerDisplay.textContent = "No Event Set";
                togglePauseBtn.disabled = true;
            }

            return data; // Return full data if needed by other admin functions
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


// --- Wallet Connection Logic (Copied from app.js, with admin-specific selectedAccount variable) ---

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

        walletModal.classList.add('hidden'); // Close modal on success
        
        // After successful connection and chain switch, verify admin status
        if (await checkAdminStatus(selectedAdminAccount)) {
            fetchAdminDashboardData(); // Fetch dashboard data if admin
        } else {
            // Not an admin, clear message or redirect
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
                    method: 'wallet_addEthereumChain',
                    params: [{
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
            adminControls.classList.add('hidden'); // Hide controls if on wrong chain
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
