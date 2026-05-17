const fs = require('fs');
const path = require('path');

// ========== قائمة الإيموجي (أكثر من 230، بدون رموز دينية) ==========
const EMOJIS_LIST = [
    // تعبيرات الوجه والعواطف (110)
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
    '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
    '🥴', '😵‍💫', '🤒', '🤕', '🤑', '🤠', '🥸', '😎', '🤓', '🧐', '😇', '🙏', '💀', '🗿', '🫠', '🫢', '🫣', '🫡', '🫤', '🫨',
    '👋', '👌', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '🫵', '👇', '👆', '👉', '👈', '🙆', '🙅', '💁', '🙋', '🧏', '🙇', '🤦',
    '🤷', '💆', '💇', '🧖', '💅', '👰', '🤵', '🫄', '🫃', '🧑',
    
    // تفاعلات إيجابية ورموز (40)
    '👍', '👎', '👏', '🙌', '🤝', '💪', '🫂', '🫶', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
    '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💯', '🔥', '✨', '🌟', '💫', '⭐', '🎉', '🎊', '🥳', '💥', '⚡', '💧', '🌈',
    
    // رموز تعبيرية ساخرة وخفيفة (50)
    '🙄', '🤦', '🤦‍♂️', '🤦‍♀️', '🤌', '🫡', '🫣', '🥴', '💀', '🗿', '🫠', '🤡', '👀', '🙈', '🙉', '🙊', '💬', '🗣️', '❓', '❗',
    '❕', '❔', '🔁', '🔄', '🔂', '🔀', '📢', '🔔', '🔕', '💤', '💨', '🫧', '🧠', '💡', '🎯', '🏆', '🥇', '🥈', '🥉', '🏅',
    '🎭', '🎨', '🎪', '🎬', '🎤', '🎧', '🎵', '🎶', '🎸', '🎹'
];

// ========== إدارة التفعيل لكل مجموعة ==========
const CONFIG_PATH = path.join(__dirname, '../data/reactionsConfig.json');

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify({ enabledChats: {} }));
            return { enabledChats: {} };
        }
        const data = fs.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('❌ خطأ في تحميل إعدادات التفاعلات:', err);
        return { enabledChats: {} };
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (err) {
        console.error('❌ خطأ في حفظ إعدادات التفاعلات:', err);
    }
}

function isReactionEnabled(chatId) {
    const config = loadConfig();
    return config.enabledChats[chatId] === true;
}

function setReactionEnabled(chatId, enabled) {
    const config = loadConfig();
    if (enabled) {
        config.enabledChats[chatId] = true;
    } else {
        delete config.enabledChats[chatId];
    }
    saveConfig(config);
}

function getRandomEmoji() {
    return EMOJIS_LIST[Math.floor(Math.random() * EMOJIS_LIST.length)];
}

// إضافة تفاعل على رسالة (يُستدعى لكل رسالة)
async function addCommandReaction(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId) return;
        
        if (!isReactionEnabled(chatId)) return;

        const emoji = getRandomEmoji();
        await sock.sendMessage(chatId, {
            react: {
                text: emoji,
                key: message.key
            }
        });
    } catch (error) {
        // تجاهل الأخطاء (مثل حذف الرسالة الأصلية)
    }
}

// أمر التحكم .areact
async function handleAreactCommand(sock, chatId, message, isOwner) {
    try {
        const args = message.message?.conversation?.split(' ') || [];
        const action = args[1]?.toLowerCase();

        if (!action) {
            const status = isReactionEnabled(chatId) ? 'مفعلة ✅' : 'معطلة ❌';
            await sock.sendMessage(chatId, {
                text: `🎭 *حالة التفاعلات التلقائية:* ${status}\n\nلتفعيلها: .areact on\nلإيقافها: .areact off`,
                quoted: message
            });
            return;
        }

        if (action === 'on') {
            setReactionEnabled(chatId, true);
            await sock.sendMessage(chatId, {
                text: '✅ تم تفعيل التفاعلات التلقائية في هذه المحادثة!',
                quoted: message
            });
        } 
        else if (action === 'off') {
            setReactionEnabled(chatId, false);
            await sock.sendMessage(chatId, {
                text: '❌ تم إيقاف التفاعلات التلقائية في هذه المحادثة.',
                quoted: message
            });
        }
        else {
            await sock.sendMessage(chatId, {
                text: '⚠️ أمر غير صالح. استخدم `.areact on` أو `.areact off`.',
                quoted: message
            });
        }
    } catch (error) {
        console.error('Error in areact command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ حدث خطأ أثناء تنفيذ الأمر.',
            quoted: message
        });
    }
}

module.exports = {
    addCommandReaction,
    handleAreactCommand
};