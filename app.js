// ==================== APP STATE & SERVERLESS MQTT ====================
const CURRENT_YEAR = 2026;

// MQTT configuration using public secure WebSocket broker (SSL)
const MQTT_BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';
const TOPIC_PREFIX = 'dokju/bar/banana/v3';
let mqttClient = null;
let clientUniqueId = 'dokju_cl_' + Math.random().toString(16).substring(2, 10);

const state = {
  user: {
    loggedIn: false,
    gender: null,
    birthYear: null,
    age: null,
    table: null,
    mood: 'solo' // 'solo' (quiet solo) or 'talk' (welcome talk)
  },
  ordered: false, // Flag indicating if first order has been made (unlocks chat)
  activeTab: 'bar',
  cart: [],
  activeChatTable: null,
  
  // Local chat logs (persists session message logs)
  chats: {},

  // Real-time table status map synced via MQTT presence
  activeServerTables: {},
  
  // High value orders scrolling rankings
  tickerLogs: [
    { table: 3, item: 'Dom Pérignon', amount: '1,200,000' },
    { table: 8, item: 'Macallan 18y', amount: '850,000' },
    { table: 1, item: 'Jameson Bottle', amount: '180,000' }
  ]
};

// Base mock tables to display a busy bar unless overridden by real users
const mockSeating = {
  1: { gender: 'male', age: 34, mood: 'talk' },
  2: { gender: 'female', age: 26, mood: 'solo' },
  3: { gender: 'male', age: 31, mood: 'talk' },
  6: { gender: 'female', age: 29, mood: 'talk' },
  8: { gender: 'male', age: 36, mood: 'talk' }
};

// ==================== PRODUCTS LIST ====================
const PRODUCTS = [
  // Bottles
  { id: 'b1', category: 'bottle', name: '돔 페리뇽 (Dom Pérignon)', price: 1200000, desc: '프리미엄 샴페인의 대명사. FLEX의 완벽한 상징.', icon: '🍾', tag: 'FLEX' },
  { id: 'b2', category: 'bottle', name: '맥캘란 18년 (Macallan 18y)', price: 850000, desc: '싱글몰트 위스키의 명작. 깊은 오크향과 스파이스.', icon: '🥃', tag: 'Best' },
  { id: 'b3', category: 'bottle', name: '발베니 12년 (Balvenie 12y)', price: 280000, desc: '부드러운 꿀 향과 바닐라 힌트. 누구나 좋아하는 보틀.', icon: '🍷', tag: 'MD 추천' },
  
  // Glasses
  { id: 'g1', category: 'glass', name: '글렌피딕 12년 (Glass)', price: 18000, desc: '상큼한 배 맛과 은은한 서양배 향의 싱글몰트.', icon: '🥃', tag: null },
  { id: 'g2', category: 'glass', name: '제임슨 블랙 배럴 (Glass)', price: 14000, desc: '이중 탄화 공법으로 더욱 깊어진 풍미의 아이리시 위스키.', icon: '🥃', tag: null },
  { id: 'g3', category: 'glass', name: '진토닉 (Gin Tonic)', price: 12000, desc: '깔끔하고 청량한 바텐더 메이드 시그니처 잔술.', icon: '🍹', tag: null },

  // Smart Corkage
  { id: 'c1', category: 'corkage', name: '콜키지 기본 세팅비 (1~2인)', price: 3000, desc: '외부 안주 반입 시 제공되는 기본 개인 식기 세트 및 잔 지원.', icon: '🍽️', tag: '콜키지' },
  { id: 'c2', category: 'corkage', name: '콜키지 단체 세팅비 (3~4인)', price: 5000, desc: '외부 안주 반입 시 제공되는 여유로운 식기 및 잔 교체 서비스.', icon: '🍴', tag: '콜키지' },

  // Bartender Tips
  { id: 't1', category: 'tips', name: '바텐더 샷 선물하기', price: 10000, desc: 'U자 바 맞은편에서 함께 소통하는 바텐더에게 감사를 표하는 잔술.', icon: '🥃', tag: 'Cheers' },
  { id: 't2', category: 'tips', name: '바텐더 프리미엄 칵테일', price: 20000, desc: '대화의 텐션을 한 단계 끌어올리는 바텐더 선물용 프리미엄 음료.', icon: '🍹', tag: 'Cheers' },
  { id: 't3', category: 'tips', name: '골든 치얼스 팁 (Golden Cheers)', price: 50000, desc: '최고의 서비스를 선사한 바텐더와 매장을 위한 스페셜 골드 팁.', icon: '🏆', tag: 'Cheers' }
];

