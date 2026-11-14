const api = (path, options = {}) =>
  fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  }).then(async (r) => {
    if (r.status === 204) return null;
    const body = await r.json();
    if (!r.ok) throw new Error(body.error || r.statusText);
    return body;
  });

const $ = (sel) => document.querySelector(sel);

let selectedSlot = null;
let eventTypes = [];

// ---- вкладки ----
function showTab(tab) {
  $('#view-guest').hidden = tab !== 'guest';
  $('#view-admin').hidden = tab !== 'admin';
  $('#tab-guest').classList.toggle('active', tab === 'guest');
  $('#tab-admin').classList.toggle('active', tab === 'admin');
}
$('#tab-guest').onclick = () => showTab('guest');
$('#tab-admin').onclick = () => showTab('admin');

// ---- типы встреч ----
async function loadEventTypes() {
  eventTypes = await api('/event-types');
  $('#guest-event-type').innerHTML = eventTypes
    .map((t) => `<option value="${t.id}">${t.name} (${t.durationMinutes} мин)</option>`)
    .join('');
  $('#event-type-list').innerHTML = eventTypes
    .map((t) => `<li>${t.name} — ${t.durationMinutes} мин <button data-del="${t.id}">✕</button></li>`)
    .join('');
}

$('#event-type-form').onsubmit = async (e) => {
  e.preventDefault();
  await api('/event-types', {
    method: 'POST',
    body: JSON.stringify({
      name: $('#et-name').value,
      description: $('#et-description').value,
      durationMinutes: Number($('#et-duration').value),
    }),
  });
  $('#et-name').value = '';
  $('#et-description').value = '';
  loadEventTypes();
};

$('#event-type-list').onclick = async (e) => {
  const id = e.target.dataset.del;
  if (id) {
    await api(`/event-types/${id}`, { method: 'DELETE' });
    loadEventTypes();
  }
};

// ---- расписание ----
async function loadAvailability() {
  const av = await api('/availability');
  document.querySelectorAll('#weekday-checks input').forEach((c) => {
    c.checked = av.weekdays.includes(Number(c.value));
  });
  $('#av-start').value = av.startTime;
  $('#av-end').value = av.endTime;
}

$('#availability-form').onsubmit = async (e) => {
  e.preventDefault();
  const weekdays = [...document.querySelectorAll('#weekday-checks input:checked')].map((c) => Number(c.value));
  await api('/availability', {
    method: 'PUT',
    body: JSON.stringify({ weekdays, startTime: $('#av-start').value, endTime: $('#av-end').value }),
  });
};

// ---- слоты (гость) ----
$('#guest-date').onchange = loadSlots;

async function loadSlots() {
  const date = $('#guest-date').value;
  if (!date) return;
  const slots = await api(`/slots?date=${date}`);
  $('#guest-slots').innerHTML = slots.length
    ? slots
        .map((s) => {
          const label = s.start.slice(11, 16);
          return `<button class="slot ${s.booked ? 'booked' : ''}" ${s.booked ? 'disabled' : ''} data-start="${s.start}">${label}</button>`;
        })
        .join('')
    : '<p>Нет слотов на этот день</p>';
  $('#guest-form').hidden = true;
  $('#guest-result').textContent = '';
}

$('#guest-slots').onclick = (e) => {
  if (!e.target.dataset.start) return;
  selectedSlot = e.target.dataset.start;
  document.querySelectorAll('#guest-slots .slot').forEach((b) => b.classList.remove('selected'));
  e.target.classList.add('selected');
  $('#guest-form').hidden = false;
};

$('#guest-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        slotStart: selectedSlot,
        eventTypeId: $('#guest-event-type').value,
        guestName: $('#guest-name').value,
        guestEmail: $('#guest-email').value,
        comment: $('#guest-comment').value,
      }),
    });
    $('#guest-result').textContent = `✅ Записан на ${selectedSlot.replace('T', ' ')}`;
    $('#guest-form').hidden = true;
    loadSlots();
  } catch (err) {
    $('#guest-result').textContent = `❌ ${err.message}`;
  }
};

// ---- брони (владелец) ----
async function loadBookings() {
  const [bookings] = await Promise.all([api('/bookings')]);
  $('#booking-list').innerHTML = bookings.length
    ? bookings
        .map((b) => {
          const type = eventTypes.find((t) => t.id === b.eventTypeId);
          return `<li>${b.slotStart.replace('T', ' ')} — ${type ? type.name : ''} — ${b.guestName} (${b.guestEmail})
            <button data-cancel="${b.id}">Отменить</button></li>`;
        })
        .join('')
    : '<li>Броней пока нет</li>';
}

$('#booking-list').onclick = async (e) => {
  const id = e.target.dataset.cancel;
  if (id) {
    await api(`/bookings/${id}`, { method: 'DELETE' });
    loadBookings();
  }
};

function init() {
  $('#guest-date').valueAsDate = new Date();
  loadEventTypes();
  loadAvailability();
  loadSlots();
  loadBookings();
}

init();
