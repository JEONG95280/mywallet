// --- 상태 변수 및 상수 ---
let currentDate = new Date();
let selectedDateStr = null;
let appData = {
    transactions: {}, // { 'YYYY-MM-DD': [{type, item, amount}, ...] }
    schedules: {}     // { 'YYYY-MM-DD': [{text}, ...] }
};

// 교대근무 기준일 설정
const SHIFT_BASE_DATE = new Date('2025-07-11'); // '야간' 근무일
const SHIFT_CYCLE = ['야', '비', '휴', '주'];

// --- DOM 요소 ---
const monthYearEl = document.getElementById('current-month-year');
const calendarDatesEl = document.getElementById('calendar-dates');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');

const detailsSection = document.getElementById('details-section');
const selectedDateTitle = document.getElementById('selected-date-title');

// 거래 내역 관련 DOM
const transactionListEl = document.querySelector('#transaction-list ul');
const addTransactionBtn = document.getElementById('add-transaction-btn');
const transactionModal = document.getElementById('transaction-modal');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const itemInput = document.getElementById('item-input');
const amountInput = document.getElementById('amount-input');

// 일정 관련 DOM
const scheduleListEl = document.querySelector('#schedule-list ul');
const addScheduleBtn = document.getElementById('add-schedule-btn');
const scheduleModal = document.getElementById('schedule-modal');
const scheduleSaveBtn = document.getElementById('schedule-save-btn');
const scheduleCancelBtn = document.getElementById('schedule-cancel-btn');
const scheduleInput = document.getElementById('schedule-input');


// --- 데이터 관리 함수 ---
const loadData = () => {
    const storedData = localStorage.getItem('감성가계부_데이터_V2');
    if (storedData) {
        appData = JSON.parse(storedData);
        if (!appData.schedules) appData.schedules = {};
    }
};

const saveData = () => {
    localStorage.setItem('감성가계부_데이터_V2', JSON.stringify(appData));
};

const getShiftType = (date) => {
    const timeDiff = date.getTime() - SHIFT_BASE_DATE.getTime();
    const diffDays = Math.round(timeDiff / (1000 * 60 * 60 * 24));
    const remainder = (diffDays % SHIFT_CYCLE.length + SHIFT_CYCLE.length) % SHIFT_CYCLE.length;
    return SHIFT_CYCLE[remainder];
};


// --- 렌더링 함수 ---

/**
 * 달력 렌더링 함수 (핵심 수정)
 */
const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthYearEl.textContent = `${year}년 ${month + 1}월`;
    calendarDatesEl.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('date-cell', 'not-current-month');
        calendarDatesEl.appendChild(emptyCell);
    }

    for (let i = 1; i <= lastDate; i++) {
        const date = new Date(year, month, i);
        const dayOfWeek = date.getDay();
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        const cell = document.createElement('div');
        cell.classList.add('date-cell');
        if (dayOfWeek === 0) cell.classList.add('sunday');
        if (dayOfWeek === 6) cell.classList.add('saturday');

        // --- Cell Header (날짜, 근무태그) ---
        const cellHeader = document.createElement('div');
        cellHeader.classList.add('cell-header');
        
        const dateNumber = document.createElement('span');
        dateNumber.classList.add('date-number');
        dateNumber.textContent = i;
        cellHeader.appendChild(dateNumber);

        const shiftType = getShiftType(date);
        const shiftTag = document.createElement('span');
        shiftTag.classList.add('shift-tag', `shift-${shiftType}`);
        shiftTag.textContent = shiftType;
        cellHeader.appendChild(shiftTag);
        
        cell.appendChild(cellHeader);

        // --- Cell Content (가계부, 일정) ---
        const cellContent = document.createElement('div');
        cellContent.classList.add('cell-content');

        // 수입/지출 총액 표시
        const dayTransactions = appData.transactions[dateStr] || [];
        if (dayTransactions.length > 0) {
            let incomeTotal = 0;
            let expenseTotal = 0;
            dayTransactions.forEach(t => {
                if (t.type === 'income') incomeTotal += t.amount;
                else expenseTotal += t.amount;
            });

            const totalsDiv = document.createElement('div');
            totalsDiv.classList.add('totals');
            if (incomeTotal > 0) {
                const incomeEl = document.createElement('div');
                incomeEl.classList.add('total-income');
                incomeEl.textContent = `+${incomeTotal.toLocaleString()}`;
                totalsDiv.appendChild(incomeEl);
            }
            if (expenseTotal > 0) {
                const expenseEl = document.createElement('div');
                expenseEl.classList.add('total-expense');
                expenseEl.textContent = `-${expenseTotal.toLocaleString()}`;
                totalsDiv.appendChild(expenseEl);
            }
            cellContent.appendChild(totalsDiv);
        }

        // 일정 미리보기 표시
        const daySchedules = appData.schedules[dateStr] || [];
        if (daySchedules.length > 0) {
            const schedulePreview = document.createElement('ul');
            schedulePreview.classList.add('schedule-preview-list');
            daySchedules.forEach(s => {
                const item = document.createElement('li');
                item.textContent = s.text;
                schedulePreview.appendChild(item);
            });
            cellContent.appendChild(schedulePreview);
        }

        cell.appendChild(cellContent);

        // --- 오늘/선택 날짜 표시 및 이벤트 리스너 ---
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            cell.classList.add('today');
        }
        if (dateStr === selectedDateStr) {
            cell.classList.add('selected');
        }
        cell.addEventListener('click', () => selectDate(dateStr, cell));
        calendarDatesEl.appendChild(cell);
    }
};

