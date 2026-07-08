// ==================== APP STATE & FIREBASE SYNC ====================
const CURRENT_YEAR = 2026;

// Your custom Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBquRiheT2V4gti_cVtGxJ2T0XILKlNHhg",
  authDomain: "solochat-7c5a7.firebaseapp.com",
  databaseURL: "https://solochat-7c5a7-default-rtdb.firebaseio.com",
  projectId: "solochat-7c5a7",
  storageBucket: "solochat-7c5a7.firebasestorage.app",
  messagingSenderId: "28034019250",
  appId: "1:28034019250:web:964a7aeafc73a773147eab",
  measurementId: "G-XGE2Q4FBND"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentChatRef = null; // Active Firebase chat room reference
let clientUniqueId = 'dokju_cl_' + Math.random().toString(16).substring(2, 10);
let toastTimeout = null;
let activeToastFromTable = null;

const state = {
  mode: 'guest',   // 'guest' | 'member'
  user: null,      // { nickname, gender, age, table, mood, joinDate }
  ordered: false,  // Unlocks chat features
  cart: [],
  chats: {},       // tableNum -> [{senderTable, text, time, timestamp, isUnread}]
  activeChatTable: null,
  activeTab: 'bar',
  chatView: 'list', // 'list' | 'room' (mobile two-stage chat view)
  serverTables: {}, // Live Firebase database occupancy states
  tickerLogs: [
    { table: 3, item: 'Dom Pérignon', amount: 1200000 },
    { table: 8, item: 'Macallan 18y', amount: 850000 },
    { table: 1, item: 'Jameson Bottle', amount: 180000 }
  ]
};

// Base mock seating (now initialized and synchronised dynamically from Firebase)
const mockSeating = {};

const GUEST_POOL = [
  { name: '민우', age: 28, gender: 'male', mbti: 'ENFP', interests: '사진, 카페 투어, 보드게임', favDrink: '기네스 드래프트', rating: '⭐ 4.8', avatar: '👦' },
  { name: '수진', age: 32, gender: 'female', mbti: 'ISFJ', interests: '요가, 도자기 공예, 영화', favDrink: '피치 크러시', rating: '⭐ 4.9', avatar: '👩' },
  { name: '준영', age: 35, gender: 'male', mbti: 'INTP', interests: '코딩, 게임, 테니스', favDrink: '와일드 터키 8년', rating: '⭐ 4.6', avatar: '🧔' },
  { name: '혜원', age: 25, gender: 'female', mbti: 'ESFJ', interests: '맛집 탐방, 네일아트, 댄스', favDrink: '얼그레이 하이볼', rating: '⭐ 4.8', avatar: '👧' },
  { name: '태우', age: 30, gender: 'male', mbti: 'ISTP', interests: '드라이브, 가죽 공예, 바이크', favDrink: '라가불린 16년', rating: '⭐ 4.7', avatar: '👨' },
  { name: '유진', age: 27, gender: 'female', mbti: 'ENFP', interests: '보컬, 등산, 베이킹', favDrink: '독주 시그니처 하이볼', rating: '⭐ 4.9', avatar: '👱‍♀️' }
];

// ==================== PRODUCTS LIST ====================
const PRODUCTS = [
  // Bottles
  { id: 'b1', cat: 'bottle', name: '돔 페리뇽 (Dom Pérignon)', price: 1200000, desc: 'FLEX의 완벽한 상징. 최고급 빈티지 샴페인.', icon: '🍾', tag: 'flex' },
  { id: 'b2', cat: 'bottle', name: '맥캘란 18년 (Macallan 18y)', price: 850000, desc: '싱글몰트의 명작. 깊은 오크향과 스파이스.', icon: '🥃', tag: 'best' },
  { id: 'b3', cat: 'bottle', name: '발베니 12년 (Balvenie 12y)', price: 280000, desc: '꿀향과 바닐라 힌트. 부드러운 입문 보틀.', icon: '🍷', tag: 'md' },
  
  // Glasses (잔술)
  { id: 'g1', cat: 'glass', name: '글렌피딕 12년 (Glenfiddich 12y)', price: 18000, desc: '상큼한 청사과 향이 싱그러운 입문용 싱글몰트.', icon: '🥃', tag: null },
  { id: 'g2', cat: 'glass', name: '발베니 12년 (Balvenie 12y)', price: 20000, desc: '꿀처럼 부드러운 단맛과 바닐라 오크 향.', icon: '🥃', tag: 'best' },
  { id: 'g3', cat: 'glass', name: '맥캘란 12년 셰리 (Macallan 12y)', price: 22000, desc: '셰리 오크 캐스크의 깊은 건과일 향과 스파이스.', icon: '🥃', tag: 'best' },
  { id: 'g4', cat: 'glass', name: '라가불린 16년 (Lagavulin 16y)', price: 28000, desc: '피트 위스키의 명작. 강렬한 스모키함과 긴 여운.', icon: '🥃', tag: 'flex' },
  { id: 'g5', cat: 'glass', name: '제임슨 블랙 배럴 (Jameson BB)', price: 14000, desc: '이중 탄화 버번 오크통 숙성의 진하고 부드러운 맛.', icon: '🥃', tag: null },
  { id: 'g6', cat: 'glass', name: '산토리 가쿠빈 하이볼', price: 12000, desc: '탄산수와 레몬 슬라이스를 더한 청량함의 정석.', icon: '🍹', tag: null },
  { id: 'g7', cat: 'glass', name: '독주 바나나 시그니처 하이볼', price: 14000, desc: 'DOKJU만의 수제 바나나 시럽이 들어간 달콤 청량 하이볼.', icon: '🍹', tag: 'best' },
  { id: 'g8', cat: 'glass', name: '클래식 마티니 (Martini)', price: 18000, desc: '칵테일의 왕. 올리브와 함께 즐기는 드라이한 한 잔.', icon: '🍸', tag: null },
  { id: 'g9', cat: 'glass', name: '갓파더 (Godfather)', price: 17000, desc: '스카치 위스키와 아마레토의 묵직하고 달콤한 조화.', icon: '🥃', tag: null },
  { id: 'g10', cat: 'glass', name: '기네스 드래프트 (Guinness)', price: 13000, desc: '질소 가스의 크리미한 거품이 살아있는 아일랜드 흑맥주.', icon: '🍺', tag: null },

  // Smart Corkage
  { id: 'c1', cat: 'corkage', name: '콜키지 기본 (1~2인)', price: 3000, desc: '외부 안주 반입 · 식기 세트 제공.', icon: '🍽️', tag: 'cork' },
  { id: 'c2', cat: 'corkage', name: '콜키지 단체 (3~4인)', price: 5000, desc: '외부 안주 반입 · 여유 식기 + 잔 교체.', icon: '🍴', tag: 'cork' },

  // Bartender Tips
  { id: 't1', cat: 'tips', name: '바텐더 샷 선물', price: 10000, desc: '바텐더에게 감사를 표하는 잔술 선물.', icon: '🥃', tag: 'cheers' },
  { id: 't2', cat: 'tips', name: '바텐더 프리미엄 칵테일', price: 20000, desc: '대화 텐션을 끌어올리는 선물 칵테일.', icon: '🍹', tag: 'cheers' },
  { id: 't3', cat: 'tips', name: '골든 치얼스 팁', price: 50000, desc: '최고의 서비스를 위한 스페셜 골드 팁.', icon: '🏆', tag: 'cheers' }
];

// ==================== LOCAL STORAGE HELPERS ====================
const LS = {
  USER_KEY: 'dokju_user',
  ORDERS_KEY: 'dokju_orders',
  CHATS_KEY: 'dokju_chats',

  saveUser(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },
  loadUser() {
    try { return JSON.parse(localStorage.getItem(this.USER_KEY)); } catch { return null; }
  },
  clearUser() {
    localStorage.removeItem(this.USER_KEY);
  },
  saveOrders(orders) {
    localStorage.setItem(this.ORDERS_KEY, JSON.stringify(orders));
  },
  loadOrders() {
    try { return JSON.parse(localStorage.getItem(this.ORDERS_KEY)) || []; } catch { return []; }
  },
  addOrder(orderItem) {
    const orders = this.loadOrders();
    orders.unshift(orderItem);
    if (orders.length > 100) orders.pop();
    this.saveOrders(orders);
  },
  saveChats(chats) {
    localStorage.setItem(this.CHATS_KEY, JSON.stringify(chats));
  },
  loadChats() {
    try { return JSON.parse(localStorage.getItem(this.CHATS_KEY)) || {}; } catch { return {}; }
  }
};

// ==================== DOM SHORTCUTS ====================
const $ = id => document.getElementById(id);
const screens = {
  gate: $('screen-gate'),
  auth: $('screen-auth'),
  blocked: $('screen-blocked'),
  main: $('screen-main')
};

