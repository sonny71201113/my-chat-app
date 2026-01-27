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

    // 根據 mode 設定 System Prompt (或附加在訊息前)
    let systemInstruction = "";
    if (mode === 'short') {
        systemInstruction = "請用極簡短的口語回覆，像朋友聊天一樣，不要超過 50 個字。";
    } else if (mode === 'detailed') {
        systemInstruction = "請用詳細、條理分明的方式回覆，適合教學或解釋複雜概念。";
    }

    // 為了讓這段 Prompt 生效，我們可以將其作為 System Instruction 傳遞
    // 或者簡單地將其加在 User Message 前面 (相容性較好)
    const finalPrompt = `[System Instruction: ${systemInstruction}]\n\nUser Message: ${message}`;

    try {
        // 呼叫 Gemini API (使用 gemini-1.5-flash 或 gemini-pro)
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

        // 解析 Gemini 回傳的格式
        const reply = data.candidates[0].content.parts[0].text;

        return res.status(200).json({ reply });
    } catch (error) {
        console.error('Gemini API Error:', error);
        return res.status(500).json({ error: 'Failed to process your request' });
    }
}
