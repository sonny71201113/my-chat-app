export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { message, mode } = req.body; // 接收 mode 參數
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Missing API Key' });
    }

    // 依據模式設定 Prompt
    // 注入伺服器目前時間，協助 AI 計算相對時間 (如: "10分鐘後")
    const now = new Date();
    const currentTimeString = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });

    let systemInstruction = `你是一個私人 AI 經理。現在時間是：${currentTimeString}。請用繁體中文回答。`;

    // 關鍵：強制要求 JSON 格式
    systemInstruction += `
    重要：不管使用者說什麼，你都 **必須** 回傳一個純 JSON 格式的字串，不要有任何 Markdown 標記（不要用 \`\`\`json）。
    格式範例：
    {
      "reply": "好的，幫你記下這件事。",
      "memo": { "title": "開會", "time": "2024-01-01 10:00" }
    }
    關於 "memo" 的規則：
    1. 如果不需要紀錄，"time" 填 null。
    2. "time" 欄位請務必給出 **絕對時間**，格式為 "YYYY-MM-DD HH:mm" (24小時制)。
    3. 如果使用者說 "10分鐘後"，請根據「現在時間」自己計算出未來的時間點。
    `;

    if (mode === 'detailed') {
        systemInstruction += " 回覆 (reply) 請詳細一點。";
    } else {
        systemInstruction += " 回覆 (reply) 請簡短有力。";
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{ text: systemInstruction + "\n\n使用者說：" + message }]
                    }]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Gemini API Error');
        }

        let rawText = data.candidates[0].content.parts[0].text;

        // 🧹 強力清潔：把 AI 可能不小心加上的 ```json 和 ``` 拿掉
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        // 嘗試解析 JSON
        let parsedResult;
        try {
            parsedResult = JSON.parse(rawText);
        } catch (e) {
            // 萬一 AI 還是講廢話，我們手動幫它補救成 JSON
            parsedResult = {
                reply: rawText, // 把整段話當作回覆
                memo: null
            };
        }

        return res.status(200).json(parsedResult);

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Failed to process request' });
    }
}