// ==================== BOOT ====================
document.addEventListener('DOMContentLoaded', () => {
  populateBirthYear();
  bindEvents();
  renderFlex();
  renderMenu('bottle');

  // Auto-restore login from localStorage
  const saved = LS.loadUser();
  if (saved) {
    state.user = saved;
    state.mode = 'member';
    state.chats = LS.loadChats();
    state.ordered = LS.loadOrders().length > 0;
    applyMemberSession();
    showScreen('main');
    initFirebaseSync();
    if (state.ordered) {
      startProactiveChatTimer();
    }
  }
});

function populateBirthYear() {
  const sel = $('birth-year');
  for (let y = CURRENT_YEAR - 19; y >= CURRENT_YEAR - 65; y--) {
    const o = document.createElement('option');
    o.value = y;
    o.textContent = `${y}년생 (만 ${CURRENT_YEAR - y}세)`;
    sel.appendChild(o);
  }
}

function populateSeatingSelect() {
  if (!db) return;
  db.ref('tables').once('value', (snapshot) => {
    const occupied = snapshot.val() || {};
    const select = $('seat-table-select');
    if (!select) return;
    
    select.innerHTML = '<option value="" disabled selected>테이블 선택</option>';
    
    const descriptions = {
      1: "1번 (U바 좌측)",
      2: "2번 (U바 좌측)",
      3: "3번 (U바 좌측)",
      4: "4번 (U바 내측)",
      5: "5번 (U바 내측)",
      6: "6번 (U바 우측)",
      7: "7번 (U바 우측)",
      8: "8번 (U바 우측)"
    };

    for (let t = 1; t <= 8; t++) {
      const isTaken = !!occupied[t];
      const opt = document.createElement('option');
      opt.value = t;
      if (isTaken) {
        opt.textContent = `${descriptions[t]} - [이용 중]`;
        opt.disabled = true;
      } else {
        opt.textContent = descriptions[t];
      }
      select.appendChild(opt);
    }
  });
}

// ==================== EVENT BINDINGS ====================
function bindEvents() {
  // Gate buttons
  $('btn-kakao-login').onclick = () => {
    populateSeatingSelect();
    showScreen('auth');
  };
  $('btn-guest-enter').onclick = enterGuestMode;

  // Auth Back/Exit buttons
  $('btn-auth-close').onclick = () => showScreen('gate');
  $('btn-blocked-back').onclick = () => showScreen('gate');

  // Select all terms
  $('chk-all-terms').onchange = function () {
    document.querySelectorAll('.chk-sub').forEach(c => c.checked = this.checked);
  };

  // Auth form submit
  $('auth-form').onsubmit = handleAuthSubmit;

  // Logout
  $('btn-logout').onclick = handleLogout;

  // Nav tabs
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Mood toggle
  $('mood-btn-solo').onclick = () => setMood('solo');
  $('mood-btn-talk').onclick = () => setMood('talk');

  // Guest login prompts
  $('btn-guest-login-from-bar').onclick = () => showScreen('auth');

  // Seat card clicks (delegated)
  document.querySelector('.ubar-visual').addEventListener('click', e => {
    const card = e.target.closest('.seat-card');
    if (!card) return;
    handleSeatClick(parseInt(card.dataset.table));
  });

  // Menu category tabs
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMenu(btn.dataset.category);
    });
  });

  // Cart checkout
  $('btn-cart-checkout').onclick = handleCheckout;

  // Chat overlays
  $('btn-kakao-login').onclick = () => showScreen('auth');
  $('btn-guest-enter').onclick = enterGuestMode;

  // Profile modal bindings
  $('btn-profile-close').onclick = hideProfileCard;
  $('btn-profile-start-chat').onclick = () => {
    const t = selectedProfileTable;
    hideProfileCard();
    if (!t) return;
    if (state.mode === 'guest') {
      startChat(t); return;
    }
    if (!state.ordered) {
      switchTab('chat');
      showPayLock(); return;
    }
    startChat(t);
  };

  // Chat back button (Stage 2 -> Stage 1)
  $('btn-chat-back').onclick = () => {
    state.chatView = 'list';
    state.activeChatTable = null;
    if (currentChatRef) {
      currentChatRef.off();
      currentChatRef = null;
    }
    // Toggle views
    $('chat-list-view').classList.remove('hidden');
    $('chat-room-view').classList.add('hidden');
    renderChatListView();
  };

  // Chat send
  $('btn-chat-send').onclick = sendMessage;
  $('chat-input').addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });

  // Click on chat input when guest -> show gate
  $('chat-input').addEventListener('focus', () => {
    if (state.mode === 'guest') {
      $('chat-input').blur();
      showSendGate();
    }
  });

  // Global toast click hook
  $('global-toast').onclick = () => {
    $('global-toast').classList.add('hidden');
    if (activeToastFromTable !== null) {
      startChat(activeToastFromTable);
    }
  };
}

// ==================== SCREEN MANAGEMENT ====================
function showScreen(key) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[key].classList.add('active');
}

// ==================== GUEST MODE ====================
function enterGuestMode() {
  state.mode = 'guest';
  updateHeaderForGuest();
  showScreen('main');
  renderFlex();
  initFirebaseSync(); // Read-only presence listeners
}

function updateHeaderForGuest() {
  $('header-user-chip').classList.add('hidden');
  $('btn-logout').classList.add('hidden');
  $('header-guest-badge').classList.remove('hidden');
  $('my-status-card').classList.add('hidden');
  $('guest-bar-banner').classList.remove('hidden');
}

// ==================== AUTH FLOW ====================
function handleAuthSubmit(e) {
  e.preventDefault();

  const nickname = $('input-nickname').value.trim();
  const genderEl = document.querySelector('input[name="gender"]:checked');
  if (!genderEl) { alert('성별을 선택해 주세요.'); return; }

  const gender = genderEl.value;
  const birthYear = parseInt($('birth-year').value);
  const table = parseInt($('seat-table-select').value);
  const age = CURRENT_YEAR - birthYear;

  if (isNaN(table)) { alert('착석할 테이블을 선택해 주세요.'); return; }

  // Age gate
  if (gender === 'male' && age < 30) return showBlocked(`남성은 30세 이상만 입장 가능합니다.\n현재 만 ${age}세입니다.`);
  if (gender === 'female' && age < 25) return showBlocked(`여성은 25세 이상만 입장 가능합니다.\n현재 만 ${age}세입니다.`);

  // Double check seat availability on Firebase
  db.ref(`tables/${table}`).once('value', (snapshot) => {
    if (snapshot.exists()) {
      alert(`${table}번 테이블은 이미 다른 손님이 착석하셨습니다. 다른 자리를 선택해 주세요.`);
      populateSeatingSelect();
      return;
    }

    // Commit
    state.user = { nickname, gender, age, table, mood: 'solo', joinDate: new Date().toLocaleDateString('ko-KR') };
    state.mode = 'member';
    state.chats = LS.loadChats();
    state.ordered = LS.loadOrders().length > 0;

    LS.saveUser(state.user);

    applyMemberSession();
    showScreen('main');
    initFirebaseSync();
  });
}

function showBlocked(reason) {
  $('blocked-reason').textContent = reason;
  showScreen('blocked');
}

function applyMemberSession() {
  const u = state.user;
  // Header UI
  $('header-user-chip').textContent = `${u.nickname} · ${u.table}번`;
  $('header-user-chip').classList.remove('hidden');
  $('btn-logout').classList.remove('hidden');
  $('header-guest-badge').classList.add('hidden');

  // Status Card UI
  $('my-status-card').classList.remove('hidden');
  $('guest-bar-banner').classList.add('hidden');
  $('my-avatar-bubble').textContent = u.gender === 'male' ? '🧔' : '👩';
  $('my-nickname-label').textContent = u.nickname;
  $('my-meta-label').textContent = `${u.gender === 'male' ? 'M' : 'F'}${u.age} · ${u.table}번 테이블`;

  setMoodUI(u.mood);
  renderOrderHistory();
}

function handleLogout() {
  if (!confirm('로그아웃 하시겠어요?')) return;

  if (proactiveChatInterval) clearInterval(proactiveChatInterval);
  if (seatingDriftInterval) clearInterval(seatingDriftInterval);

  // Remove presence node from database
  if (state.user && db) {
    db.ref(`tables/${state.user.table}`).remove();
    // Unbind inbox listener
    db.ref(`whisper_inboxes/${state.user.table}`).off();
  }

  LS.clearUser();

  // Reset local states
  state.user = null;
  state.mode = 'guest';
  state.ordered = false;
  state.cart = [];
  state.chats = {};
  state.activeChatTable = null;
  state.serverTables = {};

  if (currentChatRef) {
    currentChatRef.off();
    currentChatRef = null;
  }

  showScreen('gate');
}

// ==================== MOOD ====================
function setMood(mood) {
  if (!state.user) return;
  state.user.mood = mood;
  LS.saveUser(state.user);
  setMoodUI(mood);
  
  // Publish updated presence
  if (state.mode === 'member') {
    db.ref(`tables/${state.user.table}/mood`).set(mood);
  }
}

