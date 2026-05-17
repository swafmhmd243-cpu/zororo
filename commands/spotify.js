const axios = require('axios');

async function spotifyCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';

        const used = (rawText || '').split(/\s+/)[0] || '.spotify';
        const query = rawText.slice(used.length).trim();

        if (!query) {
            await sock.sendMessage(chatId, { text: 'Usage: .spotify <song/artist/keywords>\nExample: .spotify con calma' }, { quoted: message });
            return;
        }

        // استخدم API JioSaavn (بديل موثوق)
        const apiUrl = `https://jiosaavn-api.vercel.app/search?query=${encodeURIComponent(query)}`;
        const { data } = await axios.get(apiUrl, { timeout: 20000, headers: { 'user-agent': 'Mozilla/5.0' } });

        if (!data?.results?.length) {
            throw new Error('No result from Spotify API');
        }

        const r = data.results[0];
        const audioUrl = r.downloadUrl?.[0]?.url || r.perma_url;
        if (!audioUrl) {
            await sock.sendMessage(chatId, { text: 'No downloadable audio found for this query.' }, { quoted: message });
            return;
        }

        const caption = `🎵 ${r.title || r.name || 'Unknown Title'}\n👤 ${r.artist || ''}\n⏱ ${r.duration || ''}\n🔗 ${r.perma_url || ''}`.trim();

        if (r.image) {
            await sock.sendMessage(chatId, { image: { url: r.image }, caption }, { quoted: message });
        } else if (caption) {
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        }
        
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${(r.title || r.name || 'track').replace(/[\\/:*?"<>|]/g, '')}.mp3`
        }, { quoted: message });

    } catch (error) {
        console.error('[SPOTIFY] error:', error?.message || error);
        await sock.sendMessage(chatId, { text: 'Failed to fetch Spotify audio. Try another query later.' }, { quoted: message });
    }
}

module.exports = spotifyCommand;