const fs = require('fs');
const { join } = require('path');
const { jidDecode } = require('@whiskeysockets/baileys');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const decode = jid => (jidDecode(jid)?.user || jid.split('@')[0]) + '@s.whatsapp.net';

module.exports = {
    command: 'اونيغيري',
    description: 'زرف القروب وتغيير الاسم والوصف والطرد الجماعي (للمالك فقط)',
    usage: '.اونيغيري',
    category: 'owner',

    async execute(sock, msg, isOwner) {
        try {
            const groupJid = msg.key.remoteJid;

            if (!groupJid.endsWith('@g.us')) {
                return await sock.sendMessage(groupJid, { text: '❗ هذا الأمر يعمل فقط داخل المجموعات.' }, { quoted: msg });
            }

            if (!isOwner) {
                return await sock.sendMessage(groupJid, { text: '❗ هذا الأمر متاح فقط للمالك.' }, { quoted: msg });
            }

            let zarfData;
            try {
                const zarfPath = join(process.cwd(), 'zarf.json');
                zarfData = JSON.parse(fs.readFileSync(zarfPath, 'utf8'));
            } catch (err) {
                console.error('❌ فشل قراءة zarf.json:', err);
                return await sock.sendMessage(groupJid, { text: '⚠️ لم أتمكن من قراءة إعدادات الزرف.' }, { quoted: msg });
            }

            const groupMetadata = await sock.groupMetadata(groupJid);
            const botJid = sock.user.id;
            const ownerJid = msg.key.participant || msg.key.remoteJid;

            // 1. تنزيل المشرفين العاديين (استثناء البوت والمالك) – يتطلب صلاحيات
            const membersToDemote = groupMetadata.participants
                .filter(p => p.admin && p.id !== botJid && p.id !== ownerJid)
                .map(p => p.id);
            if (membersToDemote.length > 0) {
                try {
                    await sock.groupParticipantsUpdate(groupJid, membersToDemote, 'demote');
                } catch (e) {
                    console.error('❌ فشل تنزيل المشرفين:', e.message);
                }
            }

            // 2. رد الفعل
            if (zarfData.reaction_status === "on" && zarfData.reaction) {
                await sock.sendMessage(groupJid, {
                    react: { text: zarfData.reaction, key: msg.key }
                }).catch(() => {});
            }

            // 3. تغيير الاسم والوصف
            if (zarfData.group?.status === "on") {
                if (zarfData.group.newSubject) {
                    try {
                        await sock.groupUpdateSubject(groupJid, zarfData.group.newSubject);
                    } catch (e) {
                        console.error('❌ فشل تغيير الاسم:', e.message);
                    }
                }
                if (zarfData.group.newDescription) {
                    try {
                        await sock.groupUpdateDescription(groupJid, zarfData.group.newDescription);
                    } catch (e) {
                        console.error('❌ فشل تغيير الوصف:', e.message);
                    }
                }
            }

            // 4. تغيير الصورة
            if (zarfData.media?.status === "on" && zarfData.media.image) {
                const imgPath = join(process.cwd(), zarfData.media.image);
                if (fs.existsSync(imgPath)) {
                    try {
                        const imageBuffer = fs.readFileSync(imgPath);
                        await sock.updateProfilePicture(groupJid, imageBuffer);
                    } catch (e) {
                        console.error('❌ فشل تغيير الصورة:', e.message);
                    }
                }
            }

            // 5. إرسال الرسائل والصوت
            if (zarfData.messages?.status === "on") {
                const allParticipants = groupMetadata.participants.map(p => p.id);
                if (zarfData.messages.mention) {
                    await sock.sendMessage(groupJid, {
                        text: zarfData.messages.mention,
                        mentions: allParticipants
                    }).catch(() => {});
                }
                if (zarfData.messages.final) {
                    await sock.sendMessage(groupJid, {
                        text: zarfData.messages.final
                    }).catch(() => {});

                    if (zarfData.audio?.status === "on" && zarfData.audio.file) {
                        const audioPath = join(process.cwd(), zarfData.audio.file);
                        if (fs.existsSync(audioPath)) {
                            const audioBuffer = fs.readFileSync(audioPath);
                            await sock.sendMessage(groupJid, {
                                audio: audioBuffer,
                                mimetype: 'audio/mp4',
                                ptt: true
                            }).catch(() => {});
                        }
                    }
                }
            }

            // 6. طرد جميع الأعضاء باستثناء البوت والمالك
            const toKick = groupMetadata.participants
                .filter(p => p.id !== botJid && p.id !== ownerJid)
                .map(p => p.id);
            if (toKick.length > 0) {
                await sleep(10);
                try {
                    await sock.groupParticipantsUpdate(groupJid, toKick, 'remove');
                } catch (kickErr) {
                    console.error('❌ فشل الطرد الجماعي:', kickErr.message);
                }
            }

        } catch (error) {
            console.error('❌ خطأ في أمر اونيغيري:', error);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ حدث خطأ أثناء تنفيذ الأمر:\n\n${error.message || error.toString()}`
            }, { quoted: msg });
        }
    }
};