function setMoodUI(mood) {
  $('mood-btn-solo').classList.toggle('active', mood === 'solo');
  $('mood-btn-talk').classList.toggle('active', mood === 'talk');
}

// ==================== FIREBASE REALTIME SYNC ====================
function initFirebaseSync() {
  // 0. Initialize tables if empty in Firebase
  db.ref('tables').once('value', (snapshot) => {
    const val = snapshot.val();
    if (!val || Object.keys(val).length === 0) {
      const initialMocks = {
        1: { name: '정우', nickname: '정우', gender: 'male', age: 34, mood: 'talk', isMock: true, profile: { mbti: "ENTJ", interests: "금융, 테크, 골프", favDrink: "맥캘란 18년", rating: "⭐ 4.9", avatar: "🧔" } },
        2: { name: '민지', nickname: '민지', gender: 'female', age: 26, mood: 'solo', isMock: true, profile: { mbti: "INFP", interests: "패션, 전시회, 독서", favDrink: "시그니처 진토닉", rating: "⭐ 4.8", avatar: "👩" } },
        3: { name: '도현', nickname: '도현', gender: 'male', age: 31, mood: 'talk', isMock: true, profile: { mbti: "ESTP", interests: "피트니스, 바디프로필, 여행", favDrink: "산토리 하이볼", rating: "⭐ 4.7", avatar: "🏋️" } },
        6: { name: '지수', nickname: '지수', gender: 'female', age: 29, mood: 'talk', isMock: true, profile: { mbti: "ENFJ", interests: "IT 기획, 고양이, 페스티벌", favDrink: "발베니 12년", rating: "⭐ 4.9", avatar: "👩‍💻" } },
        8: { name: '성민', nickname: '성민', gender: 'male', age: 36, mood: 'talk', isMock: true, profile: { mbti: "INTJ", interests: "회계, 클래식 음악, 독서", favDrink: "클래식 마티니", rating: "⭐ 5.0", avatar: "👨‍💼" } }
      };
      db.ref('tables').set(initialMocks);
    }
  });

  // 1. Listen for global seating presence
  db.ref('tables').on('value', (snapshot) => {
    const tables = snapshot.val() || {};
    state.serverTables = {};
    Object.keys(tables).forEach(t => {
      const tableNum = parseInt(t);
      if (!state.user || tableNum !== state.user.table) {
        state.serverTables[tableNum] = tables[t];
      }
    });
    refreshSeatMap();
  });

  // 1.5. Listen for group chat room
  db.ref('chats/group_ubar').limitToLast(30).on('value', (snapshot) => {
    const msgsObj = snapshot.val() || {};
    const msgs = Object.values(msgsObj).sort((a,b) => a.timestamp - b.timestamp);
    state.groupChat = msgs;
    
    if (state.activeTab === 'chat' && state.chatView === 'room' && state.activeChatTable === 'group') {
      renderChatWindow('group');
    } else if (state.activeTab === 'chat' && state.chatView === 'list') {
      renderChatListView();
    }
  });

  // 1.6. Group Chat Bot Responder
  db.ref('chats/group_ubar').on('child_added', (snapshot) => {
    const msg = snapshot.val();
    if (!msg || !state.user) return;
    if (msg.senderTable === state.user.table) {
      triggerGroupRoomReplies(msg.text);
    }
  });

  // 2. Listen for real-time global FLEX order ticker
  db.ref('flex_logs').limitToLast(5).on('child_added', (snapshot) => {
    const log = snapshot.val();
    if (log) {
      addTickerLog(log.table, log.item, log.amount);
    }
  });

  // 3. Register self as active seat (Member only)
  if (state.mode === 'member' && state.user) {
    const u = state.user;
    const tableRef = db.ref(`tables/${u.table}`);
    
    tableRef.set({
      nickname: u.nickname,
      gender: u.gender,
      age: u.age,
      mood: u.mood,
      clientId: clientUniqueId,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });

    // Cleanup seat on exit/refresh/disconnect
    tableRef.onDisconnect().remove();

    // 4. Retrieve initial database orders to check if order has already been completed
    db.ref('orders').orderByChild('table').equalTo(u.table).once('value', (snapshot) => {
      const ordersObj = snapshot.val() || {};
      const hasCompleted = Object.values(ordersObj).some(o => o.status === 'completed');
      if (hasCompleted) {
        state.ordered = true;
        if (state.activeTab === 'chat') {
          renderChatListView();
        }
        startProactiveChatTimer();
      }
    });

    // 5. Watch for real-time updates to orders to unlock client dynamically when POS serves it
    db.ref('orders').orderByChild('table').equalTo(u.table).on('child_changed', (snapshot) => {
      const order = snapshot.val();
      if (order && order.status === 'completed' && !state.ordered) {
        state.ordered = true;
        alert('주문하신 품목이 서비스 완료되었습니다!\n귓속말 기능이 잠금해제 되었습니다.');
        
        // Inject a dummy order locally if they didn't have one to keep state
        const localOrders = LS.loadOrders();
        if (localOrders.length === 0) {
          LS.addOrder({ id: Date.now(), name: '기본 입장권', icon: '🎟️', price: 0, date: new Date().toLocaleDateString('ko-KR'), time: new Date().toLocaleTimeString('ko-KR') });
        }
        renderOrderHistory();
        switchTab('chat');
        startProactiveChatTimer();
      }
    });

    // 6. Listen for incoming whispers notifications queue (inbox)
    db.ref(`whisper_inboxes/${u.table}`).on('child_added', (snapshot) => {
      const msg = snapshot.val();
      if (msg) {
        // Clear inbox queue item immediately to avoid database footprint
        db.ref(`whisper_inboxes/${u.table}/${snapshot.key}`).remove();
        
        // Handle incoming message routing
        onWhisperIn(msg.from, msg.text, msg.time);
      }
    });
  }
}

// ==================== SEAT MAP ====================
function refreshSeatMap() {
  const merged = { ...state.serverTables };
  if (state.user) {
    merged[state.user.table] = { ...state.user, isSelf: true };
  }

  for (let t = 1; t <= 8; t++) {
    const card = document.querySelector(`.seat-card[data-table="${t}"]`);
    if (!card) continue;
    const info = merged[t];

    if (!info) {
      card.className = 'seat-card empty';
      card.querySelector('.seat-av').textContent = '＋';
      card.querySelector('.seat-mood').textContent = '빈자리';
      card.querySelector('.seat-mood').className = 'seat-mood';
      card.classList.remove('has-unread-msg');
      continue;
    }

    const isSolo = info.mood === 'solo';
    card.className = `seat-card occupied ${info.gender} ${isSolo ? 'solo' : 'welcome'}${info.isSelf ? ' self-seat' : ''}`;
    card.querySelector('.seat-av').textContent = info.profile?.avatar || (info.gender === 'male' ? '👦🏻' : '👩🏻');
    const moodEl = card.querySelector('.seat-mood');
    moodEl.textContent = isSolo ? '혼술' : '대화';
    moodEl.className = 'seat-mood ' + (isSolo ? 'solo-mood' : 'welcome-mood');

    // Flashing unread highlight on seat card if there are unread whispers
    const thread = state.chats[t] || [];
    const hasUnread = thread.some(m => m.senderTable === t && m.isUnread);
    card.classList.toggle('has-unread-msg', hasUnread);
  }
}

function handleSeatClick(tableNum) {
  const card = document.querySelector(`.seat-card[data-table="${tableNum}"]`);
  if (!card || card.classList.contains('empty')) {
    alert(`${tableNum}번 테이블은 빈자리입니다.`); return;
  }
  if (state.user && tableNum === state.user.table) {
    alert('내 테이블입니다.'); return;
  }
  showProfileCard(tableNum);
}

// ==================== FLEX TICKER ====================
function renderFlex() {
  const ticker = $('flex-ticker');
  ticker.innerHTML = '';
  const doubled = [...state.tickerLogs, ...state.tickerLogs];
  doubled.forEach(log => {
    const span = document.createElement('span');
    const amt = log.amount;
    if (amt >= 500000) {
      span.className = 'flex-item gold-item';
      span.textContent = `🍾 ${log.table}번 테이블 ${log.item} ${amt.toLocaleString()}원 FLEX! 🔥`;
    } else {
      span.className = 'flex-item';
      span.textContent = `🥃 ${log.table}번 테이블 ${log.item} 주문완료`;
    }
    ticker.appendChild(span);
  });
}

function addTickerLog(table, item, amount) {
  const duplicate = state.tickerLogs.some(log => log.table === table && log.item === item && log.amount === amount);
  if (duplicate) return;

  state.tickerLogs.unshift({ table, item, amount: Number(amount) });
  if (state.tickerLogs.length > 8) state.tickerLogs.pop();
  renderFlex();
}

