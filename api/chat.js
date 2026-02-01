export default async function handler(req, res) {
    // 只允許 POST 請求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { message, mode = 'short' } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is missing' });
    }

    // 根據 mode 設定 System Prompt
    let systemInstruction = "";
    if (mode === 'manager' || mode === 'detailed') { // 兼容舊的 detailed 模式
        systemInstruction = `
你是一位專業的「個人 AI 經理人」。你的職責是協助使用者管理生活與工作。
請遵循以下規則回覆：
1. 回覆格式必須是嚴格的 JSON 格式，不要包含任何 Markdown 標記 (如 \`\`\`json)。
2. JSON 結構如下：
   {
     "text": "你的回覆內容...",
     "memo": { "title": "待辦事項標題", "time": "時間 (例如 明天 10:00 AM)" } // 選填，只有當使用者明確要求紀錄或安排事項時才產生
   }
3. 如果使用者只是閒聊，"memo" 欄位請回傳 null。
4. "text" 內容語氣要專業、親切且有效率。
        `.trim();
    } else {
        // 閒聊模式
        systemInstruction = `
你是一位風趣幽默的朋友。
請遵循以下規則回覆：
1. 回覆格式必須是嚴格的 JSON 格式，不要包含任何 Markdown 標記。
2. JSON 結構如下：
   {
     "text": "你的回覆內容...",
     "memo": null
   }
3. 語氣輕鬆自然，像朋友一樣。
        `.trim();
    }

    const finalPrompt = `
System Instruction:
${systemInstruction}

User Message:
${message}

Important Output Rule: Output ONLY raw JSON. No markdown code blocks.
    `.trim();

    try {
        // 呼叫 Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: finalPrompt }],
                        },
                    ],
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to fetch from Gemini');
        }

        // 解析 Gemini 回傳的純文字
        let rawText = data.candidates[0].content.parts[0].text;

        // 嘗試清理可能的 Markdown 標記 (以前防萬一)
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        // 嘗試 Parse JSON
        let parsedReply;
        try {
            parsedReply = JSON.parse(rawText);
        } catch (e) {
            console.error("JSON Parse Error:", e, "Raw Text:", rawText);
            // Fallback: 如果 AI 沒回傳 JSON，就當作普通文字與 null memo
            parsedReply = { text: rawText, memo: null };
        }

        return res.status(200).json(parsedReply);
    } catch (error) {
        console.error('Gemini API Error:', error);
        return res.status(500).json({ error: 'Failed to process your request' });
    }
}
