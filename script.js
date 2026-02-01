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
    const memo = {
        title,
        time,
        id: Date.now(),
        notified: false,
        completed: false // 新增完成狀態
    };
    memos.push(memo);
    saveMemos();
    renderMemo(memo);
}

/**
 * 渲染單個備忘錄卡片 (重構：支援互動與重新渲染)
 */
function renderMemo(memo) {
    // 檢查是否已存在 (避免重複 render，或是用於更新時直接替換)
    const existingLi = document.querySelector(`li[data-id="${memo.id}"]`);

    const li = document.createElement('li');
    li.classList.add('memo-card');
    li.setAttribute('data-id', memo.id); // 綁定 ID

    if (memo.completed) {
        li.classList.add('completed');
    }

    // 構建 HTML
    li.innerHTML = `
        <div class="memo-content">
            <div class="memo-time" title="點擊編輯">${memo.time || '無時間'}</div>
            <div class="memo-title" title="點擊編輯">${memo.title}</div>
        </div>
        <div class="memo-actions">
            <button class="action-btn edit" title="編輯"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg> 編輯</button>
            <button class="action-btn restart" title="再來一次 (重設時間)"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"></path></svg> 重來</button>
            <button class="action-btn delete" title="刪除"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg> 刪除</button>
        </div>
    `;

    // 綁定事件
    const editBtn = li.querySelector('.edit');
    const deleteBtn = li.querySelector('.delete');
    const restartBtn = li.querySelector('.restart');
    const titleDiv = li.querySelector('.memo-title');
    const timeDiv = li.querySelector('.memo-time');

    // 刪除
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('確定要刪除這個備忘錄嗎？')) {
            deleteMemo(memo.id);
        }
    });

    // 編輯 (按鈕觸發)
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEditMode(li, memo);
    });

    // 編輯 (點擊文字觸發)
    titleDiv.addEventListener('click', (e) => { e.stopPropagation(); toggleEditMode(li, memo); });
    timeDiv.addEventListener('click', (e) => { e.stopPropagation(); toggleEditMode(li, memo); });

    // 再來一次 (重設時間)
    if (!memo.completed) {
        restartBtn.style.display = 'none'; // 未完成時隱藏重來按鈕
    }
    restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        rescheduleMemo(memo.id);
    });

    // 插入或替換
    if (existingLi) {
        existingLi.replaceWith(li);
    } else {
        // 根據時間排序插入，或簡單地放在最上面
        // 為了簡單，我們保持最新在最上
        memoList.prepend(li);
    }
}

/**
 * 切換編輯模式
 */
function toggleEditMode(li, memo) {
    if (li.classList.contains('editing')) return;
    li.classList.add('editing');

    const contentDiv = li.querySelector('.memo-content');
    const originalHTML = contentDiv.innerHTML;

    // 替換為 Input
    contentDiv.innerHTML = `
        <input type="text" class="memo-time-edit" value="${memo.time || ''}" placeholder="YYYY-MM-DD HH:mm">
        <input type="text" class="memo-title-edit" value="${memo.title}">
        <div class="edit-hint">按 Enter 儲存，點擊卡片外完成</div>
    `;

    const titleInput = contentDiv.querySelector('.memo-title-edit');
    const timeInput = contentDiv.querySelector('.memo-time-edit');
    titleInput.focus();

    // 儲存函數
    const saveEdit = () => {
        const newTitle = titleInput.value.trim();
        const newTime = timeInput.value.trim();

        if (newTitle) {
            updateMemo(memo.id, { title: newTitle, time: newTime });
        } else {
            // 如果標題清空了，則復原
            renderMemo(memo);
        }
        li.classList.remove('editing');
    };

    // 處理焦點邏輯：使用 focusout 偵測是否離開整個編輯區
    contentDiv.addEventListener('focusout', (e) => {
        // e.relatedTarget 是新獲得焦點的元素
        // 如果新焦點還在 contentDiv 內部 (例如從標題跳到時間)，則不觸發儲存
        if (contentDiv.contains(e.relatedTarget)) {
            return;
        }
        // 確實離開了，執行儲存
        setTimeout(saveEdit, 200);
    });

    // 鍵盤事件
    const handleKey = (e) => {
        if (e.key === 'Enter') saveEdit();
    };

    titleInput.addEventListener('keydown', handleKey);
    timeInput.addEventListener('keydown', handleKey);
}

/**
 * 更新備忘錄資料
 */
function updateMemo(id, updates) {
    const index = memos.findIndex(m => m.id === id);
    if (index !== -1) {
        memos[index] = { ...memos[index], ...updates };
        saveMemos();
        renderMemo(memos[index]); // 重新渲染該卡片
    }
}

/**
 * 刪除備忘錄
 */
function deleteMemo(id) {
    memos = memos.filter(m => m.id !== id);
    saveMemos();
    const li = document.querySelector(`li[data-id="${id}"]`);
    if (li) {
        li.style.opacity = '0';
        li.style.transform = 'translateX(20px)';
        setTimeout(() => li.remove(), 300);
    }
}

/**
 * 再來一次 (重設時間)
 */
function rescheduleMemo(id) {
    const memo = memos.find(m => m.id === id);
    if (!memo) return;

    // 簡單用 prompt 讓使用者輸入新時間 (未來可優化為 Date Picker)
    const now = new Date();
    // 預設給一個 1 小時後的時間
    now.setHours(now.getHours() + 1);
    const defaultTime = formatTime(now);

    const newTime = prompt("請輸入新的提醒時間 (YYYY-MM-DD HH:mm):", defaultTime);

    if (newTime) {
        updateMemo(id, {
            time: newTime,
            completed: false, // 重置完成狀態
            notified: false   // 重置通知狀態
        });
        alert(`已重新排程於：${newTime}`);
    }
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
        // 依照時間排序 (可選)，這裡我們依照陣列順序 (新增順序)
        // 使用 reverse() 讓最新的在上面 (如果我們 push 是加在後面)
        [...memos].reverse().forEach(memo => renderMemo(memo));
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
    if (Notification.permission !== "granted") return; // 雖然沒權限也可以標記完成，但這裡先綁定

    const now = new Date();
    // 格式化當前時間為 YYYY-MM-DD HH:mm (與 AI 回傳格式需一致)
    // 為了容錯，我們也嘗試只比對 HH:mm
    const currentFullTime = formatTime(now); // "2024-01-01 10:00"
    const currentShortTime = formatTimeShort(now); // "10:00"

    let updated = false;

    memos.forEach(memo => {
        if (memo.notified || memo.completed) return; // 已經通知過或已完成就跳過

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

            // 更新狀態
            memo.notified = true;
            memo.completed = true; // 自動標記為完成

            // 視覺更新：重新渲染該卡片以顯示完成狀態
            renderMemo(memo);

            updated = true;
        }
    });

    if (updated) {
        saveMemos(); // 儲存狀態
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