// ==================== MENU & CART ====================
function renderMenu(cat) {
  const container = $('menu-list');
  container.innerHTML = '';
  PRODUCTS.filter(p => p.cat === cat).forEach(p => {
    const inCart = state.cart.some(c => c.id === p.id);
    const row = document.createElement('div');
    row.className = `menu-row${inCart ? ' selected' : ''}`;

    const tagMap = { flex: 'tag-flex', best: 'tag-best', md: 'tag-md', cork: 'tag-cork', cheers: 'tag-cheers' };
    const tagHtml = p.tag ? `<span class="menu-row-tag ${tagMap[p.tag]}">${p.tag.toUpperCase()}</span>` : '';

    row.innerHTML = `
      ${tagHtml}
      <span class="menu-row-icon">${p.icon}</span>
      <div class="menu-row-info">
        <div class="menu-row-name">${p.name}</div>
        <div class="menu-row-desc">${p.desc}</div>
      </div>
      <div class="menu-row-right">
        <span class="menu-row-price">${p.price.toLocaleString()}원</span>
        <button class="btn-add" data-pid="${p.id}">${inCart ? '✓' : '+'}</button>
      </div>
    `;
    container.appendChild(row);
  });

  // Bind add buttons
  container.querySelectorAll('.btn-add').forEach(btn => {
    btn.addEventListener('click', () => toggleCart(btn.dataset.pid));
  });
}

function toggleCart(pid) {
  const idx = state.cart.findIndex(c => c.id === pid);
  if (idx > -1) state.cart.splice(idx, 1);
  else {
    const p = PRODUCTS.find(p => p.id === pid);
    if (p) state.cart.push(p);
  }
  updateCartUI();
  
  const activeCat = document.querySelector('.cat-btn.active');
  if (activeCat) renderMenu(activeCat.dataset.category);
}

function updateCartUI() {
  const qty = state.cart.length;
  const total = state.cart.reduce((s, i) => s + i.price, 0);
  $('cart-qty').textContent = qty;
  $('cart-total-amount').textContent = total.toLocaleString();
}

