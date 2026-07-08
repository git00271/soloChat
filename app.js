// ==================== APP STATE & FIREBASE SYNC ====================
const CURRENT_YEAR = 2026;

// Firebase configuration using a public demo database. Replace with your own project config!
const firebaseConfig = {
  databaseURL: "https://dokju-bar-default-rtdb.firebaseio.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentChatRef = null; // Reference to the active Firebase chat room listener
let clientUniqueId = 'dokju_cl_' + Math.random().toString(16).substring(2, 10);

const state = {
  mode: 'guest',   // 'guest' | 'member'
  user: null,      // { nickname, gender, age, table, mood, joinDate }
  ordered: false,  // Unlocks chat features
  cart: [],
  chats: {},       // tableNum -> [{senderTable, text, time, timestamp}]
  activeChatTable: null,
  activeTab: 'bar',
  serverTables: {}, // Live Firebase occupancy states
  tickerLogs: [
    { table: 3, item: 'Dom Pérignon', amount: 1200000 },
    { table: 8, item: 'Macallan 18y', amount: 850000 },
    { table: 1, item: 'Jameson Bottle', amount: 180000 }
  ]
};

// Base mock tables to display a busy bar unless overridden by real users
const mockSeating = {
  1: { gender: 'male', age: 34, mood: 'talk', nickname: '정우' },
  2: { gender: 'female', age: 26, mood: 'solo', nickname: '민지' },
  3: { gender: 'male', age: 31, mood: 'talk', nickname: '도현' },
  6: { gender: 'female', age: 29, mood: 'talk', nickname: '지수' },
  8: { gender: 'male', age: 36, mood: 'talk', nickname: '성민' }
};

// ==================== PRODUCTS LIST ====================
const PRODUCTS = [
  // Bottles
  { id: 'b1', cat: 'bottle', name: '돔 페리뇽 (Dom Pérignon)', price: 1200000, desc: 'FLEX의 완벽한 상징. 최고급 빈티지 샴페인.', icon: '🍾', tag: 'flex' },
  { id: 'b2', cat: 'bottle', name: '맥캘란 18년 (Macallan 18y)', price: 850000, desc: '싱글몰트의 명작. 깊은 오크향과 스파이스.', icon: '🥃', tag: 'best' },
  { id: 'b3', cat: 'bottle', name: '발베니 12년 (Balvenie 12y)', price: 280000, desc: '꿀향과 바닐라 힌트. 부드러운 입문 보틀.', icon: '🍷', tag: 'md' },
  
  // Glasses
  { id: 'g1', cat: 'glass', name: '글렌피딕 12년', price: 18000, desc: '상큼한 배 맛의 싱글몰트 잔술.', icon: '🥃', tag: null },
  { id: 'g2', cat: 'glass', name: '제임슨 블랙 배럴', price: 14000, desc: '이중 탄화 공법의 아이리시 위스키.', icon: '🥃', tag: null },
  { id: 'g3', cat: 'glass', name: '시그니처 진토닉', price: 12000, desc: '바텐더 메이드 청량 잔술.', icon: '🍹', tag: null },

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

// ==================== EVENT BINDINGS ====================
function bindEvents() {
  // Gate buttons
  $('btn-kakao-login').onclick = () => showScreen('auth');
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
  $('btn-gate-to-login').onclick = () => { hideSendGate(); showScreen('auth'); };
  $('btn-gate-dismiss').onclick = hideSendGate;
  $('btn-unlock-go-menu').onclick = () => { hidePayLock(); switchTab('menu'); };

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

  // Age gate
  if (gender === 'male' && age < 30) return showBlocked(`남성은 30세 이상만 입장 가능합니다.\n현재 만 ${age}세입니다.`);
  if (gender === 'female' && age < 25) return showBlocked(`여성은 25세 이상만 입장 가능합니다.\n현재 만 ${age}세입니다.`);

  // Commit
  state.user = { nickname, gender, age, table, mood: 'solo', joinDate: new Date().toLocaleDateString('ko-KR') };
  state.mode = 'member';
  state.chats = LS.loadChats();
  state.ordered = LS.loadOrders().length > 0;

  LS.saveUser(state.user);

  applyMemberSession();
  showScreen('main');
  initFirebaseSync();
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

  // Remove presence node from database
  if (state.user && db) {
    db.ref(`tables/${state.user.table}`).remove();
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
  }
}

// ==================== SEAT MAP ====================
function refreshSeatMap() {
  const merged = { ...mockSeating, ...state.serverTables };
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
      continue;
    }

    const isSolo = info.mood === 'solo';
    card.className = `seat-card occupied ${info.gender} ${isSolo ? 'solo' : 'welcome'}${info.isSelf ? ' self-seat' : ''}`;
    card.querySelector('.seat-av').textContent = info.gender === 'male' ? '👦🏻' : '👩🏻';
    const moodEl = card.querySelector('.seat-mood');
    moodEl.textContent = isSolo ? '혼술' : '대화';
    moodEl.className = 'seat-mood ' + (isSolo ? 'solo-mood' : 'welcome-mood');
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
  
  if (state.mode === 'guest') {
    // Guest can watch chats, let them pass to Chat Tab directly
    startChat(tableNum);
    return;
  }
  
  if (!state.ordered) {
    switchTab('chat');
    showPayLock(); return;
  }
  
  startChat(tableNum);
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
  // Prevent duplicate insertion
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

  // Bind cart adding hooks
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
  if (state.mode === 'guest') { alert('관람 모드에서는 결제할 수 없습니다. 로그인해 주세요.'); return; }

  const total = state.cart.reduce((s, i) => s + i.price, 0);
  alert(`카드 결제 승인\n합계: ${total.toLocaleString()}원`);

  state.ordered = true;

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
    // 2. Save locally for order persistence
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
  else alert('주문 완료! 이제 귓속말 기능이 활성화됩니다.');

  state.cart = [];
  updateCartUI();
  
  const activeCat = document.querySelector('.cat-btn.active');
  if (activeCat) renderMenu(activeCat.dataset.category);
  
  renderOrderHistory();
  switchTab('chat');
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

function getRoomId(t1, t2) {
  return t1 < t2 ? `${t1}_${t2}` : `${t2}_${t1}`;
}

function startChat(tableNum) {
  state.activeChatTable = tableNum;
  switchTab('chat');
  hidePayLock();
  hideSendGate();
  renderChatSidebar();
  
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
    
    if (state.activeChatTable === tableNum && state.activeTab === 'chat') {
      renderChatWindow(tableNum);
    }
  });
}

