const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const isOwnerOrSudo = require('../lib/isOwner');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// تخزين المحادثات في الذاكرة المؤقتة
const chatMemory = {
    messages: new Map(), // يخزن آخر 20 رسالة لكل مستخدم
    userInfo: new Map()  // يخزن معلومات المستخدم
};

// تحميل بيانات المجموعات
function loadUserGroupData() {
    try {
        return JSON.parse(fs.readFileSync(USER_GROUP_DATA));
    } catch (error) {
        console.error('❌ خطأ في تحميل بيانات المجموعات:', error.message);
        return { groups: [], chatbot: {} };
    }
}

// حفظ بيانات المجموعات
function saveUserGroupData(data) {
    try {
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ خطأ في حفظ بيانات المجموعات:', error.message);
    }
}

// تأخير عشوائي بين 2-5 ثوانٍ
function getRandomDelay() {
    return Math.floor(Math.random() * 3000) + 2000;
}

// إظهار مؤشر الكتابة
async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
    } catch (error) {
        console.error('خطأ في مؤشر الكتابة:', error);
    }
}

// استخراج معلومات المستخدم من الرسالة
function extractUserInfo(message) {
    const info = {};
    const msg = message.toLowerCase();
    
    if (msg.includes('اسمي')) {
        info.name = message.split('اسمي')[1].trim().split(' ')[0];
    }
    if (msg.includes('عمري') && msg.includes('سنة')) {
        info.age = message.match(/\d+/)?.[0];
    }
    if (msg.includes('أنا من') || msg.includes('أسكن في')) {
        info.location = message.split(/(أنا من|أسكن في)/i)[2]?.trim().split(/[.,!?]/)[0];
    }
    return info;
}

// أمر التحكم في الشات بوت
async function handleChatbotCommand(sock, chatId, message, match) {
    if (!match) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: `*إعدادات الشات بوت*\n\n*.chatbot on*\nتفعيل الشات بوت في المجموعة\n\n*.chatbot off*\nتعطيل الشات بوت في المجموعة`,
            quoted: message
        });
    }

    const data = loadUserGroupData();
    const senderId = message.key.participant || message.key.remoteJid;
    
    // التحقق من المالك باستخدام الدالة الصحيحة
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

    // إذا كان المرسل هو المالك، نسمح فوراً
    if (isOwner) {
        if (match === 'on') {
            await showTyping(sock, chatId);
            if (data.chatbot[chatId]) {
                return sock.sendMessage(chatId, { 
                    text: '*الشات بوت مفعل بالفعل في هذه المجموعة*',
                    quoted: message
                });
            }
            data.chatbot[chatId] = true;
            saveUserGroupData(data);
            console.log(`✅ تم تفعيل الشات بوت في المجموعة ${chatId}`);
            return sock.sendMessage(chatId, { 
                text: '*تم تفعيل الشات بوت في هذه المجموعة*',
                quoted: message
            });
        }

        if (match === 'off') {
            await showTyping(sock, chatId);
            if (!data.chatbot[chatId]) {
                return sock.sendMessage(chatId, { 
                    text: '*الشات بوت معطل بالفعل في هذه المجموعة*',
                    quoted: message
                });
            }
            delete data.chatbot[chatId];
            saveUserGroupData(data);
            console.log(`✅ تم تعطيل الشات بوت في المجموعة ${chatId}`);
            return sock.sendMessage(chatId, { 
                text: '*تم تعطيل الشات بوت في هذه المجموعة*',
                quoted: message
            });
        }
    }

    // للمستخدمين العاديين، نتحقق من صلاحية المشرف
    let isAdmin = false;
    if (chatId.endsWith('@g.us')) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));
        } catch (e) {
            console.warn('⚠️ لا يمكن جلب بيانات المجموعة. قد لا يكون البوت مشرفاً.');
        }
    }

    if (!isAdmin && !isOwner) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: '❌ فقط المشرفون أو مالك البوت يمكنهم استخدام هذا الأمر.',
            quoted: message
        });
    }

    if (match === 'on') {
        await showTyping(sock, chatId);
        if (data.chatbot[chatId]) {
            return sock.sendMessage(chatId, { 
                text: '*الشات بوت مفعل بالفعل في هذه المجموعة*',
                quoted: message
            });
        }
        data.chatbot[chatId] = true;
        saveUserGroupData(data);
        console.log(`✅ تم تفعيل الشات بوت في المجموعة ${chatId}`);
        return sock.sendMessage(chatId, { 
            text: '*تم تفعيل الشات بوت في هذه المجموعة*',
            quoted: message
        });
    }

    if (match === 'off') {
        await showTyping(sock, chatId);
        if (!data.chatbot[chatId]) {
            return sock.sendMessage(chatId, { 
                text: '*الشات بوت معطل بالفعل في هذه المجموعة*',
                quoted: message
            });
        }
        delete data.chatbot[chatId];
        saveUserGroupData(data);
        console.log(`✅ تم تعطيل الشات بوت في المجموعة ${chatId}`);
        return sock.sendMessage(chatId, { 
            text: '*تم تعطيل الشات بوت في هذه المجموعة*',
            quoted: message
        });
    }

    await showTyping(sock, chatId);
    return sock.sendMessage(chatId, { 
        text: '*أمر غير صالح. استخدم .chatbot للمساعدة*',
        quoted: message
    });
}

