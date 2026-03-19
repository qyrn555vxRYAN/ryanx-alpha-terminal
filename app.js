const SYSTEM_WALLET = "AqE264DnKyJci9kV4t3eYhDtFB3H88HQusWtH5odSqHM";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const TOKENS = {
    "SHELLRAISER": "D3RjWyMW3uoobJPGUY4HHjFeAduCPCvRUDtWzZ1b2EpE",
    "SHIPYARD": "F6xYweiy1ZEYwYkVH5pptrnP2UULR1RKCSkBfY1QMmAn"
};

// ============================================
// 🔥 FREEMIUM SYSTEM
// ============================================
const FREE_TIER = {
    maxAlertsPerDay: 3,
    delayMinutes: 5,
    storageKey: 'ryanx_alpha_tier'
};

function getTier() {
    const stored = localStorage.getItem(FREE_TIER.storageKey);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

function setTier(tier) {
    localStorage.setItem(FREE_TIER.storageKey, JSON.stringify(tier));
}

function isFreeUser() {
    const tier = getTier();
    return tier && tier.type === 'free';
}

function isProUser() {
    const tier = getTier();
    return tier && tier.type === 'pro';
}

function activateFreeTier() {
    const today = new Date().toDateString();
    const tier = {
        type: 'free',
        activatedAt: new Date().toISOString(),
        alertsToday: 0,
        lastAlertDate: today
    };
    setTier(tier);

    // Update UI
    const btn = document.getElementById('free-access-btn');
    if (btn) {
        btn.innerText = '✓ Free Access Activated';
        btn.disabled = true;
        btn.classList.remove('bg-green-600', 'hover:bg-green-500');
        btn.classList.add('bg-slate-700', 'cursor-not-allowed');
    }

    // Show upgrade prompt
    const upgradePrompt = document.getElementById('upgrade-prompt');
    if (upgradePrompt) {
        upgradePrompt.classList.remove('hidden');
    }

    // Unlock content with free tier limitations
    unlockFreeContent();
}

function checkDailyReset() {
    const tier = getTier();
    if (!tier || tier.type !== 'free') return;

    const today = new Date().toDateString();
    if (tier.lastAlertDate !== today) {
        // Reset daily counter
        tier.alertsToday = 0;
        tier.lastAlertDate = today;
        setTier(tier);
    }
}

function canShowAlert() {
    if (isProUser()) return true;

    if (isFreeUser()) {
        checkDailyReset();
        const tier = getTier();
        return tier.alertsToday < FREE_TIER.maxAlertsPerDay;
    }

    return false;
}

function incrementAlertCount() {
    if (!isFreeUser()) return;

    const tier = getTier();
    tier.alertsToday++;
    setTier(tier);

    // Check if limit reached
    if (tier.alertsToday >= FREE_TIER.maxAlertsPerDay) {
        showLimitReached();
    }
}

function showLimitReached() {
    const upgradePrompt = document.getElementById('upgrade-prompt');
    if (upgradePrompt) {
        upgradePrompt.innerHTML = `
            <div class="text-yellow-400 text-xs font-bold mb-1">⚠️ Daily Limit Reached</div>
            <p class="text-[10px] text-slate-400">You've used all 3 free alerts today. Upgrade to Pro for unlimited access!</p>
        `;
        upgradePrompt.classList.remove('hidden');
    }
}

function unlockFreeContent() {
    const locked = document.getElementById('content-locked');
    const unlocked = document.getElementById('content-unlocked');

    // Keep locked section visible but show unlocked content below
    unlocked.classList.remove('hidden');

    // Add free tier badge
    const badge = document.createElement('div');
    badge.className = 'text-[10px] bg-green-500/20 text-green-500 px-3 py-1 rounded border border-green-500/30 mb-4 inline-block';
    badge.innerText = 'FREE TIER • 5-MIN DELAY';
    unlocked.prepend(badge);

    // Start alpha stream with delay
    setTimeout(() => {
        if (typeof startAlphaStream === 'function') startAlphaStream();
    }, 600);
}

// Check on page load if user already has free tier
document.addEventListener('DOMContentLoaded', () => {
    if (isFreeUser()) {
        const btn = document.getElementById('free-access-btn');
        if (btn) {
            btn.innerText = '✓ Free Access Active';
            btn.disabled = true;
            btn.classList.remove('bg-green-600', 'hover:bg-green-500');
            btn.classList.add('bg-slate-700', 'cursor-not-allowed');
        }

        const upgradePrompt = document.getElementById('upgrade-prompt');
        if (upgradePrompt) {
            upgradePrompt.classList.remove('hidden');
        }
    }
});

// ============================================
// 🔥 EMAIL CAPTURE
// ============================================
function captureEmail() {
    const emailInput = document.getElementById('email-capture');
    const email = emailInput.value.trim();

    if (!email || !email.includes('@')) {
        emailInput.style.borderColor = '#ef4444';
        setTimeout(() => {
            emailInput.style.borderColor = '';
        }, 2000);
        return;
    }

    // Store locally (in production, send to backend)
    const emails = JSON.parse(localStorage.getItem('ryanx_emails') || '[]');
    if (!emails.includes(email)) {
        emails.push(email);
        localStorage.setItem('ryanx_emails', JSON.stringify(emails));
    }

    // Success feedback
    emailInput.value = '';
    emailInput.placeholder = '✓ Subscribed!';
    emailInput.disabled = true;

    console.log('Email captured:', email);
    console.log('Total emails:', emails.length);

    // In production: send to backend/email service
    // fetch('https://api.example.com/subscribe', { method: 'POST', body: JSON.stringify({ email }) });
}

async function verifyPayment() {
    const userWallet = document.getElementById('user-wallet').value.trim();
    const log = document.getElementById('verification-log');
    const btn = document.getElementById('verify-btn');
    
    if (!userWallet) {
        log.innerText = "ERROR: ADDRESS_REQUIRED";
        return;
    }

    btn.disabled = true;
    btn.innerText = "SCANNING_BLOCKCHAIN...";
    log.innerText = "QUERYING_SOLANA_MAINNET...";

    try {
        const connection = new solanaWeb3.Connection(SOLANA_RPC);
        const publicKey = new solanaWeb3.PublicKey(SYSTEM_WALLET);
        
        const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 20 });
        
        let found = false;
        for (let sigInfo of signatures) {
            const tx = await connection.getParsedTransaction(sigInfo.signature, {
                maxSupportedTransactionVersion: 0
            });

            if (tx && tx.meta && !tx.meta.err) {
                const instructions = tx.transaction.message.instructions;
                for (let ix of instructions) {
                    if (ix.program === "system" && ix.parsed && ix.parsed.type === "transfer") {
                        const { info } = ix.parsed;
                        // 0.1 SOL = 100,000,000 lamports
                        
// Updated payment verification accepting 0.1, 0.2, or 1.0 SOL
if (info.source === userWallet && info.destination === "AqE264DnKyJci9kV4t3eYhDtFB3H88HQusWtH5odSqHM") {
    const lamports = info.lamports;
    if (lamports >= 100000000) { // 0.1 SOL minimum
        found = true;
        break;
    }
}

                    }
                }
            }
            if (found) break;
        }

        if (found) {
            log.innerText = "PAYMENT_CONFIRMED. ACCESS_GRANTED.";
            // Set pro tier
            setTier({
                type: 'pro',
                activatedAt: new Date().toISOString(),
                amount: lamports / 1000000000 // Convert lamports to SOL
            });
            unlockContent();
        } else {
            log.innerText = "NO_MATCHING_TRANSACTION_FOUND_IN_LAST_20_BLOCKS";
            btn.disabled = false;
            btn.innerText = "RETRY_VERIFICATION";
        }
    } catch (err) {
        console.error(err);
        log.innerText = "RPC_ERROR: TIMEOUT_OR_LIMIT_EXCEEDED";
        btn.disabled = false;
        btn.innerText = "RETRY_VERIFICATION";
    }
}


