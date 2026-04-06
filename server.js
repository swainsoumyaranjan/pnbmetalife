const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use(express.static('./'));

const TELEGRAM_BOT_TOKEN = '8648940054:AAH6iqlrVYfyIbw5WdF3RwkGLVGIEC736qI';
const TELEGRAM_CHAT_ID = '8658517089';

// Store pending payments for verification
const pendingPayments = new Map();

/**
 * Notify when payment is initiated
 */
app.post('/notify-paid', async (req, res) => {
  try {
    const { name, policyNumber, mobileNumber, amount, method, refId } = req.body;

    // Store pending payment
    pendingPayments.set(refId, {
      name, policyNumber, mobileNumber, amount, method, refId,
      status: 'pending',
      time: new Date().toLocaleString('en-IN')
    });

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return res.json({ success: true, message: 'Payment recorded (Telegram not configured).' });
    }

    const message = [
      '🔔 NEW PAYMENT INITIATED',
      `Name: ${name || '-'}`,
      `Policy: ${policyNumber || '-'}`,
      `Mobile: ${mobileNumber || '-'}`,
      `Amount: INR ${amount || '-'}`,
      `App: ${method || '-'}`,
      `Ref: ${refId || '-'}`,
      `Time: ${new Date().toLocaleString('en-IN')}`,
      '',
      '⚠️ Check your UPI app and verify payment before confirming!'
    ].join('\n');

    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message
      })
    });

    if (!tgRes.ok) {
      const errText = await tgRes.text();
      console.warn('Telegram API error:', tgRes.status, errText);
    }

    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: 'Notification failed.' });
  }
});

/**
 * Mark payment as verified (called when admin confirms)
 */
app.post('/verify-payment', async (req, res) => {
  try {
    const { refId } = req.body;
    
    if (!pendingPayments.has(refId)) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    const payment = pendingPayments.get(refId);
    payment.status = 'verified';
    payment.verifiedAt = new Date().toLocaleString('en-IN');

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const message = [
        '✅ PAYMENT VERIFIED SUCCESSFULLY',
        `Name: ${payment.name || '-'}`,
        `Policy: ${payment.policyNumber || '-'}`,
        `Mobile: ${payment.mobileNumber || '-'}`,
        `Amount: INR ${payment.amount || '-'}`,
        `App: ${payment.method || '-'}`,
        `Ref: ${refId}`,
        `Verified At: ${payment.verifiedAt}`
      ].join('\n');

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message })
      });
    }

    return res.json({ success: true, message: 'Payment verified.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: 'Verification failed.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n================================`);
  console.log(`UPI payment page + Telegram notify`);
  console.log(`http://localhost:${PORT}`);
  console.log(`================================\n`);
});
