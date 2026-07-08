// ==================== DOKJU POS ADMIN LOGIC (FIREBASE) ====================

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

let activeOrdersList = {};
let previousPendingCount = 0;

// Base mock seating for alignment matching customer UI
const mockSeating = {
  1: { gender: 'male', age: 34, mood: 'talk', nickname: '정우' },
  2: { gender: 'female', age: 26, mood: 'solo', nickname: '민지' },
  3: { gender: 'male', age: 31, mood: 'talk', nickname: '도현' },
  6: { gender: 'female', age: 29, mood: 'talk', nickname: '지수' },
  8: { gender: 'male', age: 36, mood: 'talk', nickname: '성민' }
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  initFirebaseSync();
});

// ==================== FIREBASE SYNC ====================
function initFirebaseSync() {
  // 1. Sync active seats map
  db.ref('tables').on('value', (snapshot) => {
    const tables = snapshot.val() || {};
    updateSeatingMap(tables);
  });

  // 2. Sync orders queue
  db.ref('orders').on('value', (snapshot) => {
    const orders = snapshot.val() || {};
    activeOrdersList = orders;
    processOrders(orders);
  });

  // 3. Monitor live chats logs globally
  db.ref('chats').on('value', (snapshot) => {
    const chats = snapshot.val() || {};
    processChatMonitoring(chats);
  });
}

// ==================== SEATING MONITOR ====================
function updateSeatingMap(serverTables) {
  const merged = { ...mockSeating, ...serverTables };
  let count = 0;

  for (let t = 1; t <= 8; t++) {
    const node = document.querySelector(`.seat-card[data-table="${t}"]`);
    if (!node) continue;

    const info = merged[t];

    if (info) {
      count++;
      const isSolo = info.mood === 'solo';
      node.className = `seat-card occupied ${info.gender} ${isSolo ? 'solo' : 'welcome'}`;
      node.querySelector('.seat-av').textContent = info.gender === 'male' ? '👦🏻' : '👩🏻';
      node.querySelector('.seat-name').textContent = info.nickname || '손님';
      node.querySelector('.seat-meta').textContent = `${info.gender === 'male' ? '남' : '여'}${info.age} · ${isSolo ? '혼술' : '대화'}`;
    } else {
      node.className = 'seat-card empty';
      node.querySelector('.seat-av').textContent = '＋';
      node.querySelector('.seat-name').textContent = '빈자리';
      node.querySelector('.seat-meta').textContent = '-';
    }
  }

  document.getElementById('active-seats').textContent = `${count} / 8`;
}

// ==================== ORDERS POS QUEUE ====================
function processOrders(orders) {
  const queue = document.getElementById('orders-queue');
  const badge = document.getElementById('orders-badge');
  
  queue.innerHTML = '';

  let pendingCount = 0;
  let totalSales = 0;

  // Sort orders descending by timestamp
  const sortedKeys = Object.keys(orders).sort((a, b) => orders[b].timestamp - orders[a].timestamp);

  sortedKeys.forEach(id => {
    const order = orders[id];
    totalSales += order.total;

    if (order.status === 'pending') {
      pendingCount++;
      
      const card = document.createElement('div');
      card.className = 'order-card';
      
      const itemsHtml = order.items.map(item => `
        <div class="order-card-item">
          <span class="item-name">${item.icon} ${item.name}</span>
          <span class="item-price">${item.price.toLocaleString()}원</span>
        </div>
      `).join('');

      card.innerHTML = `
        <div class="order-card-hdr">
          <span class="order-card-table">${order.table}번 테이블 주문</span>
          <span class="order-card-time">${order.time}</span>
        </div>
        <div class="order-card-items">
          ${itemsHtml}
        </div>
        <div class="order-card-footer">
          <div class="order-card-total">
            합계: <strong>${order.total.toLocaleString()}원</strong>
          </div>
          <button class="btn-serve" onclick="completeOrder('${id}')">✓ 서비스 완료</button>
        </div>
      `;

      queue.appendChild(card);
    }
  });

  badge.textContent = pendingCount;
  document.getElementById('sales-today').textContent = totalSales.toLocaleString() + '원';

  if (pendingCount === 0) {
    queue.innerHTML = `
      <div class="orders-empty">
        <span class="empty-icon">☕</span>
        <p>대기 중인 새로운 주문이 없습니다</p>
      </div>
    `;
  }

  // Play Synth Sound notification on new pending order arrival
  if (pendingCount > previousPendingCount) {
    playPOSBell();
  }
  previousPendingCount = pendingCount;
}

// Complete order handler
window.completeOrder = function(orderId) {
  if (db) {
    db.ref(`orders/${orderId}/status`).set('completed');
  }
};

// ==================== LIVE CHAT MONITOR ====================
function processChatMonitoring(rooms) {
  const container = document.getElementById('monitor-logs');
  container.innerHTML = '';

  let allMessages = [];

  // Parse rooms and gather messages
  Object.keys(rooms).forEach(roomId => {
    const room = rooms[roomId];
    if (!room) return;

    Object.keys(room).forEach(msgId => {
      const msg = room[msgId];
      if (msg) {
        // Parse tables from roomId (e.g. 3_6 or 3_99)
        const tables = roomId.split('_');
        const t1 = parseInt(tables[0]);
        const t2 = parseInt(tables[1]);

        allMessages.push({
          room: `${t1}번 ↔ ${t2}번`,
          from: msg.senderTable,
          text: msg.text,
          time: msg.time,
          timestamp: msg.timestamp || 0
        });
      }
    });
  });

  // Sort messages by descending timestamp (newest first)
  allMessages.sort((a, b) => b.timestamp - a.timestamp);

  // Take latest 15 messages
  const latestLogs = allMessages.slice(0, 15);

  if (latestLogs.length === 0) {
    container.innerHTML = `<div class="monitor-empty">손님 간 실시간 귓속말 통신 내역이 여기에 표시됩니다.</div>`;
    return;
  }

  latestLogs.forEach(log => {
    const div = document.createElement('div');
    div.className = 'monitor-entry';
    div.innerHTML = `
      <div class="monitor-entry-hdr">
        <span>[${log.room}]</span>
        <span>Table ${log.from} 발송</span>
      </div>
      <div class="monitor-entry-body">"${log.text}"</div>
      <div class="monitor-entry-time">${log.time}</div>
    `;
    container.appendChild(div);
  });
}

// ==================== SOUND SYNTHESIZER ====================
function playPOSBell() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // Note 1: High Bell ding (A5 - 880Hz)
    let osc1 = ctx.createOscillator();
    let gain1 = ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.4);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.4);

    // Note 2: E5 (659Hz) slightly offset
    setTimeout(() => {
      let osc2 = ctx.createOscillator();
      let gain2 = ctx.createGain();
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain2.gain.setValueAtTime(0.12, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.5);
      
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.5);
    }, 120);

  } catch (e) {
    console.warn("Audio Bell synthesis failed:", e);
  }
}