// ==================== DOM ELEMENTS ====================
const screens = {
  gate: document.getElementById('screen-gate'),
  auth: document.getElementById('screen-auth'),
  blocked: document.getElementById('screen-blocked'),
  main: document.getElementById('screen-main')
};

// ==================== INIT FUNCTIONS ====================
document.addEventListener('DOMContentLoaded', () => {
  initBirthYearSelect();
  setupEventListeners();
  renderFLEXTicker();
  renderMenuItems('bottle');
});

function initBirthYearSelect() {
  const select = document.getElementById('birth-year');
  for (let year = CURRENT_YEAR - 19; year >= CURRENT_YEAR - 65; year--) {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = `${year}년생 (${CURRENT_YEAR - year + 1}세)`;
    select.appendChild(opt);
  }
}

// ==================== SERVERLESS MQTT PROTOCOL ====================
function initMqttConnection(table, gender, age, mood) {
  const tableTopic = `${TOPIC_PREFIX}/table/${table}`;

  // Establish connection to public HiveMQ WebSocket broker
  // Configure Last Will and Testament (LWT) to clean up seat status if browser window is closed
  mqttClient = mqtt.connect(MQTT_BROKER_URL, {
    clientId: clientUniqueId,
    will: {
      topic: tableTopic,
      payload: JSON.stringify({ action: 'leave' }),
      qos: 1,
      retain: true
    }
  });

  mqttClient.on('connect', () => {
    console.log("Connected to serverless broker!");
    
    // Subscribe to all table presence topics to track occupancy in the bar
    mqttClient.subscribe(`${TOPIC_PREFIX}/table/+`);
    
    // Subscribe to whispers directed to this table
    mqttClient.subscribe(`${TOPIC_PREFIX}/whisper/${table}`);
    
    // Subscribe to FLEX order broadcast events
    mqttClient.subscribe(`${TOPIC_PREFIX}/flex`);

    // Publish join presence info (set retain=true so new connectees receive it immediately)
    publishPresence('join');
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      
      // Case 1: Table occupancy updates
      if (topic.startsWith(`${TOPIC_PREFIX}/table/`)) {
        const tableNum = parseInt(topic.split('/').pop());
        
        if (payload.action === 'leave' || !payload.action) {
          // Client disconnected or explicitly left
          if (tableNum !== state.user.table) {
            delete state.activeServerTables[tableNum];
          }
        } else if (payload.action === 'join' || payload.action === 'mood_update') {
          // Skip mapping self in server status maps to prevent state loops
          if (tableNum !== state.user.table) {
            state.activeServerTables[tableNum] = {
              gender: payload.gender,
              age: payload.age,
              mood: payload.mood,
              clientId: payload.clientId
            };
          }
        }
        updateSeatLayoutUI();
      }
      
      // Case 2: Incoming Whispers
      else if (topic === `${TOPIC_PREFIX}/whisper/${state.user.table}`) {
        handleIncomingWhisper(payload.from, payload.text, payload.time);
      }
      
      // Case 3: FLEX orders broadcasts
      else if (topic === `${TOPIC_PREFIX}/flex`) {
        // Skip adding duplicate log if we published it ourselves
        if (payload.table !== state.user.table) {
          addFLEXTickerLog(payload.table, payload.item, payload.amount);
        }
      }
    } catch (e) {
      console.error("MQTT parsing error:", e);
    }
  });

  mqttClient.on('close', () => {
    console.log("MQTT connection closed.");
  });
}

function publishPresence(action = 'join') {
  if (!mqttClient || !mqttClient.connected) return;

  const tableTopic = `${TOPIC_PREFIX}/table/${state.user.table}`;
  const payload = {
    action: action,
    gender: state.user.gender,
    age: state.user.age,
    mood: state.user.mood,
    clientId: clientUniqueId
  };

  mqttClient.publish(tableTopic, JSON.stringify(payload), { qos: 1, retain: true });
}

