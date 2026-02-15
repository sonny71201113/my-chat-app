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

// --- Navigation & View Switching Logic ---

const contactListView = document.getElementById('contact-list-view');
const chatInterfaceView = document.getElementById('chat-interface-view');
const backBtn = document.getElementById('back-btn');
const contactItems = document.querySelectorAll('.contact-item');

// Chat Context Elements
const chatAvatar = document.getElementById('chat-avatar');
const chatUsername = document.getElementById('chat-username');
const chatStatus = document.getElementById('chat-status');

// Default Content (AI Manager)
const aiManagerContentHTML = chatContainer.innerHTML; // 保存預設的 AI 歡迎畫面
const aiManagerName = "DesignGod_Kyle"; // 或者 "AI 私人經理"
const aiManagerAvatar = "https://ui-avatars.com/api/?name=User&background=random";

// 初始化
function initApp() {
    loadMemos(); // 載入備忘錄

    // 綁定列表點擊事件
    contactItems.forEach(item => {
        item.addEventListener('click', () => {
            if (item.id === 'contact-ai-manager') {
                openChat('manager');
            } else {
                const name = item.dataset.contact;
                openChat('friend', name);
            }
        });
    });

    // 綁定返回按鈕
    backBtn.addEventListener('click', closeChat);

    // 初始狀態檢查
    updateNotifyBtnState();
}

/**
 * 開啟聊天室
 * @param {string} type - 'manager' | 'friend'
 * @param {string} name - Friend's name
 */
function openChat(type, name) {
    // 1. 設定聊天室內容
    if (type === 'manager') {
        // AI 經理人模式
        chatContainer.innerHTML = aiManagerContentHTML; // 恢復歡迎訊息
        chatUsername.textContent = "AI 私人經理";
        chatStatus.textContent = "隨時待命";
        chatAvatar.src = "https://ui-avatars.com/api/?name=AI&background=0095F6&color=fff";

        // 顯示 Dashboard (Memos)
        document.querySelector('.dashboard').style.display = 'flex';
        modeSelect.value = 'manager';

        // 恢復之前的 Memos
        loadMemos();
    } else {
        // 朋友閒聊模式
        chatContainer.innerHTML = ''; // 清空聊天紀錄
        chatUsername.textContent = name;
        chatStatus.textContent = "上線中";
        chatAvatar.src = `https://ui-avatars.com/api/?name=${name}&background=random`;

        // 增加一個簡單的歡迎氣泡
        addMessage(`與 ${name} 的對話開始`, 'center'); // 我們需要修改 addMessage 支援 center 嗎？暫時用 left 或做個特殊處理

        // 隱藏 Dashboard (暫時) 或 保持顯示但不相關
        // 為了 UI 完整性，我們保持 Dashboard 但也許可以隱藏內容？
        // 這裡暫時隱藏 Dashboard 讓聊天視窗變寬 (Mobile style for everyone?)
        // 或者保持不動。requirements 說 "click other friends temporarily just need to enter an empty chat interface"
        // 讓我們保持 Dashboard 顯示，這樣比較像 "App 的原有介面"

        modeSelect.value = 'chat';
    }

    // 2. 執行轉場動畫
    contactListView.classList.add('slide-out-left');
    chatInterfaceView.classList.add('active-view');
}

/**
 * 關閉聊天室 (返回列表)
 */
function closeChat() {
    contactListView.classList.remove('slide-out-left');
    chatInterfaceView.classList.remove('active-view');

    // 收起鍵盤 (Mobile)
    messageInput.blur();
}

function addMessage(text, side) {
    const messageDiv = document.createElement('div');

    if (side === 'center') {
        messageDiv.classList.add('time-stamp'); // 重用 time-stamp 樣式
        messageDiv.textContent = text;
        chatContainer.appendChild(messageDiv);
        scrollToBottom();
        return;
    }

    messageDiv.classList.add('message', side);

    if (side === 'left') {
        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('avatar-small');
        // 根據目前聊天對象獲取頭像，這裡簡化使用 chatAvatar 的 src
        const currentAvatarSrc = chatAvatar.src;
        avatarDiv.innerHTML = `<img src="${currentAvatarSrc}" alt="Avatar">`;
        messageDiv.appendChild(avatarDiv);
    }

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.innerHTML = text.replace(/\n/g, '<br>');

    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);

    scrollToBottom();
}


// 啟動 App
initApp();


// --- 通知系統相關功能 (保留並優化) ---

// 1. 初始化與按鈕監聽
const notifyBtn = document.getElementById('notify-btn');
notifyBtn.addEventListener('click', () => {
    if (Notification.permission !== "granted") {
        Notification.requestPermission().then(permission => {
            updateNotifyBtnState();
            if (permission === "granted") {
                new Notification("通知已啟用", { body: "我會準時提醒您！" });
            }
        });
    }
});

function updateNotifyBtnState() {
    if (Notification.permission === "granted") {
        notifyBtn.classList.add('active');
        notifyBtn.title = "通知已啟用";
    } else {
        notifyBtn.classList.remove('active');
        notifyBtn.title = "點擊啟用通知";
    }
}

// 2. 定時檢查系統
setInterval(checkReminders, 10000);

function checkReminders() {
    if (Notification.permission !== "granted") return;

    const now = new Date();
    const currentFullTime = formatTime(now);
    const currentShortTime = formatTimeShort(now);

    let updated = false;

    memos.forEach(memo => {
        if (memo.notified || memo.completed) return;

        let shouldNotify = false;

        if (memo.time === currentFullTime) {
            shouldNotify = true;
        }
        else if (memo.time && memo.time.includes(currentShortTime)) {
            shouldNotify = true;
        }

        if (shouldNotify) {
            sendNotification(memo);
            memo.notified = true;
            memo.completed = true;
            renderMemo(memo);
            updated = true;
        }
    });

    if (updated) {
        saveMemos();
    }
}

function sendNotification(memo) {
    const n = new Notification("經理人提醒", {
        body: memo.title,
        icon: "https://ui-avatars.com/api/?name=AI&background=0095F6&color=fff",
        requireInteraction: true
    });

    n.onclick = function () {
        window.focus();
        this.close();
    };

    playNotificationSound();
}

function playNotificationSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
}

function formatTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTimeShort(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
