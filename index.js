const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
require('dotenv').config();

const TG_TOKEN = '8904687511:AAGORplg_h3uj-OajQY1ZNRlYo4Db_9GoIA';
const TG_CHAT_ID = '6089206187';
const messageLog = new Map();

const client = new Client({
    authStrategy: new LocalAuth(),
    takeoverOnConflict: true,
    puppeteer: {
        headless: true,
        // تم حذف المسار المحلي ليعمل السيرفر بسلاسة
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', async (qr) => {
    try {
        const imagePath = './whatsapp-qr.png';
        await QRCode.toFile(imagePath, qr, { width: 300 });
        const form = new FormData();
        form.append('chat_id', TG_CHAT_ID);
        form.append('photo', fs.createReadStream(imagePath));
        form.append('caption', '📸 *WhatsApp Radar system requested login!*');

        await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, form, { headers: form.getHeaders() });
        console.log('🚀 QR sent to Telegram.');
    } catch (err) {
        console.error('QR Error:', err.message);
    }
});

client.on('ready', () => {
    console.log('🛡️ WhatsApp Radar is active!');
    if (fs.existsSync('./whatsapp-qr.png')) fs.unlinkSync('./whatsapp-qr.png');
});

// التقاط الرسالة فور وصولها وتخزينها
client.on('message', async (msg) => {
    if (msg.hasMedia) return; 

    try {
        const contact = await msg.getContact();
        const senderName = contact.name || contact.pushname || "Unknown";

        messageLog.set(msg.id.id, {
            body: msg.body,
            sender: senderName,
            time: new Date().toLocaleTimeString()
        });
    } catch (e) {
        console.error("Error logging message:", e.message);
    }

    // تنظيف الذاكرة
    if (messageLog.size > 500) {
        const firstKey = messageLog.keys().next().value;
        messageLog.delete(firstKey);
    }
});

// اكتشاف الحذف
client.on('message_revoke_everyone', async (after, before) => {
    if (before && messageLog.has(before.id.id)) {
        const originalMsg = messageLog.get(before.id.id);
        const text = `🚨 *Deleted Message Detected!*
👤 *Sender:* ${originalMsg.sender}
📩 *Message:* ${originalMsg.body}
🕒 *Time:* ${originalMsg.time}`;

        try {
            await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                chat_id: TG_CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            });
            console.log(`🚀 Alert sent.`);
        } catch (e) {
            console.error("Telegram Error:", e.message);
        }
    }
});

process.on('unhandledRejection', (reason) => console.log('⚠️ Error:', reason));

client.initialize();