function renderChatSidebar() {
  const sidebar = $('chat-sidebar');
  sidebar.innerHTML = '';
  const tableList = [1, 2, 3, 6, 8];
  
  tableList.forEach(t => {
    if (state.user && t === state.user.table) return;
    const card = document.querySelector(`.seat-card[data-table="${t}"]`);
    const icon = card?.querySelector('.seat-av')?.textContent || '👤';
    const msgs = state.chats[t] || [];
    
    const hasUnread = msgs.length > 0 && msgs[msgs.length - 1].senderTable !== state.user?.table && msgs[msgs.length - 1].isUnread;

    const node = document.createElement('div');
    node.className = `chat-thread${state.activeChatTable === t ? ' active' : ''}${hasUnread && state.activeChatTable !== t ? ' has-unread' : ''}`;
    node.innerHTML = `<span class="ct-num">${t}번</span><span class="ct-icon">${icon}</span>`;
    node.addEventListener('click', () => startChat(t));
    sidebar.appendChild(node);
  });
}

function renderChatWindow(tableNum) {
  const card = document.querySelector(`.seat-card[data-table="${tableNum}"]`);
  const isSolo = card?.classList.contains('solo');
  const moodLbl = isSolo ? '🤫 혼술 모드' : '🟢 대화 환영';
  const moodCls = isSolo ? 'mood-solo' : 'mood-welcome';

  $('chat-hdr-name').textContent = `${tableNum}번 테이블`;
  $('chat-hdr-mood').textContent = moodLbl;
  $('chat-hdr-mood').className = moodCls;

  const area = $('chat-msgs');
  area.innerHTML = '';

  // Display Guest read-only banner inside window
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

  // Mark all unread flags as read locally
  if (state.mode === 'member') {
    thread.forEach(m => {
      if (m.senderTable !== state.user.table) m.isUnread = false;
    });
  }

  // Manage Input elements states
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

  // 1. Submit message node to Central Firebase Chat Room
  const roomId = getRoomId(state.user.table, t);
  const chatRef = db.ref(`chats/${roomId}`).push();
  
  chatRef.set({
    senderTable: state.user.table,
    text: text,
    time: time,
    isUnread: true,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });

  input.value = '';

  // 2. Chatbot fallback triggers if target seat is a static mock offline table
  const hasRealPlayer = !!state.serverTables[t];
  if (!hasRealPlayer) {
    setTimeout(() => fallbackBot(t), 2200);
  }
}

function onWhisperIn(fromTable, text, time) {
  // Real whisper is received in real-time. Since we listen to /chats/{room_id},
  // the callback handles it. We just play an alert or trigger visual updates if in other tab.
  if (state.activeChatTable !== fromTable || state.activeTab !== 'chat') {
    renderChatSidebar();
    $('chat-nav-dot').classList.remove('hidden');
  }
}

function fallbackBot(tableNum) {
  const thread = state.chats[tableNum] || [];
  const last = thread[thread.length - 1];
  if (last && last.senderTable === tableNum) return; // already replied by bot

  const isSolo = document.querySelector(`.seat-card[data-table="${tableNum}"]`)?.classList.contains('solo');
  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const text = isSolo
    ? '조용히 혼술 중이에요 🤫 나중에 인사해요~'
    : ['안녕하세요! 반갑습니다 😊', '짠! 🥂', '저도 혼술이에요 ㅎㅎ 술 뭐 드시나요?', '와 귓속말이 오다니! 신기하네요 ㅋㅋ'][Math.floor(Math.random() * 4)];

  // Inject bot reply directly to the firebase chat room
  const roomId = getRoomId(state.user.table, tableNum);
  db.ref(`chats/${roomId}`).push().set({
    senderTable: tableNum,
    text: text,
    time: time,
    isUnread: true,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
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

    if (state.mode === 'guest') {
      renderChatSidebar();
      if (state.activeChatTable) renderChatWindow(state.activeChatTable);
      return;
    }
    if (!state.ordered) {
      showPayLock(); return;
    }
    renderChatSidebar();
    if (state.activeChatTable) renderChatWindow(state.activeChatTable);
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