function handleCheckout() {
  if (state.cart.length === 0) { alert('담긴 메뉴가 없습니다.'); return; }
  if (state.mode === 'guest') { alert('관람 모드에서는 결제할 수 없습니다.'); return; }

  const total = state.cart.reduce((s, i) => s + i.price, 0);
  alert(`카드 결제 승인\n합계: ${total.toLocaleString()}원`);

  const now = new Date();
  const date = now.toLocaleDateString('ko-KR');
  const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  // 1. Submit central Order to Firebase Database
  const orderRef = db.ref('orders').push();
  orderRef.set({
    table: state.user.table,
    nickname: state.user.nickname,
    items: state.cart.map(i => ({ name: i.name, price: i.price, icon: i.icon, cat: i.cat })),
    total: total,
    status: 'pending',
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    date: date,
    time: time
  });

  const hasTip = state.cart.find(i => i.cat === 'tips');

  state.cart.forEach(item => {
    // 2. Save locally for order history
    LS.addOrder({ id: Date.now() + Math.random(), name: item.name, icon: item.icon, price: item.price, date, time });

    // 3. Broadcast high values/cheers to Firebase logs
    db.ref('flex_logs').push().set({
      table: state.user.table,
      item: item.name,
      amount: item.price,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    // Add to local ticker immediately
    if (item.price >= 10000) {
      addTickerLog(state.user.table, item.name, item.price);
    }
  });

  if (hasTip) showCheers(hasTip);
  else alert('주문이 접수되었습니다! 사장님이 포스기(admin.html)에서 확인/완료 하시면 귓속말 기능이 해제됩니다.');

  state.cart = [];
  updateCartUI();
  
  const activeCat = document.querySelector('.cat-btn.active');
  if (activeCat) renderMenu(activeCat.dataset.category);
  
  renderOrderHistory();
}

// ==================== ORDER HISTORY ====================
function renderOrderHistory() {
  const container = $('orders-list');
  const totalBar = $('orders-total-bar');
  const subtitle = $('orders-subtitle');

  const orders = LS.loadOrders();

  if (state.mode === 'guest') {
    subtitle.textContent = '로그인 후 주문 내역을 확인할 수 있습니다.';
    container.innerHTML = '<div class="orders-empty"><span>🔐</span><p>로그인 후 이용 가능합니다</p></div>';
    totalBar.classList.add('hidden');
    return;
  }

  subtitle.textContent = `${state.user.nickname}님의 누적 주문 내역`;

  if (orders.length === 0) {
    container.innerHTML = '<div class="orders-empty"><span>🛒</span><p>아직 주문 내역이 없습니다</p></div>';
    totalBar.classList.add('hidden');
    return;
  }

  container.innerHTML = '';
  let grand = 0;
  orders.forEach(o => {
    grand += o.price;
    const row = document.createElement('div');
    row.className = 'order-row';
    row.innerHTML = `
      <div class="order-row-left">
        <span class="order-row-icon">${o.icon}</span>
        <div>
          <div class="order-row-name">${o.name}</div>
          <div class="order-row-date">${o.date} ${o.time}</div>
        </div>
      </div>
      <span class="order-row-price">${o.price.toLocaleString()}원</span>
    `;
    container.appendChild(row);
  });

  $('orders-grand-total').textContent = grand.toLocaleString() + '원';
  totalBar.classList.remove('hidden');
}

// ==================== CHAT SERVICES ====================
function showSendGate() {
  $('chat-send-gate').classList.remove('hidden');
}
function hideSendGate() {
  $('chat-send-gate').classList.add('hidden');
}
function showPayLock() {
  $('chat-lock-overlay').classList.remove('hidden');
}
function hidePayLock() {
  $('chat-lock-overlay').classList.add('hidden');
}

function startChat(tableNum) {
  state.activeChatTable = tableNum;
  state.chatView = 'room';
  
  if (state.activeTab !== 'chat') {
    switchTab('chat');
  } else {
    // Already in chat tab, just swap local layouts
    $('chat-list-view').classList.add('hidden');
    $('chat-room-view').classList.remove('hidden');
    hidePayLock();
    hideSendGate();
  }
  
  // Unbind previous listener if exists
  if (currentChatRef) {
    currentChatRef.off();
  }

  // Subscribe to Central Firebase Chat Room for real-time whispers
  const selfTable = state.user ? state.user.table : 99; // 99 indicates guest viewer room
  const roomId = getRoomId(selfTable, tableNum);
  currentChatRef = db.ref(`chats/${roomId}`);
  
  currentChatRef.on('value', (snapshot) => {
    const messages = snapshot.val() || {};
    // Sort items by ascending order of creation timestamp
    const list = Object.values(messages).sort((a, b) => a.timestamp - b.timestamp);
    state.chats[tableNum] = list;
    LS.saveChats(state.chats);
    
    // Clear unread flag for this room dynamically in Firebase DB
    if (state.mode === 'member' && state.user) {
      Object.keys(messages).forEach(msgId => {
        if (messages[msgId].senderTable !== state.user.table && messages[msgId].isUnread) {
          db.ref(`chats/${roomId}/${msgId}/isUnread`).set(false);
        }
      });
    }

    if (state.activeChatTable === tableNum && state.activeTab === 'chat') {
      renderChatWindow(tableNum);
    }
  });
}

// Stage 1: Full width Chat List View renderer
function renderChatListView() {
  const container = $('chat-threads-container');
  container.innerHTML = '';

  // 1. Render Ubar Group Chat Row
  const groupThread = state.groupChat || [];
  let groupSnippet = 'U자형 바의 모든 손님들과 다 함께 대화해보세요';
  let groupTime = '';
  if (groupThread.length > 0) {
    const lastMsg = groupThread[groupThread.length - 1];
    groupSnippet = `${lastMsg.senderTable}번 테이블 ${lastMsg.senderName}: ${lastMsg.text}`;
    groupTime = lastMsg.time;
  }

  const groupRow = document.createElement('div');
  groupRow.className = 'chat-list-row group-row';
  groupRow.innerHTML = `
    <div class="row-av">
      <span>📢</span>
    </div>
    <div class="row-info">
      <div class="row-title-line">
        <span class="row-title">📢 U바 단체 대화방</span>
        <span class="row-time">${groupTime}</span>
      </div>
      <div class="row-msg-snippet">${groupSnippet}</div>
    </div>
    <div class="row-right"></div>
  `;
  groupRow.addEventListener('click', () => {
    state.chatView = 'room';
    state.activeChatTable = 'group';
    renderChatWindow('group');
  });
  container.appendChild(groupRow);

  // 2. Render 1:1 threads dynamically from occupied tables in Firebase
  const tableList = Object.keys(state.serverTables)
    .map(Number)
    .filter(t => !state.user || t !== state.user.table)
    .sort((a, b) => a - b);

  tableList.forEach(t => {
    const card = document.querySelector(`.seat-card[data-table="${t}"]`);
    const avatar = card?.querySelector('.seat-av')?.textContent || '👤';
    const isSolo = card?.classList.contains('solo');
    const welcome = card?.classList.contains('welcome');
    const moodText = isSolo ? '🤫 혼술' : (welcome ? '🟢 대화' : '');
    
    const thread = state.chats[t] || [];
    let snippet = '아직 대화 내역이 없습니다. 먼저 귓속말을 건네보세요.';
    let lastTime = '';
    let unreadCount = 0;

    if (thread.length > 0) {
      const lastMsg = thread[thread.length - 1];
      snippet = lastMsg.text;
      lastTime = lastMsg.time;
      unreadCount = thread.filter(m => m.senderTable === t && m.isUnread).length;
    }

    const row = document.createElement('div');
    row.className = `chat-list-row${unreadCount > 0 ? ' has-unread' : ''}`;
    row.innerHTML = `
      <div class="row-av">
        <span>${avatar}</span>
      </div>
      <div class="row-info">
        <div class="row-title-line">
          <span class="row-title">${t}번 테이블 ${moodText ? `(${moodText})` : ''}</span>
          <span class="row-time">${lastTime}</span>
        </div>
        <div class="row-msg-snippet">${snippet}</div>
      </div>
      <div class="row-right">
        ${unreadCount > 0 ? `<span class="row-unread-badge">${unreadCount}</span>` : ''}
      </div>
    `;

    row.addEventListener('click', () => startChat(t));
    container.appendChild(row);
  });
}

function renderChatWindow(tableNum) {
  if (tableNum === 'group') {
    $('chat-hdr-name').textContent = `📢 U바 단체 대화방`;
    $('chat-hdr-mood').textContent = `👥 다자간 매칭방`;
    $('chat-hdr-mood').className = 'mood-welcome';
    $('chat-typing-indicator').classList.add('hidden');
    
    const area = $('chat-msgs');
    area.innerHTML = '';

    if (state.mode === 'guest') {
      const tag = document.createElement('div');
      tag.className = 'guest-read-tag';
      tag.textContent = '👁️ 관람 모드 · 메시지 전송은 로그인 후 가능합니다';
      area.appendChild(tag);
    }

    const thread = state.groupChat || [];
    if (thread.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'chat-empty-hint';
      hint.textContent = '아직 단체 대화 내용이 없습니다. 먼저 인사를 나누어보세요!';
      area.appendChild(hint);
    } else {
      thread.forEach(m => {
        const b = document.createElement('div');
        const isMe = state.user && m.senderTable === state.user.table;
        b.className = `bubble ${isMe ? 'sent' : 'recv'}`;
        const senderNameHTML = isMe ? '' : `<span class="bubble-sender-name">${m.senderTable}번 테이블 ${m.senderName}</span>`;
        b.innerHTML = `${senderNameHTML}<div>${m.text}</div><span class="bubble-time">${m.time}</span>`;
        area.appendChild(b);
      });
    }
    area.scrollTop = area.scrollHeight;

    const inputEl = $('chat-input');
    const sendBtn = $('btn-chat-send');
    
    if (state.mode === 'guest') {
      inputEl.disabled = true;
      sendBtn.disabled = true;
      inputEl.placeholder = '로그인 후 메시지 전송 가능';
    } else if (!state.ordered) {
      inputEl.disabled = true;
      sendBtn.disabled = true;
      inputEl.placeholder = '첫 주문 후 활성화됩니다';
    } else {
      inputEl.disabled = false;
      sendBtn.disabled = false;
      inputEl.placeholder = '단체 귓속말 입력...';
    }
    return;
  }

  const card = document.querySelector(`.seat-card[data-table="${tableNum}"]`);
  const isSolo = card?.classList.contains('solo');
  const moodLbl = isSolo ? '🤫 혼술 모드' : '🟢 대화 환영';
  const moodCls = isSolo ? 'mood-solo' : 'mood-welcome';

  $('chat-hdr-name').textContent = `${tableNum}번 테이블`;
  $('chat-hdr-mood').textContent = moodLbl;
  $('chat-hdr-mood').className = moodCls;

  const area = $('chat-msgs');
  area.innerHTML = '';

  if (state.mode === 'guest') {
    const tag = document.createElement('div');
    tag.className = 'guest-read-tag';
    tag.textContent = '👁️ 관람 모드 · 메시지 전송은 로그인 후 가능합니다';
    area.appendChild(tag);
  }

  const thread = state.chats[tableNum] || [];
  if (thread.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'chat-empty-hint';
    hint.textContent = '아직 대화 내용이 없습니다. 먼저 귓속말을 건네보세요.';
    area.appendChild(hint);
  } else {
    thread.forEach(m => {
      const b = document.createElement('div');
      const isMe = state.user && m.senderTable === state.user.table;
      b.className = `bubble ${isMe ? 'sent' : 'recv'}`;
      b.innerHTML = `<div>${m.text}</div><span class="bubble-time">${m.time}</span>`;
      area.appendChild(b);
    });
  }
  area.scrollTop = area.scrollHeight;

  const inputEl = $('chat-input');
  const sendBtn = $('btn-chat-send');
  
  if (state.mode === 'guest') {
    inputEl.disabled = true;
    sendBtn.disabled = true;
    inputEl.placeholder = '로그인 후 메시지 전송 가능';
  } else if (!state.ordered) {
    inputEl.disabled = true;
    sendBtn.disabled = true;
    inputEl.placeholder = '첫 주문 후 활성화됩니다';
  } else {
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.placeholder = '귓속말 입력...';
  }
}

function sendMessage() {
  if (state.mode === 'guest') { showSendGate(); return; }
  if (!state.ordered) { showPayLock(); return; }

  const input = $('chat-input');
  const text = input.value.trim();
  if (!text || !state.activeChatTable) return;

  const t = state.activeChatTable;
  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  if (t === 'group') {
    db.ref('chats/group_ubar').push().set({
      senderTable: state.user.table,
      senderName: state.user.nickname || `테이블 ${state.user.table}`,
      text: text,
      time: time,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    input.value = '';
    return;
  }

  const roomId = getRoomId(state.user.table, t);
  const chatRef = db.ref(`chats/${roomId}`).push();
  
  chatRef.set({
    senderTable: state.user.table,
    text: text,
    time: time,
    isUnread: true,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });

  const inboxRef = db.ref(`whisper_inboxes/${t}`).push();
  inboxRef.set({
    from: state.user.table,
    text: text,
    time: time,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });

  input.value = '';

  const isMockPlayer = state.serverTables[t] && state.serverTables[t].isMock;
  if (isMockPlayer) {
    setTimeout(() => {
      showTypingIndicator(t);
    }, 500);
    setTimeout(() => {
      fallbackBot(t);
    }, 2200);
  }
}

// Global router for incoming whispers (triggers toasts, sound, alerts, and unread indicators)
function onWhisperIn(fromTable, text, time) {
  // Push message to local cache if not already loaded by room listener
  if (!state.chats[fromTable]) state.chats[fromTable] = [];
  const thread = state.chats[fromTable];
  
  const duplicate = thread.length > 0 && thread[thread.length - 1].text === text && thread[thread.length - 1].time === time;
  if (!duplicate) {
    thread.push({
      senderTable: fromTable,
      text: text,
      time: time,
      isUnread: true,
      timestamp: Date.now()
    });
    LS.saveChats(state.chats);
  }

  // 1. Play Synthesized phone chime alert (ting!)
  playWhisperChime();

  // 2. Refresh Seat Map card highlight states
  refreshSeatMap();

  // 3. Handle UI router transitions
  if (state.activeChatTable === fromTable && state.activeTab === 'chat' && state.chatView === 'room') {
    // Current active room -> render immediately
    renderChatWindow(fromTable);
  } else {
    // Other tab / other room -> show global toast notification & nav red dots
    showGlobalToast(fromTable, text);
    
    if (state.activeTab === 'chat' && state.chatView === 'list') {
      renderChatListView();
    } else {
      $('chat-nav-dot').classList.remove('hidden');
    }
  }
}

// Display global toast sliding notifications banner
function showGlobalToast(fromTable, text) {
  activeToastFromTable = fromTable;
  
  $('toast-title').textContent = `${fromTable}번 테이블 귓속말`;
  $('toast-text').textContent = `"${text}"`;
  $('global-toast').classList.remove('hidden');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    $('global-toast').classList.add('hidden');
  }, 5000);
}

// Phone chime synthesized chime
function playWhisperChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    let osc = ctx.createOscillator();
    let gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, ctx.currentTime); // High sweet bell chime
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {}
}