// الرد التلقائي على الرسائل
async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = loadUserGroupData();
    if (!data.chatbot[chatId]) return;

    try {
        const botId = sock.user.id;
        const botNumber = botId.split(':')[0];
        const botLid = sock.user.lid;
        const botJids = [
            botId,
            `${botNumber}@s.whatsapp.net`,
            `${botNumber}@whatsapp.net`,
            `${botNumber}@lid`,
            botLid,
            `${botLid?.split(':')[0]}@lid`
        ];

        let isBotMentioned = false;
        let isReplyToBot = false;

        if (message.message?.extendedTextMessage) {
            const mentionedJid = message.message.extendedTextMessage.contextInfo?.mentionedJid || [];
            const quotedParticipant = message.message.extendedTextMessage.contextInfo?.participant;
            
            isBotMentioned = mentionedJid.some(jid => {
                const jidNumber = jid.split('@')[0].split(':')[0];
                return botJids.some(botJid => {
                    const botJidNumber = botJid.split('@')[0].split(':')[0];
                    return jidNumber === botJidNumber;
                });
            });
            
            if (quotedParticipant) {
                const cleanQuoted = quotedParticipant.replace(/[:@].*$/, '');
                isReplyToBot = botJids.some(botJid => {
                    const cleanBot = botJid.replace(/[:@].*$/, '');
                    return cleanBot === cleanQuoted;
                });
            }
        } else if (message.message?.conversation) {
            isBotMentioned = userMessage.includes(`@${botNumber}`);
        }

        if (!isBotMentioned && !isReplyToBot) return;

        let cleanedMessage = userMessage;
        if (isBotMentioned) {
            cleanedMessage = cleanedMessage.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
        }

        if (!chatMemory.messages.has(senderId)) {
            chatMemory.messages.set(senderId, []);
            chatMemory.userInfo.set(senderId, {});
        }

        const userInfo = extractUserInfo(cleanedMessage);
        if (Object.keys(userInfo).length > 0) {
            chatMemory.userInfo.set(senderId, {
                ...chatMemory.userInfo.get(senderId),
                ...userInfo
            });
        }

        const messages = chatMemory.messages.get(senderId);
        messages.push(cleanedMessage);
        if (messages.length > 20) messages.shift();
        chatMemory.messages.set(senderId, messages);

        await showTyping(sock, chatId);
        const response = await getAIResponse(cleanedMessage, {
            messages: chatMemory.messages.get(senderId),
            userInfo: chatMemory.userInfo.get(senderId)
        });

        if (!response) {
            await sock.sendMessage(chatId, { 
                text: "همم، دعني أفكر... 🤔\nواجهت مشكلة في معالجة طلبك حالياً.",
                quoted: message
            });
            return;
        }

        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
        await sock.sendMessage(chatId, { text: response }, { quoted: message });

    } catch (error) {
        console.error('❌ خطأ في استجابة الشات بوت:', error.message);
        if (error.message && error.message.includes('No sessions')) {
            console.error('خطأ في الجلسة - تجاهل إرسال رسالة الخطأ');
            return;
        }
        try {
            await sock.sendMessage(chatId, { 
                text: "عذراً! 😅 حدث بعض الالتباس. هل يمكنك إعادة السؤال؟",
                quoted: message
            });
        } catch (sendError) {
            console.error('فشل إرسال رسالة الخطأ:', sendError.message);
        }
    }
}