// Refresh visual indicators of table seat mappings
function updateSeatLayoutUI() {
  // Merge static mock users with active server users
  const activeTables = Object.assign({}, mockSeating, state.activeServerTables);

  // Overlay own seat information
  if (state.user.table) {
    activeTables[state.user.table] = {
      gender: state.user.gender,
      age: state.user.age,
      mood: state.user.mood,
      isSelf: true
    };
  }

  for (let tableNum = 1; tableNum <= 8; tableNum++) {
    const node = document.querySelector(`.seat-node[data-table="${tableNum}"]`);
    if (!node) continue;

    const info = activeTables[tableNum];

    if (info) {
      const isSolo = info.mood === 'solo';
      node.className = `seat-node occupied ${info.gender} ${isSolo ? 'solo' : 'welcome'}`;
      
      if (info.isSelf) {
        node.className += ' self-seat';
        node.style.border = '2px solid var(--gold)';
        node.style.boxShadow = '0 0 15px var(--gold)';
      } else {
        node.style.border = '';
        node.style.boxShadow = '';
      }

      const emoji = info.gender === 'male' ? '👦🏻' : '👩🏻';
      node.querySelector('.seat-icon').textContent = emoji;
      node.querySelector('.seat-badge').textContent = isSolo ? '혼술' : '대화';
      node.classList.remove('empty');
    } else {
      node.className = 'seat-node empty';
      node.querySelector('.seat-icon').textContent = '➕';
      node.querySelector('.seat-badge').textContent = '빈자리';
      node.style.border = '';
      node.style.boxShadow = '';
    }
  }
}

// Whisper messaging processor
function handleIncomingWhisper(fromTable, text, time) {
  if (!state.chats[fromTable]) {
    state.chats[fromTable] = [];
  }
  state.chats[fromTable].push({ sender: 'them', text, time });

  if (state.activeChatTable === fromTable && state.activeTab === 'chat') {
    renderActiveChatWindow(fromTable);
  } else {
    renderChatSidebar();
  }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Gate click transitions
  document.getElementById('btn-kakao-login').addEventListener('click', () => {
    switchScreen('auth');
  });

  document.getElementById('btn-auth-close').addEventListener('click', () => {
    switchScreen('gate');
  });

  document.getElementById('btn-blocked-back').addEventListener('click', () => {
    switchScreen('gate');
  });

  // Checklist select all
  const chkAll = document.getElementById('chk-all-terms');
  const subTerms = document.querySelectorAll('.chk-sub-term');
  chkAll.addEventListener('change', () => {
    subTerms.forEach(cb => cb.checked = chkAll.checked);
  });

  // Handle Auth Login
  document.getElementById('auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const gender = document.querySelector('input[name="gender"]:checked').value;
    const birthYear = parseInt(document.getElementById('birth-year').value);
    const table = parseInt(document.getElementById('seat-table-select').value);
    const age = CURRENT_YEAR - birthYear;
    
    // Strict Age Gates
    if (gender === 'male' && age < 30) {
      showBlockedScreen(`남성은 30세 이상만 가입 가능합니다.\n현재 회원님의 나이는 만 ${age}세입니다.`);
      return;
    }
    
    if (gender === 'female' && age < 25) {
      showBlockedScreen(`여성은 25세 이상만 가입 가능합니다.\n현재 회원님의 나이는 만 ${age}세입니다.`);
      return;
    }

    // Set User States
    state.user.loggedIn = true;
    state.user.gender = gender;
    state.user.birthYear = birthYear;
    state.user.age = age;
    state.user.table = table;

    // Display updates in HTML
    document.getElementById('user-display-age').textContent = `${gender === 'male' ? 'M' : 'F'}${age}`;
    document.getElementById('user-display-table').textContent = table;

    switchScreen('main');

    // Launch Serverless MQTT client connectivity
    initMqttConnection(table, gender, age, state.user.mood);
  });

  // Bottom Tabs navigation switching
  const navItems = document.querySelectorAll('.bottom-nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Personal Mood Status Switches
  const btnSolo = document.getElementById('mood-btn-solo');
  const btnTalk = document.getElementById('mood-btn-talk');

  btnSolo.addEventListener('click', () => {
    setMyMood('solo');
  });

  btnTalk.addEventListener('click', () => {
    setMyMood('talk');
  });

  // Seat node mapping clicks
  const seatNodes = document.querySelectorAll('.seat-node');
  seatNodes.forEach(node => {
    node.addEventListener('click', () => {
      const tableNum = parseInt(node.getAttribute('data-table'));

      if (node.classList.contains('empty')) {
        alert(`${tableNum}번 테이블은 현재 빈자리입니다.`);
        return;
      }

      if (tableNum === state.user.table) {
        alert('회원님이 착석한 테이블입니다.');
        return;
      }

      // Check first order block (Paid Lock)
      if (!state.ordered) {
        switchTab('chat');
        showChatLockOverlay(true);
        return;
      }

      startChatWith(tableNum);
    });
  });

  // Menu Category Buttons
  const catButtons = document.querySelectorAll('.category-tabs .category-btn');
  catButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      catButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.getAttribute('data-category');
      renderMenuItems(cat);
    });
  });

  // Checkout click
  document.getElementById('btn-cart-checkout').addEventListener('click', () => {
    checkoutCart();
  });

  // Redirect to menu from chat lock overlay
  document.getElementById('btn-unlock-go-menu').addEventListener('click', () => {
    switchTab('menu');
  });

  // Chat input buttons
  const chatInput = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-chat-send');

  btnSend.addEventListener('click', () => {
    sendChatMessage();
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });
}