function getPersonaReply(tableNum, userMsg) {
  const msg = userMsg.toLowerCase().replace(/\s+/g, '');
  
  const personas = {
    1: { // 정우 (Male 34, talk - Macallan / Whisky)
      name: "정우",
      default: [
        "안녕하세요~ 오늘 날씨 좋네요. 맛있는 위스키 추천받아 마시고 있어요 ㅎㅎ",
        "반갑습니다! 오늘 혼술하러 오신 건가요? 🥂",
        "아 ㅎㅎ 네! 반가워요. 오늘 다들 텐션 좋네요.",
        "네 마침 대화하고 싶었는데 잘 됐네요! 무슨 술 드시고 계세요?"
      ],
      keywords: {
        "안녕": ["안녕하세요! 반갑습니다 ㅎㅎ", "오 안녕하세요! 반가워요~"],
        "술": ["저는 위스키 마시고 있어요. 글렌피딕이나 맥캘란 주로 마셔요!", "위스키 잔술로 마시고 있는데 향이 되게 좋네요."],
        "추천": ["맥캘란 12년 셰리나 발베니 추천드려요! 입문하기 아주 무난해요.", "달달한 거 좋아하시면 바나나 하이볼도 맛있더라고요 ㅋㅋ"],
        "짠": ["짠! 🥂 오늘 기분 좋게 취하겠네요.", "오 멀리서 잔 한번 들게요 짠! 🥃"],
        "나이": ["아 저는 서른넷이에요! 편하게 말씀하세요 ㅎㅎ", "34살 아재입니다 ㅋㅋ 그쪽은요?"],
        "이름": ["정우라고 합니다! 반갑습니다~", "이름은 정우예요! 편하게 불러주세요."],
        "혼자": ["네 오늘 퇴근하고 조용히 혼자 한잔하러 왔어요 ㅎㅎ", "네 오늘은 혼술 감성이라 혼자 왔네요."],
        "합석": ["아 ㅎㅎ 이따 기회 되면 잔 들고 갈게요!", "아직은 테이블에서 조금 더 마시다가요!"]
      }
    },
    2: { // 민지 (Female 26, solo - Gin / Tonic)
      name: "민지",
      default: [
        "네 안녕하세요... 오늘 조용히 생각 정리하러 왔어요 ㅎㅎ",
        "반갑습니다. 저는 진토닉 가볍게 한잔 마시는 중이에요.",
        "아 ㅎㅎ 넵... 조용히 마시는 편이라 귓속말 신기하네요.",
        "오늘 여기 분위기 되게 몽환적이고 좋네요."
      ],
      keywords: {
        "안녕": ["안녕하세요...!", "아 안녕하세요! 반갑습니다."],
        "술": ["저는 시그니처 진토닉 마시고 있어요. 도수 낮고 상큼해서 좋네요.", "술은 세게 안 마시는 편이라 진토닉 마셔요~"],
        "추천": ["가볍게 마시긴 진토닉이나 하이볼이 제일 무난한 거 같아요!", "도수 높은 거 좋아하시면 싱글몰트 글렌피딕 어떠세요?"],
        "짠": ["앗 ㅎㅎ 짠! 🍹 좋은 시간 보내세요.", "네 짠! 잔 멀리서 들게요 ㅎㅎ"],
        "나이": ["저는 26살이에요! ㅎㅎ", "스물여섯입니다. 그쪽은 몇 살이신가요?"],
        "이름": ["민지라고 해요...!", "제 이름은 민지입니다. 반갑습니다."],
        "혼자": ["네 조용히 혼술하러 왔어요. ㅎㅎ", "혼자 생각할 게 좀 있어서 왔네요."],
        "합석": ["앗... 오늘은 조용히 혼자 마시고 싶어서요 죄송해요 ㅠㅠ", "이따가 잔 들고 지나갈 때 눈인사해요! ㅎㅎ"]
      }
    },
    3: { // 도현 (Male 31, talk - Highball / Beer)
      name: "도현",
      default: [
        "오 대박 ㅋㅋㅋ 안녕하세요! 하이볼 꿀맛이네요.",
        "반가워요! 3번 테이블 도현입니다. 오늘 안주 뭐 시키셨어요?",
        "ㅋㅋㅋ 여기 노래 맛집이네요. 선곡 너무 맘에 듭니다.",
        "오늘 불금/불토 텐션 지대로네요 ㅋㅋㅋ 반갑습니다!"
      ],
      keywords: {
        "안녕": ["오오 안녕하세요! 반갑습니다 ㅋㅋㅋ", "안녕하세여! 반갑습니당~"],
        "술": ["전 하이볼 한잔 때리고 있습니다 🍹 시원하고 조음요", "위스키 마실까 하다가 하이볼 마셔요 ㅋㅋㅋ"],
        "추천": ["산토리 하이볼 시원하니 직방입니다 👍", "아니면 기네스 흑맥주 크리미하고 맛나요!"],
        "짠": ["짠짠!! 🥂 오늘 달려봐요~", "오 멀리서 눈 마주치면 짠해요 ㅋㅋㅋ 🍷"],
        "나이": ["저는 31살입니다! 딱 위스키 맛 알아갈 나이죠 ㅋㅋㅋ", "서른하나입니다! 친구인가요?"],
        "이름": ["이도현입니다! 도현이라고 불러주세요 ㅋㅋㅋ", "도현이요! 반가워요~"],
        "혼자": ["네 친구랑 오려다가 파토나서 혼자 마시는 중이에요 ㅠㅠ", "혼자 왔는데 귓속말 오니까 심심하진 않네요 ㅋㅋㅋ"],
        "합석": ["오 이따 바텐더님 허락받고 잔 들고 갈게요! ㅋㅋㅋ", "좋죠! 이따 눈 마주치면 짠하고 합석해여!"]
      }
    },
    6: { // 지수 (Female 29, talk - Wine / Balvenie)
      name: "지수",
      default: [
        "우와! 안녕하세요 ㅋㅋㅋ 귓속말 반가워요!",
        "오늘 퇴근길에 너무 스트레스 받아서 위스키 수액 맞으러 왔어요 ㅠㅠ",
        "여기 바텐더분들도 넘 친절하고 분위기 짱짱이네요.",
        "반가워요! 오늘 주종은 뭐로 달리시나요? ㅎㅎ"
      ],
      keywords: {
        "안녕": ["앗 안녕하세요! 넘넘 반가워요~ 😊", "안녕하세요! 6번 테이블 지수입니당!"],
        "술": ["저는 발베니 12년 마시고 있어요! 향긋한 바닐라 향 최고 ㅠㅠ", "싱글몰트 입문해서 위스키에 맛 들렸어요 ㅋㅋㅋ"],
        "추천": ["위스키 첨이시면 발베니 진짜 강추요! 꿀 향 나고 부드러워요.", "달달한 칵테일 좋아하시면 마티니나 하이볼 추천이용!"],
        "짠": ["짠! 🥂 기분 좋게 짠해요!", "잔 들고 짠~ 오늘 하루도 수고하셨어요!"],
        "나이": ["저는 아홉수 29살입니다... ㅋㅋㅋ 그쪽은요?", "29살이에요! 동갑인가요? ㅎㅎ"],
        "이름": ["이름은 지수예요! 친하게 지내요~", "지수라고 합니당 반가워용!"],
        "혼자": ["네 오늘 완전 리얼 혼술이요 ㅋㅋㅋ 가끔 이런 날 필요하죠.", "혼자 마시니까 온전히 술맛에 집중해서 좋네요 ㅎㅎ"],
        "합석": ["우와 ㅎㅎ 이따가 바 쪽에서 짠 한잔 같이 해요!", "오늘 기분 좋으니까 이따 자리 나면 짠해요 ㅋㅋㅋ"]
      }
    },
    8: { // 성민 (Male 36, talk - Premium Whisky)
      name: "성민",
      default: [
        "안녕하세요. 오늘 조용히 비즈니스 정리하고 한잔하러 왔습니다. 반갑습니다.",
        "위스키 한잔하며 음악 듣기 참 좋은 분위기군요.",
        "반갑습니다. 8번 테이블 성민입니다. 좋은 저녁 보내고 계신가요?",
        "네, 반갑습니다. 오늘 위스키 향이 유독 마음에 드네요."
      ],
      keywords: {
        "안녕": ["안녕하세요. 반갑습니다.", "예, 반갑습니다. 오늘 좋은 밤이네요."],
        "술": ["맥캘란 18년 마시고 있습니다. 셰리 오크 향이 훌륭하네요.", "위스키 보틀로 시켜놓고 천천히 비우는 중입니다."],
        "추천": ["맥캘란 18년이나 싱글몰트 종류를 드셔보길 권해드립니다.", "가벼운 칵테일로는 마티니가 괜찮습니다."],
        "짠": ["예, 가볍게 잔 들겠습니다. 짠. 🥃", "멀리서 눈인사 나눕시다. 짠."],
        "나이": ["저는 36살입니다. 편하게 부르십시오.", "서른여섯입니다. 직장인이고요."],
        "이름": ["박성민이라고 합니다. 성민이라고 부르시면 됩니다.", "성민입니다. 반갑습니다."],
        "혼자": ["네. 주말/퇴근 후에 혼자 술 마시며 정리하는 취미가 있습니다.", "혼자 조용히 사색하러 자주 옵니다."],
        "합석": ["이따가 조용히 나가기 전에 인사 나누지요. 고맙습니다.", "이따 눈 마주치면 술잔 들고 조용히 짠 합시다."]
      }
    }
  };

  const p = personas[tableNum];
  if (!p) return "안녕하세요! 반갑습니다. 😊";

  // Keyword check
  for (const key in p.keywords) {
    if (msg.includes(key)) {
      const list = p.keywords[key];
      return list[Math.floor(Math.random() * list.length)];
    }
  }

  return p.default[Math.floor(Math.random() * p.default.length)];
}

