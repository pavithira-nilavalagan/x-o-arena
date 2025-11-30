/* ========= SETTINGS & ASSETS ========= */
const placeAudioDataURI = null;
const winAudioDataURI   = null;
const drawAudioDataURI  = null;

/* ========= Game State ========= */
const WIN_CONDITIONS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

const cells = Array.from(document.querySelectorAll('.cell'));
const boardEl = document.getElementById('board');
const svgEl = document.getElementById('win-line');

const turnIndicator = document.getElementById('turnIndicator');
const resetBtn = document.getElementById('resetBtn');
const newGameBtn = document.getElementById('newGame');
const modeToggle = document.getElementById('modeToggle');
const aiLevel = document.getElementById('aiLevel');
const modeLabel = document.getElementById('modeLabel');
const soundToggle = document.getElementById('soundToggle');
const themeToggle = document.getElementById('themeToggle');
const themeLabel = document.getElementById('themeLabel');
const resetScoreBtn = document.getElementById('resetScoreBtn');
const scoreXEl = document.getElementById('scoreX');
const scoreOEl = document.getElementById('scoreO');
const scoreDEl = document.getElementById('scoreD');

const historyPanel = document.getElementById('historyPanel');
const historyBtn = document.getElementById('historyBtn');
const clearHistoryBtn = document.getElementById('clearHistory');

let board = Array(9).fill(null);
let currentPlayer = 'X';
let gameActive = true;

let mode = 'ai';
let aiDifficulty = 'hard';
let soundOn = true;

let scores = { X: 0, O: 0, D: 0 };

/* ========= AUDIO ========= */
let audioEls = {};

function makeAudioElement(dataURI){
  if(!dataURI) return null;
  const a = new Audio(dataURI);
  a.preload = 'auto';
  return a;
}

function loadAudio(){
  audioEls.place = makeAudioElement(placeAudioDataURI);
  audioEls.win   = makeAudioElement(winAudioDataURI);
  audioEls.draw  = makeAudioElement(drawAudioDataURI);
}

const audioCtx = (window.AudioContext||window.webkitAudioContext)
  ? new (window.AudioContext||window.webkitAudioContext)()
  : null;

function beep(freq=440,duration=0.08,type='sine',gain=0.08){
  if(!audioCtx || !soundOn) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  o.stop(audioCtx.currentTime + duration + 0.02);
}

function playPlace(){ if(!soundOn) return; if(audioEls.place){ audioEls.place.currentTime = 0; audioEls.place.play(); } else beep(540,0.06,'square',0.06); }
function playWin(){ if(!soundOn) return; if(audioEls.win){ audioEls.win.currentTime = 0; audioEls.win.play(); } else { beep(880,0.18,'sine',0.12); setTimeout(()=>beep(1100,0.12,'sine',0.08),120); } }
function playDraw(){ if(!soundOn) return; if(audioEls.draw){ audioEls.draw.currentTime = 0; audioEls.draw.play(); } else beep(320,0.18,'sawtooth',0.08); }

/* ========= RENDER ========= */
function renderBoard(){
  cells.forEach((c,i)=>{
    const span = c.querySelector('.mark');
    const val = board[i];
    if(val){
      c.classList.remove('empty');
      c.classList.add('filled');
      span.textContent = val;
    } else {
      c.classList.add('empty');
      c.classList.remove('filled','win');
      span.textContent = '';
    }
  });
}

function updateScoreDisplay(){
  scoreXEl.textContent = scores.X;
  scoreOEl.textContent = scores.O;
  scoreDEl.textContent = scores.D;
  modeLabel.textContent = (mode==='ai' ? 'Bot - ' : 'Friends - ') +
                          (aiDifficulty==='hard' ? 'Hard' : 'Easy');
}

/* ========= WINNER BANNER ========= */
const winnerBanner = document.getElementById('winnerBanner');
const winnerText = document.getElementById('winnerText');
const closeBanner = document.getElementById('closeBanner');
const confettiRoot = document.getElementById('confettiRoot');

closeBanner.addEventListener('click', () => {
  winnerBanner.classList.remove('show');
  confettiRoot.innerHTML = '';
});

function showWinnerBanner(text){
  winnerText.textContent = text;
  winnerBanner.classList.add('show');
}

