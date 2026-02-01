// 獲取 DOM 元素
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const modeSelect = document.getElementById('mode-select');
const memoList = document.getElementById('memo-list');

// 儲存備忘錄的陣列
let memos = [];

/**
 * 初始化
 */
function init() {
    loadMemos();
    scrollToBottom();
}

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
        // 3. 呼叫 Gemini AI
        const data = await callGeminiAI(text, mode);

        // 4. 移除輸入指示器
        removeTypingIndicator();

        // 5. 處理 AI 回覆
        // data.text 是對話回應
        if (data.text) {
            addMessage(data.text, 'left');
        }

        // data.memo 是備忘錄指令 (如果有的話)
        if (data.memo) {
            addMemo(data.memo.title, data.memo.time);
            saveMemos(); // 儲存到 LocalStorage
        }

    } catch (error) {
        console.error("Error calling API:", error);
        removeTypingIndicator();
        addMessage("抱歉，我現在有點累，無法回答你的問題。 (API Error)", 'left');
    }
}

/**
 * 呼叫後端 API (/api/chat)
 */
async function callGeminiAI(userMessage, mode = 'manager') {
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

    // 預期回傳: { text: "...", memo: { title: "...", time: "..." } }
    return await response.json();
}


/**
 * 新增備忘錄到列表
 */
function addMemo(title, time) {
    const memo = { title, time, id: Date.now() };
    memos.push(memo);
    renderMemo(memo);
    // 播放一個音效或動畫效果 (可選)
}

/**
 * 渲染單個備忘錄卡片
 */
function renderMemo(memo) {
    const li = document.createElement('li');
    li.classList.add('memo-card');
    li.innerHTML = `
        <div class="memo-time">${memo.time}</div>
        <div class="memo-title">${memo.title}</div>
    `;
    memoList.prepend(li); // 新的放上面
}

/**
 * 儲存備忘錄到 LocalStorage
 */
function saveMemos() {
    localStorage.setItem('ai_manager_memos', JSON.stringify(memos));
}

/**
 * 從 LocalStorage 載入備忘錄
 */
function loadMemos() {
    const stored = localStorage.getItem('ai_manager_memos');
    if (stored) {
        memos = JSON.parse(stored);
        // 清空列表重新渲染 (或保留，這裡選擇清空為了順序正確)
        memoList.innerHTML = '';
        memos.forEach(memo => renderMemo(memo));
    }
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
 */
function addMessage(text, side) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', side);

    if (side === 'left') {
        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('avatar-small');
        avatarDiv.innerHTML = `<img src="https://ui-avatars.com/api/?name=User&background=random" alt="User Avatar">`;
        messageDiv.appendChild(avatarDiv);
    }

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.innerHTML = text.replace(/\n/g, '<br>');

    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);

    scrollToBottom();
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 事件監聽
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// 啟動初始化
init();
