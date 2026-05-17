const yts = require('yt-search');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

async function songCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const used = (rawText || '').split(/\s+/)[0] || '.song';
        const query = rawText.slice(used.length).trim();

        if (!query) {
            await sock.sendMessage(chatId, { text: '🎵 *Song Downloader*\n\nUsage: .song <song name or YouTube link>\nExample: .song con calma' }, { quoted: message });
            return;
        }

        let video;
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            video = { url: query };
        } else {
            const search = await yts(query);
            if (!search || !search.videos.length) {
                await sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
                return;
            }
            video = search.videos[0];
        }

        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: `🎵 *Downloading:* ${video.title}\n⏱ *Duration:* ${video.timestamp}`
        }, { quoted: message });

        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const audioPath = path.join(tempDir, `${video.title.replace(/[\\/:*?"<>|]/g, '')}.mp3`);

        let attempts = 0;
        const maxAttempts = 3;
        let streamError = null;

        while (attempts < maxAttempts) {
            try {
                const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
                const writeStream = fs.createWriteStream(audioPath);
                await new Promise((resolve, reject) => {
                    stream.pipe(writeStream);
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                    stream.on('error', reject);
                });
                streamError = null;
                break;
            } catch (err) {
                streamError = err;
                attempts++;
                console.log(`Attempt ${attempts} failed: ${err.message}`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        if (streamError) throw streamError;

        await sock.sendMessage(chatId, {
            audio: { url: audioPath },
            mimetype: 'audio/mpeg',
            fileName: `${video.title.replace(/[\\/:*?"<>|]/g, '')}.mp3`,
            ptt: false
        }, { quoted: message });

        await fs.promises.unlink(audioPath).catch(() => {});

    } catch (err) {
        console.error('Song command error:', err);
        await sock.sendMessage(chatId, { text: '❌ Failed to download song. Please try again later.' }, { quoted: message });
    }
}

module.exports = songCommand;