/* ========= SVG LINE ========= */
function clearWinLine(){ svgEl.innerHTML = ''; svgEl.style.opacity = 0; }

function drawWinLine(line){
  const rect = boardEl.getBoundingClientRect();
  const pts = line.map(i=>{
    const c = cells[i].getBoundingClientRect();
    return {
      x: c.left + c.width/2 - rect.left,
      y: c.top + c.height/2 - rect.top
    };
  });

  svgEl.innerHTML = '';
  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  const d = `M ${pts[0].x} ${pts[0].y} L ${pts[2].x} ${pts[2].y}`;

  path.setAttribute('stroke','rgba(10,10,10,0.85)');
  path.setAttribute('stroke-width','8');
  path.setAttribute('fill','none');
  path.setAttribute('d', d);

  svgEl.appendChild(path);

  const length = path.getTotalLength();
  path.style.strokeDasharray = length;
  path.style.strokeDashoffset = length;
  path.getBoundingClientRect();
  path.style.transition = 'stroke-dashoffset 550ms cubic-bezier(.2,.9,.3,1)';
  requestAnimationFrame(()=>{ path.style.strokeDashoffset = '0'; svgEl.style.opacity = 1; });
}

/* ========= GAME LOGIC ========= */
function checkWinner(b = board){
  for(const line of WIN_CONDITIONS){
    const [a,bx,c] = line;
    if(b[a] && b[a] === b[bx] && b[a] === b[c]){
      return { winner: b[a], line };
    }
  }
  if(b.every(Boolean)) return { winner: 'D' };
  return null;
}

/* ===== MINIMAX ===== */
function availableMoves(b){ return b.map((v,i)=>v?null:i).filter(x=>x!==null); }

function minimax(b,player,alpha,beta){
  const res = checkWinner(b);
  if(res){
    if(res.winner==='X') return {score:-10};
    if(res.winner==='O') return {score:10};
    return {score:0};
  }

  const moves = availableMoves(b);
  if(moves.length === 0) return {score:0};

  let best = null;

  if(player==='O'){
    let bestScore = -Infinity;
    for(const idx of moves){
      b[idx]='O';
      const r = minimax(b,'X',alpha,beta);
      b[idx]=null;
      if(r.score > bestScore){
        bestScore = r.score;
        best = {index: idx, score: r.score};
      }
      alpha = Math.max(alpha, bestScore);
      if(beta <= alpha) break;
    }
    return best;
  }

  else{
    let bestScore = Infinity;
    for(const idx of moves){
      b[idx]='X';
      const r = minimax(b,'O',alpha,beta);
      b[idx]=null;
      if(r.score < bestScore){
        bestScore = r.score;
        best = {index: idx, score: r.score};
        }
      beta = Math.min(beta, bestScore);
      if(beta <= alpha) break;
    }
    return best;
  }
}

/* ========= AI MOVE ========= */
function aiMakeMove(){
  if(!gameActive) return;

  if(aiDifficulty==='easy'){
    const empties = availableMoves(board);
    const r = empties[Math.floor(Math.random()*empties.length)];
    setTimeout(()=>makeMove(r),150);
    return;
  }

  const best = minimax(board.slice(),'O',-Infinity,Infinity);
  setTimeout(()=>makeMove(best.index),200);
}

/* ========= MAKE MOVE ========= */
function makeMove(i){
  if(!gameActive || board[i]) return;
  board[i] = currentPlayer;
  renderBoard();
  playPlace();

  const res = checkWinner();
  if(res){
    gameActive = false;

    if(res.winner === 'D'){
      turnIndicator.textContent = "It's a Draw!";
      playDraw();
      scores.D++;
      recordHistory("Draw");
      showWinnerBanner("It's a Draw!");
    } else {
      turnIndicator.textContent = `Player ${res.winner} Wins!`;
      res.line.forEach(x=>cells[x].classList.add('win'));
      drawWinLine(res.line);
      playWin();
      scores[res.winner]++;
      recordHistory(`Player ${res.winner} wins`);
      showWinnerBanner(`Player ${res.winner} Wins!`);
    }

    updateScoreDisplay();
    saveScores();
    return;
  }

  currentPlayer = (currentPlayer==='X' ? 'O' : 'X');
  setTurnText();

  if(mode==='ai' && currentPlayer==='O') aiMakeMove();
}

