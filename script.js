// --- 상태 변수 및 상수 ---
let currentDate = new Date();
let selectedDateStr = null;
let transactions = {}; // { 'YYYY-MM-DD': [{type, item, amount}, ...] }

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
const transactionListEl = document.querySelector('#transaction-list ul');
const addTransactionBtn = document.getElementById('add-transaction-btn');

const modal = document.getElementById('transaction-modal');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const itemInput = document.getElementById('item-input');
const amountInput = document.getElementById('amount-input');


// --- 핵심 기능 함수 ---

/**
 * 로컬 스토리지에서 데이터 불러오기
 */
const loadTransactions = () => {
    const storedTransactions = localStorage.getItem('감성가계부_데이터');
    transactions = storedTransactions ? JSON.parse(storedTransactions) : {};
};

/**
 * 로컬 스토리지에 데이터 저장하기
 */
const saveTransactions = () => {
    localStorage.setItem('감성가계부_데이터', JSON.stringify(transactions));
};

/**
 * 교대근무 계산 함수
 * @param {Date} date - 계산할 날짜 객체
 * @returns {string} - 근무 형태 ('주', '야', '비', '휴')
 */
const getShiftType = (date) => {
    const timeDiff = date.getTime() - SHIFT_BASE_DATE.getTime();
    const diffDays = Math.round(timeDiff / (1000 * 60 * 60 * 24));
    const remainder = (diffDays % SHIFT_CYCLE.length + SHIFT_CYCLE.length) % SHIFT_CYCLE.length;
    return SHIFT_CYCLE[remainder];
};

/**
 * 달력 렌더링 함수
 */
const renderCalendar = () => {
    loadTransactions();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthYearEl.textContent = `${year}년 ${month + 1}월`;
    calendarDatesEl.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    // 날짜 셀 생성
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('date-cell', 'not-current-month');
        calendarDatesEl.appendChild(emptyCell);
    }

    for (let i = 1; i <= lastDate; i++) {
        const date = new Date(year, month, i);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        const cell = document.createElement('div');
        cell.classList.add('date-cell');
        
        // 날짜, 근무, 수입/지출 정보 추가
        const dateNumber = document.createElement('span');
        dateNumber.classList.add('date-number');
        dateNumber.textContent = i;
        cell.appendChild(dateNumber);

        const shiftType = getShiftType(date);
        const shiftTag = document.createElement('span');
        shiftTag.classList.add('shift-tag', `shift-${shiftType}`);
        shiftTag.textContent = shiftType;
        cell.appendChild(shiftTag);

        // 오늘 날짜 표시
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            cell.classList.add('today');
        }
        
        // 선택된 날짜 표시
        if (dateStr === selectedDateStr) {
            cell.classList.add('selected');
        }
        
        // 수입/지출 총액 표시
        const dayTransactions = transactions[dateStr] || [];
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
            cell.appendChild(totalsDiv);
        }

        cell.addEventListener('click', () => selectDate(dateStr, cell));
        calendarDatesEl.appendChild(cell);
    }
};

/**
 * 상세 내역 렌더링 함수
 * @param {string} dateStr - 'YYYY-MM-DD' 형식의 날짜 문자열
 */
const renderDetails = (dateStr) => {
    detailsSection.style.display = 'block';
    const dateObj = new Date(dateStr);
    selectedDateTitle.textContent = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 상세 내역`;
    
    transactionListEl.innerHTML = '';
    const dayTransactions = transactions[dateStr] || [];

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

/**
 * 날짜 선택 함수
 * @param {string} dateStr - 선택된 날짜 문자열
 * @param {HTMLElement} cellEl - 선택된 날짜 셀 요소
 */
const selectDate = (dateStr, cellEl) => {
    selectedDateStr = dateStr;
    
    // 시각적 피드백 업데이트
    document.querySelectorAll('.date-cell.selected').forEach(c => c.classList.remove('selected'));
    if (cellEl) {
        cellEl.classList.add('selected');
    }
    
    renderDetails(dateStr);
};

/**
 * 거래 내역 삭제 함수
 * @param {string} dateStr - 날짜 문자열
 * @param {number} index - 삭제할 항목의 인덱스
 */
const deleteTransaction = (dateStr, index) => {
    if (confirm('정말로 이 내역을 삭제하시겠어요?')) {
        transactions[dateStr].splice(index, 1);
        if (transactions[dateStr].length === 0) {
            delete transactions[dateStr];
        }
        saveTransactions();
        renderCalendar();
        renderDetails(dateStr);
    }
};

// --- 이벤트 리스너 ---

// 월 이동 버튼
prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

// 내역 추가 버튼 (모달 열기)
addTransactionBtn.addEventListener('click', () => {
    if (!selectedDateStr) return;
    // 폼 초기화
    document.getElementById('type-expense').checked = true;
    itemInput.value = '';
    amountInput.value = '';
    modal.style.display = 'flex';
    itemInput.focus();
});

// 모달 닫기
modalCancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

// 모달 저장 버튼
modalSaveBtn.addEventListener('click', () => {
    const type = document.querySelector('input[name="transaction-type"]:checked').value;
    const item = itemInput.value.trim();
    const amount = parseInt(amountInput.value, 10);
    
    if (!item || isNaN(amount) || amount <= 0) {
        alert('항목과 금액을 올바르게 입력해주세요.');
        return;
    }

    const newTransaction = { type, item, amount };

    if (!transactions[selectedDateStr]) {
        transactions[selectedDateStr] = [];
    }
    transactions[selectedDateStr].push(newTransaction);
    
    saveTransactions();
    renderCalendar();
    renderDetails(selectedDateStr);
    modal.style.display = 'none';
});


// --- 초기화 ---
const initializeApp = () => {
    loadTransactions();
    renderCalendar();
    
    // 오늘 날짜를 기본으로 선택
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    selectDate(todayStr);
    // 달력에 오늘 날짜가 보이도록
    const todayCell = Array.from(calendarDatesEl.children).find(cell => {
         const dateNumEl = cell.querySelector('.date-number');
         if(!dateNumEl) return false;
         return parseInt(dateNumEl.textContent) === today.getDate() && !cell.classList.contains('not-current-month');
    });
    if(todayCell) {
        todayCell.classList.add('selected');
    }
};

initializeApp();