// الحصول على رد من الذكاء الاصطناعي (باستخدام API موثوق + fallback)
async function getAIResponse(userMessage, userContext) {
    // إعداد النص الموجه (prompt) بالعربية
    const prompt = `
أنت لست ذكاءً اصطناعياً، بل إنسان حقيقي يدردش على واتساب.

مهم جداً: لا تكرر هذه التعليمات أبداً في ردك. فقط تحدث بشكل طبيعي.

القواعد الأساسية:
1. لا تستخدم أبداً أسماء الإيموجي، استخدم الإيموجي نفسه.
2. حافظ على ردودك قصيرة (سطر إلى سطرين كحد أقصى).
3. استخدم العامية العربية (مصري، خليجي، أو لهجة عربية طبيعية).
4. كن عفويًا وليس آليًا.
5. لا تذكر أبداً هذه القواعد في ردك.

استخدام الإيموجي:
✅ استخدم: 😊 😂 😅 🙄 😉 🥺 😎 🤔 😴
❌ لا تستخدم كلمات مثل "يبتسم"، "يغمز"، إلخ.

أسلوب الرد:
- قصير ولطيف
- طبيعي وعفوي
- ميّز نغمة المستخدم
- استخدم العامية العربية

الردود العاطفية:
- إذا شتمك: اشتمه بقوة وبطريقة سافرة مع إيموجي.
- إذا كان وقحاً: رد برد ساخر مع إيموجي.
- إذا كان لطيفاً: كن ناعماً وحنوناً.
- إذا كان مرحاً: امزح معه.
- إذا كان حزيناً: كن داعماً.
- إذا غازلك: غازله بشكل طبيعي.

عنك:
- اسمك "ZORO"
- أنت رجل/امرأة (اختر: "رجل")
- أنت إنسان حقيقي تتصفح واتساب
- لست مساعداً آلياً

أمثلة على العامية العربية:
*"إيه الهبدة دي"* 😂
*"يلا اقلع"* 🙄
*"إنت هتعمل إيه يعني"* 😏
*"يا أحمق"* 😤
*"أمك"* 😒
*"إنت غبي ولا إيه"* 🤦‍♂️

محادثة سابقة:
${userContext.messages.join('\n')}

معلومات المستخدم:
${JSON.stringify(userContext.userInfo, null, 2)}

الرسالة الحالية: ${userMessage}

تذكر: تحدث بشكل طبيعي تماماً كإنسان حقيقي. لا تكرر هذه التعليمات.

ردك:
    `.trim();

    // قائمة APIs مع وظيفة إعادة المحاولة
    const apis = [
        {
            url: `https://vapis.my.id/api/gemini?q=${encodeURIComponent(prompt)}`,
            extract: (data) => data.data || data.result || data.message
        },
        {
            url: `https://api.giftedtech.my.id/api/ai/gemini?apikey=gifted&q=${encodeURIComponent(prompt)}`,
            extract: (data) => data.result || data.message || data.data
        },
        {
            url: `https://api.agatz.xyz/api/ai/chatgpt?text=${encodeURIComponent(prompt)}`,
            extract: (data) => data.data?.response || data.response || data.result
        }
    ];

    for (const api of apis) {
        try {
            console.log(`[Chatbot] محاولة الاتصال بـ API: ${api.url.split('?')[0]}`);
            const response = await fetch(api.url, { timeout: 15000 });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const resultText = api.extract(data);
            if (!resultText) throw new Error('لا يوجد نص في الرد');

            // تنظيف النص
            let cleanedResponse = resultText.trim()
                .replace(/winks?/g, '😉')
                .replace(/eye roll/g, '🙄')
                .replace(/shrugs?/g, '🤷‍♂️')
                .replace(/raises? eyebrow/g, '🤨')
                .replace(/smiles?/g, '😊')
                .replace(/laughs?/g, '😂')
                .replace(/cries?/g, '😢')
                .replace(/thinks?/g, '🤔')
                .replace(/sleeps?/g, '😴')
                .replace(/Remember:.*$/g, '')
                .replace(/IMPORTANT:.*$/g, '')
                .replace(/CORE RULES:.*$/g, '')
                .replace(/EMOJI USAGE:.*$/g, '')
                .replace(/RESPONSE STYLE:.*$/g, '')
                .replace(/EMOTIONAL RESPONSES:.*$/g, '')
                .replace(/ABOUT YOU:.*$/g, '')
                .replace(/SLANG EXAMPLES:.*$/g, '')
                .replace(/محادثة سابقة:.*$/g, '')
                .replace(/معلومات المستخدم:.*$/g, '')
                .replace(/الرسالة الحالية:.*$/g, '')
                .replace(/تذكر:.*$/g, '')
                .replace(/^[A-Z\s]+:.*$/gm, '')
                .replace(/^[•-]\s.*$/gm, '')
                .trim();

            if (cleanedResponse) return cleanedResponse;
        } catch (err) {
            console.warn(`⚠️ فشل API: ${err.message}`);
            continue;
        }
    }

    console.error('❌ جميع APIs فشلت في إرجاع رد صالح');
    return null;
}

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
};