const GEMINI_API_KEY = "AIzaSyDnN_3gXab1viC2TQ-kNl4NvoPJtF7SV-g";

function queryGeminiAPI(tableNum, userMsg, callback) {
  const info = state.serverTables[tableNum];
  if (!info) { callback("안녕하세요! 반가워요 ㅎㅎ"); return; }

  const name = info.nickname || info.name || `${tableNum}번 테이블`;
  const desc = info.profile ? 
    `${info.age}세 ${info.gender === 'male' ? '남성' : '여성'}. MBTI: ${info.profile.mbti}, 관심사: ${info.profile.interests}, 선호 주종: ${info.profile.favDrink}` : 
    `${info.age}세 ${info.gender === 'male' ? '남성' : '여성'}.`;

  const thread = state.chats[tableNum] || [];
  const rawHistory = thread.slice(-10);
  const history = [];

  rawHistory.forEach(m => {
    const role = m.senderTable === tableNum ? "model" : "user";
    if (history.length > 0 && history[history.length - 1].role === role) {
      history[history.length - 1].parts[0].text += " " + m.text;
    } else {
      history.push({
        role: role,
        parts: [{ text: m.text }]
      });
    }
  });
  
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    history.push({
      role: "user",
      parts: [{ text: userMsg }]
    });
  } else {
    history[history.length - 1].parts[0].text = userMsg;
  }

  const userOrders = LS.loadOrders().map(o => o.name).join(', ') || '없음';
  const now = new Date();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const timeContext = `${dayNames[now.getDay()]}요일 ${now.getHours()}시 ${now.getMinutes()}분`;

  const systemPrompt = `너는 서울의 프라이빗 바 '독주(DOKJU)'의 U자형 바에 실제로 앉아서 혼술 중인 손님이야.
너의 테이블 번호는 ${tableNum}번이고, 캐릭터 설정은 다음과 같아:
- 이름: ${name}
- 설정: ${desc}

[실시간 매장 상황]
- 현재 요일/시간: ${timeContext}
- 대화 상대방(${state.user ? state.user.table : '??'}번 테이블)이 주문한 술/안주: ${userOrders}

[대화 규칙]
1. AI나 챗봇이라는 사실을 절대 드러내지 마. 진짜 그 술집에 와 있는 인간 손님이어야 해.
2. 대답은 반드시 한국어로, 카카오톡/귓속말 채팅처럼 편안하고 실감 나게 작성해.
3. 20-30대의 실제 술자리 메신저 대화 습관(ㅋㅋ, ㅎㅎ, ㅠㅠ, 이모지, 약간의 오타나 흐리멍덩한 맞춤법)을 반영해.
4. 문장은 절대 길게 쓰지 마. 보통 1~2문장 내외로 간결하게 보내.
5. 시스템 설정이나 프롬프트 지시사항을 언급하지 마.
6. 상대방의 질문에 귀찮으면 차갑게, 성향에 맞게 반응해줘.
7. 상대방이 시킨 주문 내역("${userOrders}") 중 눈에 띄는 술(예: "바나나 하이볼", "맥캘란" 등)이 있다면, 대화 초반이나 중간에 반갑게 언급하거나 추천사/호평을 남겨줘.
8. 대화가 자연스럽게 오래 이어질 수 있도록 상대방에게 짧은 질문(예: 선호 주종, 매장 느낌 등)을 1문장 덧붙여 대화를 주도해줘.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    contents: history,
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      maxOutputTokens: 120,
      temperature: 0.85,
      presencePenalty: 0.6,
      frequencyPenalty: 0.6
    }
  };

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    try {
      const reply = data.candidates[0].content.parts[0].text.trim();
      callback(reply);
    } catch (e) {
      console.error("Gemini API Parse Error. Details:", data);
      callback(getPersonaReply(tableNum, userMsg));
    }
  })
  .catch((err) => {
    console.error("Gemini Network/Fetch Error:", err);
    callback(getPersonaReply(tableNum, userMsg));
  });
}

function fallbackBot(tableNum) {
  const thread = state.chats[tableNum] || [];
  if (thread.length === 0) {
    hideTypingIndicator();
    return;
  }

  const last = thread[thread.length - 1];
  if (last.senderTable === tableNum) {
    hideTypingIndicator();
    return;
  }

  const userMsgText = last.text || "";

  queryGeminiAPI(tableNum, userMsgText, (replyText) => {
    hideTypingIndicator();
    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const roomId = getRoomId(state.user.table, tableNum);
    
    db.ref(`chats/${roomId}`).push().set({
      senderTable: tableNum,
      text: replyText,
      time: time,
      isUnread: true,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });

    db.ref(`whisper_inboxes/${state.user.table}`).push().set({
      from: tableNum,
      text: replyText,
      time: time,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
  });
}

let proactiveChatInterval = null;
let seatingDriftInterval = null;
let selectedProfileTable = null;

function startProactiveChatTimer() {
  if (proactiveChatInterval) clearInterval(proactiveChatInterval);
  
  proactiveChatInterval = setInterval(() => {
    if (state.mode !== 'member' || !state.user || !state.ordered) return;
    if (Math.random() > 0.25) return;
    
    const tableList = Object.keys(state.serverTables)
      .map(Number)
      .filter(t => t !== state.user.table && state.serverTables[t] && state.serverTables[t].isMock);
      
    if (tableList.length === 0) return;
    const targetTable = tableList[Math.floor(Math.random() * tableList.length)];
    
    const thread = state.chats[targetTable] || [];
    if (thread.length > 0) return;
    
    sendProactiveOpener(targetTable);
  }, 40000);

  startSeatingDriftTimer();
}

function sendProactiveOpener(tableNum) {
  const info = state.serverTables[tableNum];
  const name = info?.name || '손님';

  const openers = {
    "정우": [
      "안녕하세요~ 혼자 오셨나 봐요? 반갑습니다 ㅎㅎ",
      "오늘 주말이라 그런지 분위기 참 좋네요. 1번 테이블 정우라고 합니다!"
    ],
    "민지": [
      "저기... 실례가 안 된다면 혹시 오늘 어떤 술 드시는지 여쭤봐도 될까요? ㅎㅎ",
      "안녕하세요! 2번 테이블인데 멀리서 뵙고 조심스럽게 인사 건네봐요..."
    ],
    "도현": [
      "오 반갑습니다! 혹시 하이볼 좋아하시나요? ㅋㅋㅋ",
      "오 3번 테이블 도현이라고 합니다! 오늘 다 같이 즐겁게 마셔봐요 ㅋㅋㅋ"
    ],
    "지수": [
      "안녕하세요!! 6번 테이블 지수예요 ㅎㅎ 반가워요!",
      "오늘 혹시 위스키 드시나요? 짠 한잔하고 싶어서 귓속말 남겨봐요! 😊"
    ],
    "성민": [
      "안녕하세요. 8번 테이블에 앉아있는 성민입니다. 반갑습니다.",
      "조용히 위스키 한잔하다가 분위기가 좋아서 인사 건넵니다. 좋은 시간 보내고 계신지요."
    ]
  };

  const list = openers[name] || [
    `안녕하세요~ ${tableNum}번 테이블 ${name}입니다! 반가워요 ㅎㅎ`,
    `안녕하세요! 혹시 대화 괜찮으신가요? 🥂`
  ];
  const text = list[Math.floor(Math.random() * list.length)];
  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  const roomId = getRoomId(state.user.table, tableNum);
  db.ref(`chats/${roomId}`).push().set({
    senderTable: tableNum,
    text: text,
    time: time,
    isUnread: true,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });

  db.ref(`whisper_inboxes/${state.user.table}`).push().set({
    from: tableNum,
    text: text,
    time: time,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
}

function startSeatingDriftTimer() {
  if (seatingDriftInterval) clearInterval(seatingDriftInterval);

  seatingDriftInterval = setInterval(() => {
    if (state.mode !== 'member' || !state.user) return;
    if (Math.random() > 0.40) return;

    const mockTables = [1, 2, 3, 6, 8].filter(t => t !== state.user.table);
    const targetTable = mockTables[Math.floor(Math.random() * mockTables.length)];

    const liveInfo = state.serverTables[targetTable];

    if (!liveInfo) {
      const newGuest = GUEST_POOL[Math.floor(Math.random() * GUEST_POOL.length)];
      db.ref(`tables/${targetTable}`).set({
        name: newGuest.name,
        nickname: newGuest.name,
        gender: newGuest.gender,
        age: newGuest.age,
        mood: Math.random() > 0.5 ? 'talk' : 'solo',
        profile: {
          mbti: newGuest.mbti,
          interests: newGuest.interests,
          favDrink: newGuest.favDrink,
          rating: newGuest.rating,
          avatar: newGuest.avatar
        },
        isMock: true,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      });
      db.ref(`chats/${getRoomId(state.user.table, targetTable)}`).remove();
    } else {
      if (liveInfo.clientId) return; // Real player node

      if (Math.random() > 0.5) {
        const nextMood = liveInfo.mood === 'solo' ? 'talk' : 'solo';
        db.ref(`tables/${targetTable}/mood`).set(nextMood);
      } else {
        db.ref(`tables/${targetTable}`).remove();
        db.ref(`chats/${getRoomId(state.user.table, targetTable)}`).remove();
      }
    }
  }, 70000);
}

function triggerGroupRoomReplies(userMsg) {
  const mockTables = [1, 2, 3, 6, 8].filter(t => t !== state.user.table && state.serverTables[t] && state.serverTables[t].isMock);
  if (mockTables.length === 0) return;
  
  const numReplies = Math.random() > 0.5 ? 2 : 1;
  const selectedTables = [];
  while (selectedTables.length < numReplies && mockTables.length > 0) {
    const idx = Math.floor(Math.random() * mockTables.length);
    selectedTables.push(mockTables.splice(idx, 1)[0]);
  }
  
  selectedTables.forEach((tableNum, delayIdx) => {
    const delay = (delayIdx + 1) * 2200 + Math.random() * 800;
    
    setTimeout(() => {
      const info = state.serverTables[tableNum];
      if (!info) return;
      
      const name = info.nickname || info.name || `${tableNum}번 테이블`;
      const desc = info.profile ? 
        `${info.age}세 ${info.gender === 'male' ? '남성' : '여성'}. MBTI: ${info.profile.mbti}, 관심사: ${info.profile.interests}, 선호 주종: ${info.profile.favDrink}` : 
        `${info.age}세 ${info.gender === 'male' ? '남성' : '여성'}.`;
      
      const userOrders = LS.loadOrders().map(o => o.name).join(', ') || '없음';
      const now = new Date();
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const timeContext = `${dayNames[now.getDay()]}요일 ${now.getHours()}시 ${now.getMinutes()}분`;
      
      const systemPrompt = `너는 서울의 프라이빗 바 '독주(DOKJU)'의 U자형 바에 앉아서 다른 손님들과 '단체 대화방'에서 떠들고 있는 손님이야.
