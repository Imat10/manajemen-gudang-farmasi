const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const SHEET_API_URL = process.env.SHEET_API_URL; 

// Tombol Menu Utama Permanen (Reply Keyboard)
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: "📊 Rekap Stok" }, { text: "⚠️ Cek Exp Date" }],
      [{ text: "❌ Stok Habis" }]
    ],
    resize_keyboard: true,
    is_persistent: true
  }
};

// Perintah /start
bot.start((ctx) => {
  ctx.reply(
    "🤖 *SELAMAT DATANG DI LAYANAN BOT GUDANG FARMASI BANTEN*\n\nSilakan pilih menu layanan di bawah ini:",
    { parse_mode: 'Markdown', ...mainKeyboard }
  );
});

// Fitur Rekap Stok
bot.hears('📊 Rekap Stok', async (ctx) => {
  try {
    ctx.reply("⏳ Mengambil data rekap dari Google Sheets...");
    const res = await fetch(SHEET_API_URL + "?action=getData");
    const json = await res.json();
    
    if (!json.ok) return ctx.reply("❌ Gagal mengambil data dari server.");

    const items = json.data;
    let total = items.length;
    let aman = items.filter(i => i.status === 'AVAILABLE').length;
    let habis = items.filter(i => i.status === 'OUT OF STOCK').length;
    let expired = items.filter(i => i.status === 'EXPIRED').length;

    let msg = 
      `📊 *REKAPITULASI SISA STOK GUDANG*\n\n` +
      `Total Batch: ${total}\n` +
      `- Stok Aman: ${aman}\n` +
      `- Stok Kosong: ${habis}\n` +
      `- Kadaluwarsa: ${expired}`;
      
    ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    ctx.reply("⚠️ Terjadi kesalahan: " + err.message);
  }
});

// Fitur Cek Exp Date
bot.hears('⚠️ Cek Exp Date', async (ctx) => {
  try {
    ctx.reply("⏳ Mengecek masa kadaluwarsa obat...");
    const res = await fetch(SHEET_API_URL + "?action=getData");
    const json = await res.json();
    
    if (!json.ok) return ctx.reply("❌ Gagal mengambil data.");

    const items = json.data;
    const soon = items.filter(i => i.status === 'EXPIRING SOON' || i.status === 'EXPIRED');

    if (soon.length === 0) {
      return ctx.reply("✅ Aman. Tidak ada obat yang kadaluwarsa atau mendekati batas ED.");
    }

    let lines = ["⚠️ *LAPORAN OBAT MENDEKATI / KADALUWARSA*\n"];
    soon.slice(0, 10).forEach(m => {
      lines.push(`- *${m.name}* (${m.batch}) | Status: ${m.status} | Sisa: ${m.stock}`);
    });

    ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch (err) {
    ctx.reply("⚠️ Terjadi kesalahan: " + err.message);
  }
});

// Fitur Stok Habis
bot.hears('❌ Stok Habis', async (ctx) => {
  try {
    const res = await fetch(SHEET_API_URL + "?action=getData");
    const json = await res.json();
    
    if (!json.ok) return ctx.reply("❌ Gagal mengambil data.");

    const empty = json.data.filter(i => i.status === 'OUT OF STOCK');

    if (empty.length === 0) {
      return ctx.reply("✅ Status stok aman. Tidak ada batch obat yang kosong.");
    }

    let lines = ["❌ *DAFTAR BATCH STOK KOSONG*\n"];
    empty.slice(0, 15).forEach(m => {
      lines.push(`- *${m.name}* (Batch: ${m.batch})`);
    });

    ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch (err) {
    ctx.reply("⚠️ Terjadi kesalahan: " + err.message);
  }
});

// Handler utama untuk Vercel Serverless
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      res.status(200).json({ status: 'ok' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(200).send('Bot Telegram Vercel Aktif & Berjalan Normal!');
  }
};
