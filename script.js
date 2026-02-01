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

// --- 通知系統相關功能 ---

// 1. 初始化與按鈕監聽
const notifyBtn = document.getElementById('notify-btn');
notifyBtn.addEventListener('click', () => {
    // 請求權限
    if (Notification.permission !== "granted") {
        Notification.requestPermission().then(permission => {
            updateNotifyBtnState();
            if (permission === "granted") {
                new Notification("通知已啟用", { body: "我會準時提醒您！" });
            }
        });
    }
});

/**
 * 更新通知按鈕狀態 (亮起或變暗)
 */
function updateNotifyBtnState() {
    if (Notification.permission === "granted") {
        notifyBtn.classList.add('active');
        notifyBtn.title = "通知已啟用";
    } else {
        notifyBtn.classList.remove('active');
        notifyBtn.title = "點擊啟用通知";
    }
}

// 2. 定時檢查系統 (每 10 秒檢查一次，比較精確)
setInterval(checkReminders, 10000);

/**
 * 檢查是否有到期的備忘錄
 */
function checkReminders() {
    if (Notification.permission !== "granted") return;

    const now = new Date();
    // 格式化當前時間為 YYYY-MM-DD HH:mm (與 AI 回傳格式需一致)
    // 為了容錯，我們也嘗試只比對 HH:mm
    const currentFullTime = formatTime(now); // "2024-01-01 10:00"
    const currentShortTime = formatTimeShort(now); // "10:00"

    let updated = false;

    memos.forEach(memo => {
        if (memo.notified) return; // 已經通知過就跳過

        // 判斷邏輯：
        // 1. 完全符合 YYYY-MM-DD HH:mm
        // 2. 或者只符合 HH:mm (當 AI 偷懶只給短時間時)
        // 3. 簡單檢查字串包含 (例如 "明天 10:00" 包含 "10:00") - 這比較寬鬆，但對簡單應用足夠

        let shouldNotify = false;

        // 如果 memo.time 是完整格式
        if (memo.time === currentFullTime) {
            shouldNotify = true;
        }
        // 寬鬆比對：如果當前時間字串出現在 memo.time 裡 (例如 memo: "下午 02:00", current: "14:00" -> 需注意 12/24 小時制)
        // 這裡我們假設 AI 能依照指示給出 24 小時制格式，或是我們解析比較
        // 簡單做：如果 memo.time 包含當下短時間 (HH:mm)
        else if (memo.time && memo.time.includes(currentShortTime)) {
            // 避免誤判 (如 10:00 包含 0:00)，這裡先簡單做
            shouldNotify = true;
        }

        if (shouldNotify) {
            sendNotification(memo);
            memo.notified = true; // 標記為已通知
            updated = true;
        }
    });

    if (updated) {
        saveMemos(); // 儲存 notified 狀態
    }
}

/**
 * 發送瀏覽器通知
 */
function sendNotification(memo) {
    // 1. 彈窗
    const n = new Notification("經理人提醒", {
        body: memo.title,
        icon: "https://ui-avatars.com/api/?name=AI&background=0095F6&color=fff", // 簡單圖示
        requireInteraction: true // 讓通知停留在螢幕上直到使用者點擊
    });

    // 點擊通知回到視窗
    n.onclick = function () {
        window.focus();
        this.close();
    };

    // 2. 播放提示音
    playNotificationSound();
}

/**
 * 播放短促提示音 (Base64 Beep)
 */
function playNotificationSound() {
    // 一個簡單的短促提示音 (Glass Ping)
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
}

// 輔助函式：格式化時間 YYYY-MM-DD HH:mm
function formatTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 輔助函式：格式化時間 HH:mm
function formatTimeShort(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 頁面載入時檢查權限狀態
updateNotifyBtnState();