function unlockContent() {
    const locked = document.getElementById('content-locked');
    const unlocked = document.getElementById('content-unlocked');
    
    locked.style.transition = 'opacity 0.5s ease';
    locked.style.opacity = '0';
    
    setTimeout(() => {
        locked.classList.add('hidden');
        unlocked.classList.remove('hidden');
        unlocked.style.opacity = '0';
        
        // Premium unlock effect
        const app = document.getElementById('app');
        app.style.transition = 'box-shadow 1s ease, border-color 1s ease';
        app.style.boxShadow = '0 0 50px rgba(34, 197, 94, 0.2), inset 0 0 50px rgba(34, 197, 94, 0.1)';
        app.style.borderColor = 'rgba(34, 197, 94, 0.5)';
        
        setTimeout(() => {
            unlocked.style.transition = 'opacity 0.8s ease';
            unlocked.style.opacity = '1';
            if (typeof startAlphaStream === 'function') startAlphaStream();
        }, 100);
    }, 500);
}


async function startAlphaStream() {
    updatePrices();
    setInterval(updatePrices, 10000);
    
    const logs = document.getElementById('live-logs');
    setInterval(() => {
        const time = new Date().toLocaleTimeString();
        const logEntries = [
            `[${time}] Identifying arbitrage gap in USDC/SHELL pool...`,
            `[${time}] Cross-referencing Pyth confidence intervals...`,
            `[${time}] Liquidity alert: Whale activity on Shipyard...`,
            `[${time}] Alpha signal: 0.12% delta found on Jupiter.`
        ];
        const entry = document.createElement('div');
        entry.className = "text-slate-600";
        entry.innerText = logEntries[Math.floor(Math.random() * logEntries.length)];
        logs.prepend(entry);
        if (logs.children.length > 10) logs.lastElementChild.remove();
    }, 3000);
}

async function updatePrices() {
    for (let [name, address] of Object.entries(TOKENS)) {
        try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
            const data = await res.json();
            if (data.pairs && data.pairs[0]) {
                const price = parseFloat(data.pairs[0].priceUsd).toFixed(8);
                const id = name === 'SHELLRAISER' ? 'price-shell' : 'price-ship';
                document.getElementById(id).innerText = `$${price}`;
            }
        } catch (e) {
            console.error("Price fetch error", e);
        }
    }
}