// ==================== SCREEN & NAV SWITCHERS ====================

function switchScreen(screenKey) {
  Object.keys(screens).forEach(key => {
    screens[key].classList.remove('active');
  });
  screens[screenKey].classList.add('active');
}

function showBlockedScreen(reason) {
  document.getElementById('blocked-reason').textContent = reason;
  switchScreen('blocked');
}

function switchTab(tabKey) {
  state.activeTab = tabKey;

  const navItems = document.querySelectorAll('.bottom-nav .nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabKey) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const contents = document.querySelectorAll('.main-content .tab-content');
  contents.forEach(content => {
    if (content.getAttribute('id') === `tab-content-${tabKey}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  if (tabKey === 'chat') {
    if (state.ordered) {
      showChatLockOverlay(false);
      renderChatSidebar();
      if (state.activeChatTable) {
        renderActiveChatWindow(state.activeChatTable);
      }
    } else {
      showChatLockOverlay(true);
    }
  }
}

function showChatLockOverlay(show) {
  const overlay = document.getElementById('chat-lock-overlay');
  if (show) {
    overlay.classList.add('active');
  } else {
    overlay.classList.remove('active');
  }
}

function setMyMood(mood) {
  state.user.mood = mood;
  const btnSolo = document.getElementById('mood-btn-solo');
  const btnTalk = document.getElementById('mood-btn-talk');

  if (mood === 'solo') {
    btnSolo.classList.add('active');
    btnTalk.classList.remove('active');
  } else {
    btnSolo.classList.remove('active');
    btnTalk.classList.add('active');
  }

  // Publish updated status over MQTT
  publishPresence('mood_update');
}

// ==================== TICKER RENDERER ====================
function renderFLEXTicker() {
  const ticker = document.getElementById('flex-ticker');
  ticker.innerHTML = '';
  
  const extendedLogs = [...state.tickerLogs, ...state.tickerLogs];
  
  extendedLogs.forEach((log) => {
    const span = document.createElement('span');
    span.className = 'ticker-item';
    
    if (parseInt(log.amount.replace(/,/g, '')) >= 500000) {
      span.className += ' gold';
      span.innerHTML = `🍾 ${log.table}번 테이블 ${log.item} ${log.amount}원 FLEX! 🔥`;
    } else if (log.item.includes('팁') || log.item.includes('선물')) {
      span.className += ' magenta';
      span.innerHTML = `💖 ${log.table}번 테이블 바텐더 Cheers 선물! 🥂`;
    } else {
      span.innerHTML = `🥃 ${log.table}번 테이블 주문 완료 (${log.item})`;
    }
    
    ticker.appendChild(span);
  });
}

function addFLEXTickerLog(table, item, amount) {
  state.tickerLogs.unshift({ table, item, amount: amount.toLocaleString() });
  if (state.tickerLogs.length > 5) {
    state.tickerLogs.pop();
  }
  renderFLEXTicker();
}

// ==================== PRODUCT CATALOGS ====================
function renderMenuItems(category) {
  const container = document.getElementById('menu-items-container');
  container.innerHTML = '';

  const filtered = PRODUCTS.filter(p => p.category === category);
  
  filtered.forEach(p => {
    const isSelected = state.cart.some(item => item.id === p.id);
    
    const card = document.createElement('div');
    card.className = `menu-card ${isSelected ? 'selected' : ''}`;
    
    let tagHtml = '';
    if (p.tag) {
      let tagClass = '';
      if (p.category === 'corkage') tagClass = 'corkage-tag';
      if (p.category === 'tips') tagClass = 'tips-tag';
      tagHtml = `<span class="menu-card-tag ${tagClass}">${p.tag}</span>`;
    }

    card.innerHTML = `
      ${tagHtml}
      <div class="menu-item-icon">${p.icon}</div>
      <div>
        <h4 class="menu-item-name">${p.name}</h4>
        <p class="menu-item-desc">${p.desc}</p>
      </div>
      <div class="menu-item-footer">
        <span class="menu-item-price">${p.price.toLocaleString()}원</span>
        <button class="btn-add-item" onclick="toggleCartItem('${p.id}')">${isSelected ? '✓' : '+'}</button>
      </div>
    `;
    
    container.appendChild(card);
  });
}

window.toggleCartItem = function(productId) {
  const index = state.cart.findIndex(item => item.id === productId);
  if (index > -1) {
    state.cart.splice(index, 1);
  } else {
    const product = PRODUCTS.find(p => p.id === productId);
    state.cart.push(product);
  }
  
  updateCartUI();
  
  const activeCatBtn = document.querySelector('.category-tabs .category-btn.active');
  if (activeCatBtn) {
    renderMenuItems(activeCatBtn.getAttribute('data-category'));
  }
};

function updateCartUI() {
  const qty = state.cart.length;
  const total = state.cart.reduce((sum, item) => sum + item.price, 0);

  document.getElementById('cart-qty').textContent = qty;
  document.getElementById('cart-total-amount').textContent = total.toLocaleString();

  const cartBar = document.querySelector('.cart-bar');
  if (qty > 0) {
    cartBar.classList.add('active');
  } else {
    cartBar.classList.remove('active');
  }
}

function checkoutCart() {
  if (state.cart.length === 0) return;

  const total = state.cart.reduce((sum, item) => sum + item.price, 0);
  const hasTip = state.cart.find(item => item.category === 'tips');
  
  alert(`카드 결제 승인 중...\n합계 금액: ${total.toLocaleString()}원`);
  
  state.ordered = true;

  // Process purchases and broadcast logs to MQTT
  state.cart.forEach(item => {
    // Add locally immediately
    if (item.category === 'bottle' || item.price >= 50000 || item.category === 'tips') {
      addFLEXTickerLog(state.user.table, item.name, item.price);
    }
    
    // Broadcast via MQTT
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish(`${TOPIC_PREFIX}/flex`, JSON.stringify({
        table: state.user.table,
        item: item.name,
        amount: item.price
      }), { qos: 1 });
    }
  });

  if (hasTip) {
    triggerCheersAnimation(hasTip);
  } else {
    alert('주문 및 카드 승인이 정상 완료되었습니다!\n이제 귓속말 기능이 잠금해제 되었습니다.');
  }

  state.cart = [];
  updateCartUI();
  switchTab('chat');
}

function triggerCheersAnimation(tipItem) {
  const overlay = document.getElementById('cheers-animation-overlay');
  const msg = document.getElementById('cheers-message');
  
  msg.textContent = `${state.user.table}번 테이블에서 바텐더 민지에게 [${tipItem.name}]을 선물했습니다!`;
  overlay.classList.add('active');

  setTimeout(() => {
    overlay.classList.remove('active');
  }, 4000);
}

// ==================== CHAT ACTIONS ====================
function startChatWith(tableNum) {
  state.activeChatTable = tableNum;
  
  if (!state.chats[tableNum]) {
    state.chats[tableNum] = [];
  }

  switchTab('chat');
  renderChatSidebar();
  renderActiveChatWindow(tableNum);
}

function renderChatSidebar() {
  const sidebar = document.querySelector('.chat-threads-sidebar');
  sidebar.innerHTML = '';

  const activeTablesList = [1, 2, 3, 6, 8];
  
  activeTablesList.forEach(num => {
    if (num === state.user.table) return;

    const node = document.createElement('div');
    node.className = `chat-thread-node ${state.activeChatTable === num ? 'active' : ''}`;
    
    const seatMapNode = document.querySelector(`.seat-node[data-table="${num}"]`);
    const emoji = seatMapNode ? seatMapNode.querySelector('.seat-icon').textContent : '👤';
    const isUnread = state.chats[num] && state.chats[num].length > 0 && state.chats[num][state.chats[num].length - 1].sender === 'them';

    if (isUnread && state.activeChatTable !== num) {
      node.className += ' unread';
    }

    node.innerHTML = `
      <span class="thread-label">${num}번</span>
      <span class="thread-avatar">${emoji}</span>
    `;

    node.addEventListener('click', () => {
      state.activeChatTable = num;
      renderChatSidebar();
      renderActiveChatWindow(num);
    });

    sidebar.appendChild(node);
  });
}

function renderActiveChatWindow(tableNum) {
  const header = document.getElementById('chat-window-header');
  const chatArea = document.getElementById('chat-messages-area');
  const chatInput = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-chat-send');

  chatInput.removeAttribute('disabled');
  btnSend.removeAttribute('disabled');

  const seatMapNode = document.querySelector(`.seat-node[data-table="${tableNum}"]`);
  const isSolo = seatMapNode ? seatMapNode.classList.contains('solo') : false;
  const moodLabel = isSolo ? '🤫 조용한 혼술' : '🟢 대화 환영';
  const moodClass = isSolo ? 'status-solo' : 'status-welcome';

  header.innerHTML = `
    <span class="active-chat-table">${tableNum}번 테이블과 귓속말</span>
    <span class="active-chat-status ${moodClass}">${moodLabel}</span>
  `;

  chatArea.innerHTML = '';
  const thread = state.chats[tableNum] || [];

  if (thread.length === 0) {
    chatArea.innerHTML = `
      <div class="chat-placeholder">
        ${tableNum}번 테이블과 매너 있는 대화를 나눠보세요.<br>
        상대방의 상태(${moodLabel})를 존중해 주는 매너가 필요합니다.
      </div>
    `;
  } else {
    thread.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${msg.sender === 'me' ? 'sent' : 'received'}`;
      bubble.innerHTML = `
        <div>${msg.text}</div>
        <span class="chat-bubble-time">${msg.time}</span>
      `;
      chatArea.appendChild(bubble);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
  }
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !state.activeChatTable) return;

  const tableNum = state.activeChatTable;
  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  // 1. Add locally
  if (!state.chats[tableNum]) {
    state.chats[tableNum] = [];
  }
  state.chats[tableNum].push({ sender: 'me', text, time });
  input.value = '';
  renderActiveChatWindow(tableNum);

  // 2. Publish to target table's whisper topic
  if (mqttClient && mqttClient.connected) {
    const whisperTopic = `${TOPIC_PREFIX}/whisper/${tableNum}`;
    const payload = {
      from: state.user.table,
      text: text,
      time: time
    };
    mqttClient.publish(whisperTopic, JSON.stringify(payload), { qos: 1 });
  }

  // 3. Fallback chatbot responder
  // Trigger chatbot ONLY if the target table is one of the mock tables AND no real player is sitting there
  const hasRealPlayer = state.activeServerTables[tableNum] !== undefined;
  if (!hasRealPlayer) {
    setTimeout(() => {
      triggerAutoReplyFallback(tableNum);
    }, 2000);
  }
}

function triggerAutoReplyFallback(tableNum) {
  if (!state.chats[tableNum]) return;

  // Guard: If we already received a reply or a real player took over, do not send bot reply
  const lastMsg = state.chats[tableNum][state.chats[tableNum].length - 1];
  if (lastMsg && lastMsg.sender === 'them') return;

  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const seatNode = document.querySelector(`.seat-node[data-table="${tableNum}"]`);
  const isSolo = seatNode ? seatNode.classList.contains('solo') : false;

  let replyText = '';
  if (isSolo) {
    replyText = '죄송합니다, 저는 오늘은 조용히 혼술하고 싶어서요! 나중에 기회되면 인사 나눠요~ 🤫';
  } else {
    const replies = [
      '안녕하세요! 보틀 쏘신 거 잘 구경했습니다 ㅎㅎ 술 맛 어떤가요?',
      '반갑습니다! 저희 오늘 좋은 일 있어서 축하 겸 방문했어요 😊',
      '와, 귓속말 감사합니다! 혹시 위스키 자주 드시나요?',
      '감사합니다~ 짠!! 🥂',
      '반가워요! 바텐더 분이랑 얘기하고 있었는데 귓속말 신기하네요 ㅋㅋ'
    ];
    replyText = replies[Math.floor(Math.random() * replies.length)];
  }

  state.chats[tableNum].push({ sender: 'them', text: replyText, time });

  if (state.activeChatTable === tableNum && state.activeTab === 'chat') {
    renderActiveChatWindow(tableNum);
  } else {
    renderChatSidebar();
  }
}