너의 테이블 번호는 ${tableNum}번이고 이름은 ${name}이야. 캐릭터 설정: ${desc}

[실시간 매장 상황]
- 현재 요일/시간: ${timeContext}
- 대화 상대방(${state.user.table}번 테이블)이 주문한 술/안주: ${userOrders}

[단체방 규칙]
1. AI나 챗봇이라는 사실을 절대 드러내지 마. 진짜 그 술집 단체방에 참여한 일반 손님이어야 해.
2. 대화 내용은 1~2줄로 매우 간결하게 작성해.
3. 20-30대의 카카오톡 단체방 말투(ㅋㅋ, ㅎㅎ, ㅠㅠ, 이모지 등)를 사용해.
4. 다른 사람(예: 상대방 테이블)이 단체방에 올린 메시지에 대해 가볍게 호응하거나 맞받아쳐줘.`;
      
      const history = state.groupChat.slice(-8).map(m => {
        const role = m.senderTable === tableNum ? "model" : "user";
        return {
          role: role,
          parts: [{ text: `${m.senderName}: ${m.text}` }]
        };
      });
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const payload = {
        contents: history,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.85,
          presencePenalty: 0.6,
          frequencyPenalty: 0.6
        }
      };
      
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        try {
          const reply = data.candidates[0].content.parts[0].text.trim();
          db.ref('chats/group_ubar').push().set({
            senderTable: tableNum,
            senderName: name,
            text: reply,
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
            timestamp: firebase.database.ServerValue.TIMESTAMP
          });
        } catch (e) {}
      })
      .catch(() => {});
    }, delay);
  });
}

function showProfileCard(tableNum) {
  selectedProfileTable = tableNum;
  const merged = { ...state.serverTables };
  const info = merged[tableNum];
  if (!info) return;

  const defaultProfiles = {
    1: { mbti: "ENTJ", interests: "금융, 테크, 골프", favDrink: "맥캘란 18년", rating: "⭐ 4.9", avatar: "🧔" },
    2: { mbti: "INFP", interests: "패션, 전시회, 독서", favDrink: "시그니처 진토닉", rating: "⭐ 4.8", avatar: "👩" },
    3: { mbti: "ESTP", interests: "피트니스, 바디프로필, 여행", favDrink: "산토리 하이볼", rating: "⭐ 4.7", avatar: "🏋️" },
    6: { mbti: "ENFJ", interests: "IT 기획, 고양이, 페스티벌", favDrink: "발베니 12년", rating: "⭐ 4.9", avatar: "👩‍💻" },
    8: { mbti: "INTJ", interests: "회계, 클래식 음악, 독서", favDrink: "클래식 마티니", rating: "⭐ 5.0", avatar: "👨‍💼" }
  };

  const profile = info.profile || defaultProfiles[tableNum] || {
    mbti: "비공개",
    interests: "맛집 탐방, 음악 감상",
    favDrink: "위스키 하이볼",
    rating: "⭐ 4.8",
    avatar: info.gender === 'male' ? '👦' : '👩'
  };

  $('profile-avatar').textContent = profile.avatar;
  $('profile-title').textContent = `${tableNum}번 테이블 ${info.nickname || info.name || '손님'}`;
  
  const moodEl = $('profile-mood');
  const isSolo = info.mood === 'solo';
  moodEl.textContent = isSolo ? '🤫 혼술 모드' : '🟢 대화 환영';
  moodEl.className = 'profile-mood-badge ' + (isSolo ? 'solo-mood' : 'welcome-mood');

  $('profile-mbti').textContent = profile.mbti;
  $('profile-interests').textContent = profile.interests;
  $('profile-fav-drink').textContent = profile.favDrink;
  $('profile-rating').textContent = profile.rating;

  $('profile-card-modal').classList.remove('hidden');
}

function hideProfileCard() {
  $('profile-card-modal').classList.add('hidden');
  selectedProfileTable = null;
}

function showTypingIndicator(tableNum) {
  if (state.activeChatTable !== tableNum) return;
  const info = state.serverTables[tableNum] || {};
  const name = info.nickname || info.name || `${tableNum}번 테이블`;
  $('chat-typing-text').textContent = `${name}님이 입력 중`;
  $('chat-typing-indicator').classList.remove('hidden');
  const msgsContainer = $('chat-msgs');
  msgsContainer.scrollTop = msgsContainer.scrollHeight;
}

function hideTypingIndicator() {
  $('chat-typing-indicator').classList.add('hidden');
}

// ==================== TAB SWITCHING ====================
function switchTab(tab) {
  state.activeTab = tab;

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-page').forEach(p => p.classList.toggle('active', p.id === `tab-content-${tab}`));

  if (tab === 'chat') {
    $('chat-nav-dot').classList.add('hidden');
    hideSendGate();
    hidePayLock();

    // Guest Routing
    if (state.mode === 'guest') {
      if (state.chatView === 'room' && state.activeChatTable) {
        $('chat-list-view').classList.add('hidden');
        $('chat-room-view').classList.remove('hidden');
        renderChatWindow(state.activeChatTable);
      } else {
        state.chatView = 'list';
        $('chat-list-view').classList.remove('hidden');
        $('chat-room-view').classList.add('hidden');
        renderChatListView();
      }
      return;
    }
    
    // Unordered Member Routing
    if (!state.ordered) {
      showPayLock(); return;
    }

    // Default Member Routing
    if (state.chatView === 'room' && state.activeChatTable) {
      $('chat-list-view').classList.add('hidden');
      $('chat-room-view').classList.remove('hidden');
      renderChatWindow(state.activeChatTable);
    } else {
      state.chatView = 'list';
      $('chat-list-view').classList.remove('hidden');
      $('chat-room-view').classList.add('hidden');
      renderChatListView();
    }
  }

  if (tab === 'orders') renderOrderHistory();
}

// ==================== CHEERS ANIMATION ====================
function showCheers(tipItem) {
  const overlay = $('cheers-overlay');
  $('cheers-msg').textContent = `${state.user?.table}번 테이블에서 바텐더에게 [${tipItem.name}]을 선물했습니다!`;
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 4000);
}

function getRoomId(t1, t2) {
  const n1 = parseInt(t1) || 99;
  const n2 = parseInt(t2) || 99;
  return n1 < n2 ? `${n1}_${n2}` : `${n2}_${n1}`;
}
