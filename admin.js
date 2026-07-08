// ==================== DOKJU POS ADMIN LOGIC (MQTT) ====================

const MQTT_URL = 'wss://broker.hivemq.com:8884/mqtt';
const TOPIC   = 'dokju/bar/banana/v3';
let mqttClient = null;
let mqttId = 'admin_' + Math.random().toString(16).slice(2, 10);

let activeOrders = {}; // orderId -> order detail { table, nickname, items, total, time, status }
let pendingOrdersCount = 0;
let totalSalesAccumulated = 2230000; // Seed default sales for realistic demo

// Base mock seating for alignment matching customer UI
const mockSeating = {
  1: { gender: 'male', age: 34, mood: 'talk', nickname: '정우' },
  2: { gender: 'female', age: 26, mood: 'solo', nickname: '민지' },
  3: { gender: 'male', age: 31, mood: 'talk', nickname: '도현' },
  6: { gender: 'female', age: 29, mood: 'talk', nickname: '지수' },
  8: { gender: 'male', age: 36, mood: 'talk', nickname: '성민' }
};

const serverTables = {}; // Live MQTT presence metadata

// ==================== BOOT ====================
document.addEventListener('DOMContentLoaded', () => {
  initMqttConnection();
  document.getElementById('sales-today').textContent = totalSalesAccumulated.toLocaleString() + '원';
});

// ==================== SERVERLESS MQTT PRESENCE ====================
function initMqttConnection() {
  mqttClient = mqtt.connect(MQTT_URL, { clientId: mqttId });

  mqttClient.on('connect', () => {
    console.log("Admin connected to HiveMQ Broker!");
    
    // Subscribe to seating maps, FLEX logs, whispers logs, and incoming orders requests
    mqttClient.subscribe(`${TOPIC}/table/+`);
    mqttClient.subscribe(`${TOPIC}/flex`);
    mqttClient.subscribe(`${TOPIC}/orders/request`);
    mqttClient.subscribe(`${TOPIC}/whisper/#`); // Wildcard to capture all table whispers
  });

  mqttClient.on('message', (topic, raw) => {
    try {
      const data = JSON.parse(raw.toString());
      
      // 1. Seating maps updates
      if (topic.startsWith(`${TOPIC}/table/`)) {
        const t = parseInt(topic.split('/').pop());
        if (data.action === 'leave') {
          delete serverTables[t];
        } else {
          serverTables[t] = data;
        }
        updateSeatingMap();
      }
      
      // 2. Incoming Orders Requests from clients
      else if (topic === `${TOPIC}/orders/request`) {
        const orderId = data.orderId || 'ord_' + Date.now();
        
        // Prevent duplicate appending
        if (!activeOrders[orderId]) {
          activeOrders[orderId] = {
            table: data.table,
            nickname: data.nickname,
            items: data.items,
            total: data.total,
            time: data.time,
            status: 'pending'
          };
          renderOrdersQueue();
          playPOSBell(); // Play synth POS sound alert
        }
      }
      
      // 3. FLEX order log broadcasts
      else if (topic === `${TOPIC}/flex`) {
        // Accumulate sales dynamically
        totalSalesAccumulated += data.amount;
        document.getElementById('sales-today').textContent = totalSalesAccumulated.toLocaleString() + '원';
      }
      
      // 4. Wildcard whispers monitoring log
      else if (topic.includes('/whisper/')) {
        const toTable = topic.split('/').pop();
        appendWhisperLog(data.from, toTable, data.text, data.time);
      }
    } catch (e) {
      console.error("Admin MQTT parsing error:", e);
    }
  });

  mqttClient.on('close', () => {
    console.log("Admin disconnected. Retrying...");
    setTimeout(initMqttConnection, 4000);
  });
}

// ==================== SEATING MONITOR ====================
function updateSeatingMap() {
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
function renderOrdersQueue() {
  const queue = document.getElementById('orders-queue');
  const badge = document.getElementById('orders-badge');
  
  queue.innerHTML = '';
  let count = 0;

  // Filter pending items
  const orderKeys = Object.keys(activeOrders).filter(id => activeOrders[id].status === 'pending');
  badge.textContent = orderKeys.length;

  orderKeys.forEach(id => {
    count++;
    const order = activeOrders[id];
    
    const card = document.createElement('div');
    card.className = 'order-card';

    const itemsHtml = order.items.map(item => `
      <div class="order-card-item">
        <span class="item-name">${item.name}</span>
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
        <button class="btn-serve" onclick="serveOrder('${id}', ${order.table})">✓ 서비스 완료</button>
      </div>
    `;

    queue.appendChild(card);
  });

  if (count === 0) {
    queue.innerHTML = `
      <div class="orders-empty">
        <span class="empty-icon">☕</span>
        <p>대기 중인 새로운 주문이 없습니다</p>
      </div>
    `;
  }
}

// Complete order handler
window.serveOrder = function(orderId, tableNum) {
  if (activeOrders[orderId]) {
    activeOrders[orderId].status = 'completed';
    renderOrdersQueue();

    // Publish serve completion notification to release chat locks on client side
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish(`${TOPIC}/orders/serve/${tableNum}`, JSON.stringify({
        status: 'completed'
      }), { qos: 1 });
    }
  }
};

// ==================== LIVE CHAT MONITOR ====================
let whisperLogs = [];

function appendWhisperLog(fromTable, toTable, text, time) {
  const container = document.getElementById('monitor-logs');
  
  whisperLogs.unshift({
    from: fromTable,
    to: toTable,
    text: text,
    time: time
  });

  // Limit to last 20 logs
  if (whisperLogs.length > 20) whisperLogs.pop();

  container.innerHTML = '';
  
  whisperLogs.forEach(log => {
    const div = document.createElement('div');
    div.className = 'monitor-entry';
    div.innerHTML = `
      <div class="monitor-entry-hdr">
        <span>[${log.from}번 ↔ ${log.to}번]</span>
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