/* ========= STORAGE ========= */
function saveScores(){ localStorage.setItem('t3_scores_v2', JSON.stringify(scores)); }
function loadScores(){ const x = localStorage.getItem('t3_scores_v2'); if(x) scores = JSON.parse(x); }

function recordHistory(text){
  const now = new Date();
  const stor = JSON.parse(localStorage.getItem('t3_history_v2') || '[]');
  stor.unshift({text,time:now.toISOString()});
  localStorage.setItem('t3_history_v2', JSON.stringify(stor.slice(0,100)));
  renderHistory();
}

function renderHistory(){
  const stor = JSON.parse(localStorage.getItem('t3_history_v2') || '[]');
  historyPanel.innerHTML = '';
  if(stor.length===0){ historyPanel.innerHTML='<div class="muted">No matches played yet.</div>'; return; }
  stor.slice(0,20).forEach(item=>{
    const d=new Date(item.time);
    const el=document.createElement('div');
    el.className='history-item';
    el.innerHTML=`<div>${item.text}</div><div class="muted">${d.toLocaleString()}</div>`;
    historyPanel.appendChild(el);
  });
}

clearHistoryBtn.addEventListener('click',()=>{
  localStorage.removeItem('t3_history_v2');
  renderHistory();
});

/* ========= CONTROLS ========= */
cells.forEach(c=>{
  c.addEventListener('click',()=>{
    const i=Number(c.dataset.index);
    if(!gameActive) return;
    if(mode==='ai' && currentPlayer==='O') return;
    clearWinLine();
    makeMove(i);
  });
});

resetBtn.addEventListener('click',()=>{ resetBoard(); clearWinLine(); winnerBanner.classList.remove('show'); });
newGameBtn.addEventListener('click',()=>{ resetBoard(); clearWinLine(); winnerBanner.classList.remove('show'); });

modeToggle.addEventListener('click',()=>{
  mode = (mode==='ai' ? 'pvp' : 'ai');
  modeToggle.textContent = (mode==='ai' ? 'Mode: Bot' : 'Mode: Friends');
  if(mode==='ai' && currentPlayer==='O' && gameActive) aiMakeMove();
  updateScoreDisplay();
});

aiLevel.addEventListener('change',()=>{ aiDifficulty = aiLevel.value; updateScoreDisplay(); });

soundToggle.addEventListener('click',()=>{
  soundOn = !soundOn;
  soundToggle.textContent = soundOn ? '🔊 Sound' : '🔈 Muted';
});

themeToggle.addEventListener('change',()=>{
  const t = themeToggle.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme',t);
  themeLabel.textContent = themeToggle.checked ? '🌙' : '🌞';
  localStorage.setItem('t3_theme_v2',t);
});

resetScoreBtn.addEventListener('click',()=>{
  scores = {X:0,O:0,D:0};
  saveScores();
  updateScoreDisplay();
});

historyBtn.addEventListener('click',()=>{
  historyPanel.scrollIntoView({behavior:'smooth',block:'center'});
});

/* ========= HELPERS ========= */
function setTurnText(){
  if(!gameActive) return;
  turnIndicator.textContent = (mode==='ai' && currentPlayer==='O')
    ? "AI's turn"
    : `Player ${currentPlayer}'s turn`;
}

function resetBoard(){
  board = Array(9).fill(null);
  currentPlayer = 'X';
  gameActive = true;
  renderBoard();
  setTurnText();
  clearWinLine();
}

/* ========= BOOT ========= */
function boot(){
  loadScores();
  updateScoreDisplay();
  renderHistory();
  renderBoard();
  setTurnText();
  loadAudio();

  const theme = localStorage.getItem('t3_theme_v2');
  if(theme){
    document.documentElement.setAttribute('data-theme',theme);
    themeToggle.checked = theme==='dark';
    themeLabel.textContent = theme==='dark' ? '🌙' : '🌞';
  }
}

boot();

/* ========= KEYBOARD ========= */
document.addEventListener('keydown',e=>{
  if(!gameActive) return;
  const n = parseInt(e.key,10);
  if(n>=1 && n<=9){
    const idx = n-1;
    if(mode==='ai' && currentPlayer==='O') return;
    makeMove(idx);
  }
});
