// 獲取 DOM 元素
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const modeSelect = document.getElementById('mode-select');

// (移除) 機器人的隨機回覆庫 - 改用 API

/**
 * 發送訊息的主要函數
 */
async function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '') return;

    // 1. 顯示我的訊息 (User)
    addMessage(text, 'right');

    const mode = modeSelect.value;
    // 清空輸入框
    messageInput.value = '';

    // 2. 顯示「對方正在輸入...」
    showTypingIndicator();

    try {
        // 3. 呼叫 Gemini AI (透過我們自建的後端 API)
        const reply = await callGeminiAI(text, mode);

        // 4. 移除輸入指示器並顯示回覆
        removeTypingIndicator();
        addMessage(reply, 'left');
    } catch (error) {
        console.error("Error calling API:", error);
        removeTypingIndicator();
        addMessage("抱歉，我現在有點累，無法回答你的問題。 (API Error)", 'left');
    }
}

/**
 * 呼叫後端 API (/api/chat)
 * @param {string} userMessage 使用者輸入的訊息
 * @param {string} mode 回覆模式 ('short' 或 'detailed')
 * @returns {Promise<string>} AI 的回覆
 */
async function callGeminiAI(userMessage, mode = 'short') {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: userMessage,
            mode: mode
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server error');
    }

    const data = await response.json();
    return data.reply;
}

/**
 * 顯示打字中指示器 (...)
 */
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator-row'; // 給個 ID 方便移除
    typingDiv.classList.add('message', 'left');

    const avatarDiv = document.createElement('div');
    avatarDiv.classList.add('avatar-small');
    avatarDiv.innerHTML = `<img src="https://ui-avatars.com/api/?name=User&background=random" alt="User Avatar">`;

    // 建立打字動畫容器
    const indicatorContent = document.createElement('div');
    indicatorContent.classList.add('typing-indicator');

    // 三個跳動的點
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.classList.add('dot');
        indicatorContent.appendChild(dot);
    }

    typingDiv.appendChild(avatarDiv);
    typingDiv.appendChild(indicatorContent);
    chatContainer.appendChild(typingDiv);

    scrollToBottom();
}

/**
 * 移除打字中指示器
 */
function removeTypingIndicator() {
    const typingDiv = document.getElementById('typing-indicator-row');
    if (typingDiv) {
        typingDiv.remove();
    }
}

/**
 * 通用的加訊息函數
 * @param {string} text 訊息內容
 * @param {string} side 'left' 或 'right'
 */
function addMessage(text, side) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', side);

    // 如果是左邊 (對方)，我們要加個小頭像
    if (side === 'left') {
        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('avatar-small');
        avatarDiv.innerHTML = `<img src="https://ui-avatars.com/api/?name=User&background=random" alt="User Avatar">`;
        messageDiv.appendChild(avatarDiv);
    }

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    // 支援一些簡單的換行顯示
    contentDiv.innerHTML = text.replace(/\n/g, '<br>');

    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);

    // 捲動到底部
    scrollToBottom();
}

/**
 * 捲動到底部
 */
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 事件監聽
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// 初始化
scrollToBottom();
