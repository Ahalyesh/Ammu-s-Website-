// Booking app — client-side only using localStorage
(function(){
  // configuration: working hours and slot step (minutes)
  const OPEN_HOUR = 9;
  const CLOSE_HOUR = 21;
  const STEP_MIN = 30;

  // DOM refs
  const dateInput = document.getElementById('dateInput');
  const loadBtn = document.getElementById('loadSlotsBtn');
  const durationSelect = document.getElementById('durationSelect');
  const slotsGrid = document.getElementById('slotsGrid');
  const slotTemplate = document.getElementById('slotTemplate');
  const noSlots = document.getElementById('noSlots');
  const bookPanel = document.getElementById('bookPanel');
  const chosenInfo = document.getElementById('chosenInfo');
  const bookForm = document.getElementById('bookForm');
  const nameInput = document.getElementById('nameInput');
  const noteInput = document.getElementById('noteInput');
  const cancelBtn = document.getElementById('cancelBtn');
  const existingBooking = document.getElementById('existingBooking');
  const slotsTitle = document.getElementById('slotsTitle');
  const clearAll = document.getElementById('clearAll');

  let chosenSlot = null;

  // utility: localStorage key
  const STORAGE_KEY = 'amrutha_bookings_v1';

  function loadBookings(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    }catch(e){
      console.error('Failed to load bookings', e);
      return {};
    }
  }
  function saveBookings(obj){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }

  // Create date string 'YYYY-MM-DD' (local)
  function toDateKey(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function timeToStr(date){
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  }

  function addMinutes(d,min){
    return new Date(d.getTime()+min*60000);
  }

  // Build slots for a date and duration
  function buildSlotsFor(date, durationMin){
    slotsGrid.innerHTML = '';
    bookPanel.setAttribute('aria-hidden','true');
    chosenSlot = null;
    existingBooking.textContent = '';

    const start = new Date(date);
    start.setHours(OPEN_HOUR,0,0,0);
    const end = new Date(date);
    end.setHours(CLOSE_HOUR,0,0,0);

    const bookings = loadBookings();
    const key = toDateKey(date);
    const dayBookings = bookings[key] || [];

    const items = [];

    for (let t = new Date(start); t < end; t = addMinutes(t, STEP_MIN)){
      const slotStart = new Date(t);
      const slotEnd = addMinutes(slotStart, durationMin);

      if (slotEnd > end) break;

      // check if overlaps any existing booking (simple overlap)
      const overlapped = dayBookings.some(b=>{
        const bs = new Date(b.start);
        const be = new Date(b.end);
        return !(slotEnd <= bs || slotStart >= be);
      });

      items.push({start: new Date(slotStart), end: new Date(slotEnd), booked: overlapped, booking: overlapped ? dayBookings.find(b=>{
        const bs = new Date(b.start);
        const be = new Date(b.end);
        return !(slotEnd <= bs || slotStart >= be);
      }) : null});
    }

    if (items.length === 0) {
      noSlots.textContent = 'No slots for this configuration.';
      noSlots.style.display = 'block';
      return;
    }

    noSlots.style.display = 'none';
    slotsTitle.textContent = `Available slots — ${key}`;

    items.forEach(it=>{
      const node = slotTemplate.content.cloneNode(true).querySelector('.slot');
      const timeDiv = node.querySelector('.time');
      const metaDiv = node.querySelector('.meta');
      timeDiv.textContent = `${timeToStr(it.start)} → ${timeToStr(it.end)}`;
      metaDiv.textContent = it.booked ? `Booked by ${it.booking.name}` : 'Available';
      if(it.booked) node.classList.add('booked');

      node.addEventListener('click', ()=>{
        if(it.booked){
          showExistingBooking(it.booking);
          return;
        }
        chooseSlot(it);
      });

      // keyboard accessibility
      node.addEventListener('keyup', (e)=>{
        if(e.key === 'Enter' || e.key === ' '){
          node.click();
        }
      });
      slotsGrid.appendChild(node);
    });
  }

  function chooseSlot(it){
    chosenSlot = it;
    bookPanel.setAttribute('aria-hidden','false');
    chosenInfo.innerHTML = `<div><strong class="time-pill">${toDateKey(new Date(it.start))}</strong> &nbsp; <span class="time-pill">${timeToStr(it.start)}–${timeToStr(it.end)}</span></div>`;
    existingBooking.textContent = '';
    nameInput.value = '';
    noteInput.value = '';
    nameInput.focus();
  }

  function showExistingBooking(b){
    bookPanel.setAttribute('aria-hidden','false');
    chosenInfo.innerHTML = `<div><strong class="time-pill">${toDateKey(new Date(b.start))}</strong> &nbsp; <span class="time-pill">${timeToStr(new Date(b.start))}–${timeToStr(new Date(b.end))}</span></div>`;
    existingBooking.innerHTML = `<strong>Already booked by ${escapeHtml(b.name)}</strong><div style="margin-top:6px;color:var(--muted)">${escapeHtml(b.note || '—')}</div>`;
  }

  function escapeHtml(text){
    return String(text).replace(/[&<>"']/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  // persist booking
  bookForm.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    if(!chosenSlot) return alert('Please pick a slot first');
    const name = nameInput.value.trim() || 'Anonymous';
    const note = noteInput.value.trim();

    const bookings = loadBookings();
    const key = toDateKey(new Date(chosenSlot.start));
    bookings[key] = bookings[key] || [];

    // double-check no overlap (race-safe for single-user)
    const overlap = bookings[key].some(b=>{
      const bs = new Date(b.start);
      const be = new Date(b.end);
      const s = new Date(chosenSlot.start), e = new Date(chosenSlot.end);
      return !(e <= bs || s >= be);
    });
    if(overlap){
      alert('Sorry — that slot was just taken. Please reload slots.');
      buildSlotsFor(new Date(dateInput.value), parseInt(durationSelect.value,10));
      return;
    }

    bookings[key].push({
      id: Math.random().toString(36).slice(2,9),
      name,
      note,
      start: new Date(chosenSlot.start).toISOString(),
      end: new Date(chosenSlot.end).toISOString(),
      created: new Date().toISOString()
    });

    saveBookings(bookings);
    bookPanel.setAttribute('aria-hidden','true');
    chosenSlot = null;
    alert(`Booked! ${name} — ${toDateKey(new Date(bookings[key].slice(-1)[0].start))} ${timeToStr(new Date(bookings[key].slice(-1)[0].start))}`);
    buildSlotsFor(new Date(dateInput.value), parseInt(durationSelect.value,10));
  });

  cancelBtn.addEventListener('click', ()=>{
    bookPanel.setAttribute('aria-hidden','true');
    chosenSlot = null;
  });

  loadBtn.addEventListener('click', ()=>{
    const d = dateInput.value ? new Date(dateInput.value + 'T00:00:00') : null;
    if(!d || isNaN(d.getTime())) { alert('Pick a valid date.'); return; }
    buildSlotsFor(d, parseInt(durationSelect.value,10));
  });

  // clear all (dev)
  clearAll.addEventListener('click', ()=>{
    if(confirm('Clear all bookings from localStorage?')) {
      localStorage.removeItem(STORAGE_KEY);
      alert('All bookings cleared.');
      slotsGrid.innerHTML = '';
      noSlots.style.display = 'block';
    }
  });

  // populate date input with today by default
  const today = new Date();
  dateInput.value = today.toISOString().slice(0,10);

  // keyboard: press Enter on date field to load
  dateInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') loadBtn.click(); });

  // Optional: show upcoming bookings summary (first 3)
  function showUpcoming(){
    const bookings = loadBookings();
    const keys = Object.keys(bookings).sort();
    let count = 0;
    for(const k of keys){
      for(const b of bookings[k]){
        count++;
      }
    }
    // (we could show somewhere; for now we append to footer)
    const footer = document.querySelector('.footer');
    const span = document.createElement('span');
    span.style.color = 'var(--muted)';
    span.textContent = ` • ${count} booking(s) saved locally`;
    footer.appendChild(span);
  }

  showUpcoming();

})();