const renderDetails = (dateStr) => {
    detailsSection.style.display = 'block';
    const dateObj = new Date(dateStr.replace(/-/g, '/'));
    selectedDateTitle.textContent = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일`;
    
    renderTransactionList(dateStr);
    renderScheduleList(dateStr);
};

const renderTransactionList = (dateStr) => {
    transactionListEl.innerHTML = '';
    const dayTransactions = appData.transactions[dateStr] || [];
    if (dayTransactions.length === 0) {
        transactionListEl.innerHTML = '<li>거래 내역이 없습니다.</li>';
        return;
    }
    dayTransactions.forEach((t, index) => {
        const li = document.createElement('li');
        const itemDetails = document.createElement('div');
        itemDetails.classList.add('item-details');
        const typeSpan = document.createElement('span');
        typeSpan.classList.add('item-type', t.type);
        typeSpan.textContent = t.type === 'income' ? '수입' : '지출';
        const itemSpan = document.createElement('span');
        itemSpan.textContent = `${t.item} (${t.amount.toLocaleString()}원)`;
        itemDetails.appendChild(typeSpan);
        itemDetails.appendChild(itemSpan);
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.textContent = 'x';
        deleteBtn.addEventListener('click', () => deleteTransaction(dateStr, index));
        li.appendChild(itemDetails);
        li.appendChild(deleteBtn);
        transactionListEl.appendChild(li);
    });
};

const renderScheduleList = (dateStr) => {
    scheduleListEl.innerHTML = '';
    const daySchedules = appData.schedules[dateStr] || [];
    if (daySchedules.length === 0) {
        scheduleListEl.innerHTML = '<li>등록된 일정이 없습니다.</li>';
        return;
    }
    daySchedules.forEach((s, index) => {
        const li = document.createElement('li');
        li.textContent = s.text;
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.textContent = 'x';
        deleteBtn.addEventListener('click', () => deleteSchedule(dateStr, index));
        li.appendChild(deleteBtn);
        scheduleListEl.appendChild(li);
    });
};


// --- 핵심 로직 함수 ---
const selectDate = (dateStr, cellEl) => {
    selectedDateStr = dateStr;
    document.querySelectorAll('.date-cell.selected').forEach(c => c.classList.remove('selected'));
    if (cellEl) {
        cellEl.classList.add('selected');
    }
    renderDetails(dateStr);
};

const deleteTransaction = (dateStr, index) => {
    if (confirm('정말로 이 내역을 삭제하시겠어요?')) {
        appData.transactions[dateStr].splice(index, 1);
        if (appData.transactions[dateStr].length === 0) delete appData.transactions[dateStr];
        saveData();
        renderCalendar();
        renderDetails(dateStr);
    }
};

const deleteSchedule = (dateStr, index) => {
    if (confirm('정말로 이 일정을 삭제하시겠어요?')) {
        appData.schedules[dateStr].splice(index, 1);
        if (appData.schedules[dateStr].length === 0) delete appData.schedules[dateStr];
        saveData();
        renderCalendar();
        renderDetails(dateStr);
    }
};


// --- 이벤트 리스너 ---
prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});
nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

addTransactionBtn.addEventListener('click', () => {
    if (!selectedDateStr) return;
    document.getElementById('type-expense').checked = true;
    itemInput.value = ''; amountInput.value = '';
    transactionModal.style.display = 'flex';
    itemInput.focus();
});

modalCancelBtn.addEventListener('click', () => transactionModal.style.display = 'none');
transactionModal.addEventListener('click', (e) => {
    if (e.target === transactionModal) transactionModal.style.display = 'none';
});

modalSaveBtn.addEventListener('click', () => {
    const type = document.querySelector('input[name="transaction-type"]:checked').value;
    const item = itemInput.value.trim();
    const amount = parseInt(amountInput.value, 10);
    if (!item || isNaN(amount) || amount <= 0) {
        alert('항목과 금액을 올바르게 입력해주세요.'); return;
    }
    const newTransaction = { type, item, amount };
    if (!appData.transactions[selectedDateStr]) appData.transactions[selectedDateStr] = [];
    appData.transactions[selectedDateStr].push(newTransaction);
    saveData();
    renderCalendar();
    renderDetails(selectedDateStr);
    transactionModal.style.display = 'none';
});

addScheduleBtn.addEventListener('click', () => {
    if (!selectedDateStr) return;
    scheduleInput.value = '';
    scheduleModal.style.display = 'flex';
    scheduleInput.focus();
});

scheduleCancelBtn.addEventListener('click', () => scheduleModal.style.display = 'none');
scheduleModal.addEventListener('click', (e) => {
    if (e.target === scheduleModal) scheduleModal.style.display = 'none';
});

scheduleSaveBtn.addEventListener('click', () => {
    const text = scheduleInput.value.trim();
    if (!text) { alert('일정 내용을 입력해주세요.'); return; }
    const newSchedule = { text };
    if (!appData.schedules[selectedDateStr]) appData.schedules[selectedDateStr] = [];
    appData.schedules[selectedDateStr].push(newSchedule);
    saveData();
    renderCalendar();
    renderDetails(selectedDateStr);
    scheduleModal.style.display = 'none';
});


// --- 초기화 ---
const initializeApp = () => {
    loadData();
    const today = new Date();
    // 현재 날짜를 기준으로 달력 표시
    currentDate = new Date(today.getFullYear(), today.getMonth(), 1);

    renderCalendar();
    
    // 오늘 날짜를 기본으로 선택
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayCell = Array.from(calendarDatesEl.children).find(cell => {
         if (cell.classList.contains('not-current-month')) return false;
         const dateNumEl = cell.querySelector('.date-number');
         return dateNumEl && parseInt(dateNumEl.textContent) === today.getDate();
    });
    
    selectDate(todayStr, todayCell);
};

initializeApp();