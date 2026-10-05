/* ============================================
   CLICK UNDER PRESSURE — script.js
   Full game engine: 30 levels, 14+ challenge types
   ============================================ */
'use strict';

// Flash overlay
const flashEl = document.createElement('div');
flashEl.id = 'flash-overlay';
document.body.appendChild(flashEl);

// State
const state = {
  level: 1, score: 0, streak: 0, bestStreak: 0,
  currentChallenge: null, timerRAF: null,
  timerDuration: 5000, memory: {
    number: null, color: null, position: null, buttonText: null,
    prevCorrectColor: null, seenColors: [], seenCount: {}
  },
  activeRule: null,
  clickCount: 0, targetClicks: 0,
  sequenceOrder: [], sequenceIndex: 0,
  movingInterval: null, challengeOver: false,
  failReason: '', totalCleared: 0
};

const COLORS = ['red','blue','green','yellow','purple','orange','cyan'];
const COLOR_NAMES = { red:'RED', blue:'BLUE', green:'GREEN', yellow:'YELLOW', purple:'PURPLE', orange:'ORANGE', cyan:'CYAN' };

const rnd   = arr => arr[Math.floor(Math.random()*arr.length)];
const rndInt = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
const shuffle = arr => [...arr].sort(()=>Math.random()-0.5);

function getTimer(level) {
  if (level <= 5)  return rndInt(6000,8000);
  if (level <= 10) return rndInt(4500,6500);
  if (level <= 15) return rndInt(3500,5000);
  if (level <= 20) return rndInt(2800,4000);
  if (level <= 25) return rndInt(2000,3200);
  return rndInt(1500,2600);
}
function scoreForLevel(level) { return level*100 + (state.streak*20); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

const btnStart      = document.getElementById('btn-start');
const btnIntroReady = document.getElementById('btn-intro-ready');
const btnRetry      = document.getElementById('btn-retry');
const btnMenuGO     = document.getElementById('btn-menu-go');
const btnPlayAgain  = document.getElementById('btn-play-again');
const btnMenuVic    = document.getElementById('btn-menu-victory');
const levelDisplay  = document.getElementById('level-display');
const scoreDisplay  = document.getElementById('score-display');
const streakDisplay = document.getElementById('streak-display');
const timerBar      = document.getElementById('timer-bar');
const timerText     = document.getElementById('timer-text');
const instructionText  = document.getElementById('instruction-text');
const instructionSub   = document.getElementById('instruction-sub');
const instructionLabel = document.getElementById('instruction-label');
const buttonsArea   = document.getElementById('buttons-area');
const infoDisplay   = document.getElementById('info-display');
const ruleBanner    = document.getElementById('rule-banner');
const ruleText      = document.getElementById('rule-text');
const transitionLevel = document.getElementById('transition-level');
const transitionBar   = document.getElementById('transition-bar');

btnStart.addEventListener('click', startIntro);
btnIntroReady.addEventListener('click', startGame);
btnRetry.addEventListener('click', () => { resetGame(); startGame(); });
btnMenuGO.addEventListener('click', () => showScreen('screen-start'));
btnPlayAgain.addEventListener('click', () => { resetGame(); startGame(); });
btnMenuVic.addEventListener('click', () => showScreen('screen-start'));

function startIntro() {
  showScreen('screen-intro');
  const lines = document.querySelectorAll('.intro-line');
  let maxDelay = 0;
  lines.forEach(line => {
    const delay = parseInt(line.dataset.delay)||0;
    if (delay>maxDelay) maxDelay = delay;
    setTimeout(() => line.classList.add('visible'), delay);
  });
  setTimeout(() => { btnIntroReady.classList.add('visible'); }, maxDelay+600);
}

function resetGame() {
  clearTimer(); clearMoving();
  state.level=1; state.score=0; state.streak=0; state.bestStreak=0;
  state.totalCleared=0; state.activeRule=null; state.challengeOver=false;
  state.memory = { number:null, color:null, position:null, buttonText:null, prevCorrectColor:null, seenColors:[], seenCount:{} };
  document.querySelectorAll('.intro-line').forEach(l => l.classList.remove('visible'));
  btnIntroReady.classList.remove('visible');
}

function startGame() {
  showScreen('screen-game');
  updateHUD();
  runLevel(state.level);
}

function updateHUD() {
  levelDisplay.textContent  = state.level;
  scoreDisplay.textContent  = state.score;
  streakDisplay.textContent = state.streak;
}

function runLevel(lvl) {
  clearTimer(); clearMoving();
  state.challengeOver=false; state.clickCount=0;
  const challenge = buildChallenge(lvl);
  state.currentChallenge = challenge;

  instructionLabel.textContent = challenge.label || 'INSTRUCTION';
  instructionText.innerHTML    = challenge.instruction || '';
  instructionSub.textContent   = challenge.sub || '';
  buttonsArea.innerHTML = '';
  buttonsArea.className = 'buttons-area';
  infoDisplay.style.display = 'none';
  infoDisplay.innerHTML = '';

  if (challenge.info !== undefined) {
    infoDisplay.style.display = 'block';
    infoDisplay.innerHTML = challenge.info;
  }
  if (challenge.setup) challenge.setup();

  if (state.activeRule) {
    ruleBanner.style.display='flex';
    ruleText.textContent = 'ACTIVE RULE: ' + state.activeRule.text;
  } else {
    ruleBanner.style.display='none';
  }

  updateHUD();
  const duration = challenge.duration || getTimer(lvl);
  state.timerDuration = duration;
  startTimer(duration, () => onTimeout());
}

function startTimer(duration, onEnd) {
  clearTimer();
  const start = performance.now();
  timerBar.style.transition='none';
  timerBar.style.width='100%';
  timerBar.className='timer-bar';
  function tick(now) {
    if (state.challengeOver) return;
    const elapsed = now - start;
    const frac = Math.max(0, 1 - elapsed/duration);
    timerBar.style.width = (frac*100)+'%';
    timerText.textContent = Math.max(0,(duration-elapsed)/1000).toFixed(1);
    if (frac < 0.35) timerBar.className='timer-bar danger';
    else if (frac < 0.6) timerBar.className='timer-bar warning';
    else timerBar.className='timer-bar';
    if (elapsed >= duration) { timerBar.style.width='0'; onEnd(); }
    else { state.timerRAF = requestAnimationFrame(tick); }
  }
  state.timerRAF = requestAnimationFrame(tick);
}
function clearTimer() { if (state.timerRAF) { cancelAnimationFrame(state.timerRAF); state.timerRAF=null; } }
function clearMoving() { if (state.movingInterval) { clearInterval(state.movingInterval); state.movingInterval=null; } }

function onTimeout() {
  if (state.challengeOver) return;
  if (state.currentChallenge && state.currentChallenge.passOnTimeout) onSuccess();
  else triggerGameOver('TIME EXPIRED — TOO SLOW.');
}

function onSuccess() {
  if (state.challengeOver) return;
  state.challengeOver=true;
  clearTimer(); clearMoving();
  state.totalCleared++;
  state.score += scoreForLevel(state.level);
  state.streak++;
  if (state.streak > state.bestStreak) state.bestStreak = state.streak;
  if (state.activeRule) { state.activeRule.levelsLeft--; if (state.activeRule.levelsLeft<=0) state.activeRule=null; }
  if (state.currentChallenge && state.currentChallenge.correctColor) {
    state.memory.prevCorrectColor = state.currentChallenge.correctColor;
  }
  flash('green'); updateHUD();
  if (state.level >= 30) setTimeout(showVictory, 700);
  else { state.level++; setTimeout(showTransition, 400); }
}

function triggerGameOver(reason) {
  if (state.challengeOver) return;
  state.challengeOver=true;
  clearTimer(); clearMoving();
  state.streak=0;
  flash('red');
  state.failReason = reason || 'Wrong action.';
  setTimeout(() => {
    document.getElementById('go-level').textContent  = state.level;
    document.getElementById('go-score').textContent  = state.score;
    document.getElementById('go-streak').textContent = state.bestStreak;
    document.getElementById('go-reason').textContent = state.failReason;
    showScreen('screen-gameover');
  }, 500);
}

function showTransition() {
  showScreen('screen-transition');
  transitionLevel.textContent = 'LEVEL ' + state.level;
  transitionBar.style.width='0';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    transitionBar.style.transition='width 0.55s ease';
    transitionBar.style.width='100%';
  }));
  setTimeout(() => { showScreen('screen-game'); runLevel(state.level); }, 900);
}

function showVictory() {
  document.getElementById('v-score').textContent      = state.score;
  document.getElementById('v-streak').textContent     = state.bestStreak;
  document.getElementById('v-challenges').textContent = state.totalCleared;
  spawnParticles(); showScreen('screen-victory');
}

function spawnParticles() {
  const container = document.getElementById('victory-particles');
  container.innerHTML='';
  const colors=['#00ff88','#00e5ff','#ffe600','#ff3355'];
  for (let i=0;i<40;i++) {
    const p=document.createElement('div');
    p.className='v-particle';
    p.style.left=(Math.random()*100)+'%';
    p.style.setProperty('--dur',(2+Math.random()*4)+'s');
    p.style.setProperty('--delay',(Math.random()*3)+'s');
    p.style.background=rnd(colors);
    p.style.width=(3+Math.random()*5)+'px';
    p.style.height=p.style.width;
    container.appendChild(p);
  }
}

function flash(type) {
  flashEl.className='flash-'+type;
  setTimeout(()=>{ flashEl.className=''; }, 300);
}

function createGameButton({ label, colorClass, onClick, id, fontSize, width, disabled }) {
  const btn = document.createElement('button');
  btn.className='game-btn '+(colorClass||'btn-neutral');
  btn.textContent = label||'';
  if (id) btn.id=id;
  if (fontSize) btn.style.fontSize=fontSize;
  if (width) btn.style.minWidth=width;
  if (disabled) { btn.disabled=true; btn.style.opacity='0.4'; }
  btn.addEventListener('click',()=>{ if (state.challengeOver) return; if (onClick) onClick(btn); });
  return btn;
}

// ═══ CHALLENGE BUILDERS ═══════════════════════════════════════════

function buildChallenge(level) {
  const pool = getChallengePool(level);
  return rnd(pool)(level);
}

function getChallengePool(level) {
  if (level <= 5)  return [ch_pressColor,ch_dontPressColor,ch_doNothing,ch_pressNumber,ch_yesNo];
  if (level <= 10) return [ch_pressColor,ch_dontPressColor,ch_doNothing,ch_pressNumber,ch_yesNo,ch_multiClick,ch_sequence,ch_countButtons,ch_pressBiggest,ch_pressSmallest];
  if (level <= 15) return [ch_pressNumber,ch_memoryNumber,ch_recallNumber,ch_mathAnswer,ch_multiClick,ch_sequence,ch_oddEven,ch_visualTrick,ch_pressPosition,ch_firstLastDigits];
  if (level <= 20) return [ch_mathAnswer,ch_reverseInstruction,ch_changedRule,ch_prevColorRule,ch_visualTrick,ch_memoryNumber,ch_recallNumber,ch_movingTarget,ch_combineMemMath,ch_fakeSafe];
  if (level <= 25) return [ch_movingTarget,ch_fakeSafe,ch_combineMemMath,ch_reverseSequence,ch_changedRule,ch_mathAnswer,ch_multiClick,ch_reverseInstruction,ch_prevColorRule,ch_firstLastDigits];
  return [ch_pressColor,ch_dontPressColor,ch_doNothing,ch_pressNumber,ch_yesNo,ch_multiClick,ch_sequence,ch_reverseInstruction,ch_visualTrick,ch_pressBiggest,ch_pressSmallest,ch_oddEven,ch_countButtons,ch_movingTarget,ch_changedRule,ch_prevColorRule,ch_pressPosition,ch_combineMemMath,ch_fakeSafe,ch_reverseSequence,ch_firstLastDigits,ch_memoryNumber,ch_recallNumber,ch_mathAnswer];
}

// 1. PRESS COLOR
function ch_pressColor(level) {
  const target = rnd(COLORS);
  const others = shuffle(COLORS.filter(c=>c!==target)).slice(0,rndInt(1,3));
  const cols   = shuffle([target,...others]);
  return {
    label:'ACTION', instruction:'PRESS '+COLOR_NAMES[target], correctColor:target,
    setup() {
      cols.forEach(c => {
        buttonsArea.appendChild(createGameButton({ label:COLOR_NAMES[c], colorClass:'btn-'+c,
          onClick:()=>{ if(c===target) onSuccess(); else triggerGameOver('You pressed '+COLOR_NAMES[c]+' but should have pressed '+COLOR_NAMES[target]+'.'); }
        }));
      });
    }
  };
}

// 2. DON'T PRESS COLOR
function ch_dontPressColor(level) {
  const forbidden = rnd(COLORS);
  const others = shuffle(COLORS.filter(c=>c!==forbidden)).slice(0,rndInt(1,3));
  const cols   = shuffle([forbidden,...others]);
  return {
    label:'WARNING', instruction:'DO NOT PRESS '+COLOR_NAMES[forbidden],
    sub:'Press any other button.', correctColor:rnd(others)||null,
    setup() {
      cols.forEach(c => {
        buttonsArea.appendChild(createGameButton({ label:COLOR_NAMES[c], colorClass:'btn-'+c,
          onClick:()=>{ if(c===forbidden) triggerGameOver('You pressed '+COLOR_NAMES[forbidden]+' which was FORBIDDEN.'); else onSuccess(); }
        }));
      });
    }
  };
}

// 3. DO NOTHING
function ch_doNothing(level) {
  const decoys = shuffle(COLORS).slice(0,rndInt(1,3));
  return {
    label:'RESTRAINT', instruction:"DON'T PRESS ANYTHING",
    sub:'Wait for the timer to expire. Any click = failure.',
    duration:getTimer(level), passOnTimeout:true,
    setup() {
      decoys.forEach(c => {
        buttonsArea.appendChild(createGameButton({ label:COLOR_NAMES[c], colorClass:'btn-'+c,
          onClick:()=>triggerGameOver('You pressed a button. The instruction was to do NOTHING.')
        }));
      });
    }
  };
}

// 4. PRESS NUMBER
function ch_pressNumber(level) {
  const target = rndInt(1,20);
  const pool = new Set([target]);
  while(pool.size<4) pool.add(rndInt(1,25));
  const nums = shuffle([...pool]);
  return {
    label:'ACTION', instruction:'PRESS '+target,
    setup() {
      nums.forEach(n => {
        buttonsArea.appendChild(createGameButton({ label:String(n), colorClass:'btn-neutral',
          onClick:()=>{ if(n===target) onSuccess(); else triggerGameOver('Correct was '+target+'. You pressed '+n+'.'); }
        }));
      });
    }
  };
}

// 5. MATH ANSWER
function ch_mathAnswer(level) {
  let expr, answer;
  if (level<=15) {
    const a=rndInt(2,12), b=rndInt(2,12);
    const op=rnd(['+','-','x']);
    if(op==='+'){answer=a+b;expr=a+' + '+b;}
    else if(op==='-'){answer=Math.abs(a-b);expr=Math.max(a,b)+' - '+Math.min(a,b);}
    else{answer=a*b;expr=a+' x '+b;}
  } else {
    const a=rndInt(1,10),b=rndInt(2,8),c=rndInt(2,6);
    answer=a+b*c; expr=a+' + '+b+' x '+c;
  }
  const wrong=new Set([answer]);
  while(wrong.size<4) wrong.add(Math.abs(answer+rndInt(-8,8)));
  const all=shuffle([...wrong]).filter(n=>n>=0).slice(0,3);
  all.push(answer);
  const options=shuffle([...new Set(all)]).slice(0,4);
  if(!options.includes(answer)) options[0]=answer;
  return {
    label:'MATHEMATICS', instruction:'CALCULATE AND PRESS THE ANSWER',
    info:'<span style="font-size:2rem;color:var(--accent);font-family:var(--font-mono)">'+expr+'</span>',
    setup() {
      shuffle(options).forEach(n => {
        buttonsArea.appendChild(createGameButton({ label:String(n), colorClass:'btn-neutral',
          onClick:()=>{ if(n===answer) onSuccess(); else triggerGameOver(expr+' = '+answer+'. You pressed '+n+'.'); }
        }));
      });
    }
  };
}

// 6. YES/NO
function ch_yesNo(level) {
  const a=rndInt(1,20),b=rndInt(1,20);
  const qs=[
    {text:'IS '+a+' GREATER THAN '+b+'?', answer:a>b},
    {text:'IS '+a+' LESS THAN '+b+'?',    answer:a<b},
    {text:'IS '+a+' EVEN?',               answer:a%2===0},
    {text:'IS '+a+' ODD?',                answer:a%2!==0},
    {text:'IS '+a*b+' DIVISIBLE BY '+b+'?', answer:true}
  ];
  const q=rnd(qs);
  let yesColor='green', noColor='red', ruleNote='';
  if (state.activeRule) {
    yesColor=state.activeRule.trueColor;
    noColor=COLORS.find(c=>c!==yesColor)||'red';
    ruleNote='(Rule: '+COLOR_NAMES[yesColor]+' = YES)';
  }
  const correctColor = q.answer ? yesColor : noColor;
  return {
    label:'LOGIC', instruction:q.text, sub:ruleNote, correctColor,
    setup() {
      buttonsArea.appendChild(createGameButton({ label:'YES', colorClass:'btn-'+yesColor,
        onClick:()=>{ if(q.answer) onSuccess(); else triggerGameOver('Answer was NO.'); }
      }));
      buttonsArea.appendChild(createGameButton({ label:'NO', colorClass:'btn-'+noColor,
        onClick:()=>{ if(!q.answer) onSuccess(); else triggerGameOver('Answer was YES.'); }
      }));
    }
  };
}

// 7. MEMORY NUMBER (store)
function ch_memoryNumber(level) {
  const num=rndInt(1000,9999);
  state.memory.number=num;
  return {
    label:'MEMORY', instruction:'REMEMBER THIS NUMBER',
    sub:'It will be needed later.',
    info:'<span style="font-size:3.5rem;color:var(--accent3);font-family:var(--font-mono);letter-spacing:0.2em">'+num+'</span>',
    duration:getTimer(level)+1500, passOnTimeout:true,
    setup(){}
  };
}

// 8. RECALL NUMBER
function ch_recallNumber(level) {
  const stored=state.memory.number;
  if(!stored) return ch_pressNumber(level);
  const wrong=new Set([stored]);
  while(wrong.size<4) wrong.add(stored+rndInt(-500,500));
  const all=shuffle([stored,...[...wrong].filter(n=>n!==stored).slice(0,3)]);
  return {
    label:'RECALL', instruction:'PRESS THE NUMBER YOU REMEMBERED',
    setup() {
      all.forEach(n => {
        buttonsArea.appendChild(createGameButton({ label:String(n), colorClass:'btn-neutral',
          onClick:()=>{ if(n===stored) onSuccess(); else triggerGameOver('The number was '+stored+'. You pressed '+n+'.'); }
        }));
      });
    }
  };
}

// 9. ODD/EVEN from memory
function ch_oddEven(level) {
  let num=state.memory.number;
  if(!num){num=rndInt(10,9999);state.memory.number=num;}
  const isEven=num%2===0;
  return {
    label:'RECALL', instruction:'IS THE NUMBER YOU REMEMBERED EVEN?',
    sub:'(Your number: '+num+')',
    setup() {
      buttonsArea.appendChild(createGameButton({ label:'YES', colorClass:'btn-green',
        onClick:()=>{ if(isEven) onSuccess(); else triggerGameOver(num+' is ODD, not even.'); }
      }));
      buttonsArea.appendChild(createGameButton({ label:'NO', colorClass:'btn-red',
        onClick:()=>{ if(!isEven) onSuccess(); else triggerGameOver(num+' is EVEN, not odd.'); }
      }));
    }
  };
}

// 10. MULTI-CLICK
function ch_multiClick(level) {
  const target=rnd(COLORS);
  const times=rndInt(2,Math.min(5+Math.floor(level/5),8));
  state.clickCount=0; state.targetClicks=times;
  const decoy=rnd(COLORS.filter(c=>c!==target));
  return {
    label:'MULTI-CLICK', instruction:'PRESS '+COLOR_NAMES[target]+' EXACTLY '+times+' TIMES', correctColor:target,
    setup() {
      const indicator=document.createElement('div');
      indicator.className='click-progress'; indicator.id='click-progress';
      for(let i=0;i<times;i++){const dot=document.createElement('span');dot.className='click-dot';indicator.appendChild(dot);}
      buttonsArea.appendChild(indicator);
      buttonsArea.appendChild(createGameButton({ label:COLOR_NAMES[target], colorClass:'btn-'+target,
        onClick:()=>{
          state.clickCount++;
          const dots=document.querySelectorAll('.click-dot');
          if(dots[state.clickCount-1]) dots[state.clickCount-1].classList.add('filled');
          if(state.clickCount===times) onSuccess();
          else if(state.clickCount>times) triggerGameOver('Too many clicks. Required: '+times+'.');
        }
      }));
      buttonsArea.appendChild(createGameButton({ label:COLOR_NAMES[decoy], colorClass:'btn-'+decoy,
        onClick:()=>triggerGameOver('You pressed '+COLOR_NAMES[decoy]+'. Required: '+COLOR_NAMES[target]+'.')
      }));
    }
  };
}

// 11. SEQUENCE
function ch_sequence(level) {
  const len=Math.min(3+Math.floor(level/4),6);
  const seq=[]; for(let i=0;i<len;i++) seq.push(rnd(COLORS));
  state.sequenceOrder=[...seq]; state.sequenceIndex=0;
  const display=seq.map(c=>'<span style="color:var(--text)">'+COLOR_NAMES[c]+'</span>').join('<span style="color:var(--muted)"> -> </span>');
  const uniq=[...new Set(seq)];
  return {
    label:'SEQUENCE', instruction:'PRESS IN ORDER', info:display,
    setup() {
      const dots=document.createElement('div'); dots.className='sequence-indicator';
      seq.forEach((_,i)=>{const d=document.createElement('div');d.className='seq-dot'+(i===0?' active':'');d.id='sdot-'+i;dots.appendChild(d);});
      buttonsArea.appendChild(dots);
      uniq.forEach(c=>{
        buttonsArea.appendChild(createGameButton({ label:COLOR_NAMES[c], colorClass:'btn-'+c,
          onClick:()=>{
            const expected=state.sequenceOrder[state.sequenceIndex];
            if(c===expected){
              const d=document.getElementById('sdot-'+state.sequenceIndex);
              if(d){d.classList.remove('active');d.classList.add('done');}
              state.sequenceIndex++;
              const nd=document.getElementById('sdot-'+state.sequenceIndex);
              if(nd) nd.classList.add('active');
              if(state.sequenceIndex>=state.sequenceOrder.length) onSuccess();
            } else triggerGameOver('Wrong order. Expected '+COLOR_NAMES[expected]+', pressed '+COLOR_NAMES[c]+'.');
          }
        }));
      });
    }
  };
}

// 12. REVERSE SEQUENCE
function ch_reverseSequence(level) {
  const len=Math.min(3+Math.floor(level/5),5);
  const seq=[]; for(let i=0;i<len;i++) seq.push(rnd(COLORS));
  const rev=[...seq].reverse();
  state.sequenceOrder=rev; state.sequenceIndex=0;
  const fwdDisplay=seq.map(c=>'<span style="color:var(--text)">'+COLOR_NAMES[c]+'</span>').join('<span style="color:var(--muted)"> -> </span>');
  const uniq=[...new Set(seq)];
  return {
    label:'SEQUENCE', instruction:'PRESS IN REVERSE ORDER', info:fwdDisplay,
    setup() {
      const dots=document.createElement('div'); dots.className='sequence-indicator';
      rev.forEach((_,i)=>{const d=document.createElement('div');d.className='seq-dot'+(i===0?' active':'');d.id='sdot-'+i;dots.appendChild(d);});
      buttonsArea.appendChild(dots);
      uniq.forEach(c=>{
        buttonsArea.appendChild(createGameButton({ label:COLOR_NAMES[c], colorClass:'btn-'+c,
          onClick:()=>{
            const expected=rev[state.sequenceIndex];
            if(c===expected){
              const d=document.getElementById('sdot-'+state.sequenceIndex);
              if(d){d.classList.remove('active');d.classList.add('done');}
              state.sequenceIndex++;
              const nd=document.getElementById('sdot-'+state.sequenceIndex);
              if(nd) nd.classList.add('active');
              if(state.sequenceIndex>=rev.length) onSuccess();
            } else triggerGameOver('Wrong order. Expected '+COLOR_NAMES[expected]+', pressed '+COLOR_NAMES[c]+'.');
          }
        }));
      });
    }
  };
}

// 13. REVERSE INSTRUCTION
function ch_reverseInstruction(level) {
  const target=rnd(COLORS);
  const others=shuffle(COLORS.filter(c=>c!==target)).slice(0,rndInt(1,3));
  const all=shuffle([target,...others]);
  return {
    label:'PARADOX', instruction:'DO NOT PRESS THE CORRECT ANSWER',
    sub:'The correct button for PRESS '+COLOR_NAMES[target]+' is among these. Avoid it.',
    setup() {
      all.forEach(c=>{
        buttonsArea.appendChild(createGameButton({ label:COLOR_NAMES[c], colorClass:'btn-'+c,
          onClick:()=>{ if(c===target) triggerGameOver('You pressed '+COLOR_NAMES[target]+' - that was the one to AVOID.'); else onSuccess(); }
        }));
      });
    }
  };
}

// 14. VISUAL TRICK
function ch_visualTrick(level) {
  const textColor=rnd(COLORS);
  const visualColor=rnd(COLORS.filter(c=>c!==textColor));
  const askText=Math.random()>0.5;
  const instruction=askText
    ? 'PRESS THE BUTTON LABELED "'+COLOR_NAMES[textColor]+'" (BY TEXT)'
    : 'PRESS THE BUTTON WHOSE VISUAL COLOR IS '+COLOR_NAMES[visualColor];
  const decoy1=rnd(COLORS.filter(c=>c!==visualColor&&c!==textColor));
  return {
    label:'OBSERVATION', instruction, sub:'(Text label and visual color may differ)',
    setup() {
      buttonsArea.appendChild(createGameButton({ label:COLOR_NAMES[textColor], colorClass:'btn-'+visualColor,
        onClick:()=>onSuccess()
      }));
      buttonsArea.appendChild(createGameButton({ label:COLOR_NAMES[decoy1], colorClass:'btn-'+decoy1,
        onClick:()=>triggerGameOver('That was a decoy. Check label vs. visual color.')
      }));
    }
  };
}

// 15. PRESS BIGGEST
function ch_pressBiggest(level) {
  const pool=new Set(); while(pool.size<4) pool.add(rndInt(1,99));
  const nums=shuffle([...pool]); const biggest=Math.max(...nums);
  return {
    label:'LOGIC', instruction:'PRESS THE BIGGEST NUMBER',
    setup() {
      nums.forEach(n=>{
        buttonsArea.appendChild(createGameButton({ label:String(n), colorClass:'btn-neutral',
          onClick:()=>{ if(n===biggest) onSuccess(); else triggerGameOver('Biggest was '+biggest+'. You pressed '+n+'.'); }
        }));
      });
    }
  };
}

// 16. PRESS SMALLEST
function ch_pressSmallest(level) {
  const pool=new Set(); while(pool.size<4) pool.add(rndInt(1,99));
  const nums=shuffle([...pool]); const smallest=Math.min(...nums);
  return {
    label:'LOGIC', instruction:'PRESS THE SMALLEST NUMBER',
    setup() {
      nums.forEach(n=>{
        buttonsArea.appendChild(createGameButton({ label:String(n), colorClass:'btn-neutral',
          onClick:()=>{ if(n===smallest) onSuccess(); else triggerGameOver('Smallest was '+smallest+'. You pressed '+n+'.'); }
        }));
      });
    }
  };
}

// 17. COUNT BUTTONS
function ch_countButtons(level) {
  const target=rnd(COLORS); const count=rndInt(2,4); const decoys=rndInt(1,3);
  const allBtns=[];
  for(let i=0;i<count;i++) allBtns.push(target);
  for(let i=0;i<decoys;i++) allBtns.push(rnd(COLORS.filter(c=>c!==target)));
  const shuffled=shuffle(allBtns);
  const wrong=new Set([count]); while(wrong.size<4) wrong.add(count+rndInt(-2,4));
  const options=shuffle([count,...[...wrong].filter(n=>n!==count&&n>0).slice(0,3)]);
  return {
    label:'COUNTING', instruction:'COUNT THE '+COLOR_NAMES[target]+' BUTTONS, THEN PRESS THAT NUMBER',
    setup() {
      const display=document.createElement('div');
      display.style.cssText='display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;margin-bottom:1rem;';
      shuffled.forEach(c=>{
        const b=document.createElement('div');
        b.className='game-btn btn-'+c;
        b.style.cssText='pointer-events:none;opacity:0.9;cursor:default;padding:0.5em 1em;';
        b.textContent='■'; display.appendChild(b);
      });
      buttonsArea.appendChild(display);
      options.forEach(n=>{
        buttonsArea.appendChild(createGameButton({ label:String(n), colorClass:'btn-neutral',
          onClick:()=>{ if(n===count) onSuccess(); else triggerGameOver('There were '+count+' '+COLOR_NAMES[target]+' buttons. You pressed '+n+'.'); }
        }));
      });
    }
  };
}

// 18. MOVING TARGET
function ch_movingTarget(level) {
  const target=rnd(COLORS);
  const decoyCount=rndInt(1,Math.min(3,Math.floor(level/7)));
  const decoyColors=shuffle(COLORS.filter(c=>c!==target)).slice(0,decoyCount);
  const speed=Math.max(250,900-level*22);
  return {
    label:'REACTION', instruction:'PRESS THE '+COLOR_NAMES[target]+' BUTTON',
    sub:'(Moving target)',
    setup() {
      buttonsArea.style.position='relative';
      buttonsArea.style.height='260px';
      buttonsArea.className='buttons-area moving-arena';

      function place(btn) {
        const maxX=Math.max(50,(buttonsArea.offsetWidth||350)-130);
        const maxY=Math.max(20,(buttonsArea.offsetHeight||240)-70);
        btn.style.left=rndInt(0,maxX)+'px';
        btn.style.top=rndInt(0,maxY)+'px';
      }

      const tBtn=createGameButton({ label:COLOR_NAMES[target], colorClass:'btn-'+target, onClick:()=>onSuccess() });
      tBtn.style.position='absolute'; tBtn.style.transition='left 0.2s,top 0.2s';
      buttonsArea.appendChild(tBtn); place(tBtn);

      const dBtns=decoyColors.map(c=>{
        const d=createGameButton({ label:COLOR_NAMES[c], colorClass:'btn-'+c, onClick:()=>triggerGameOver('You pressed '+COLOR_NAMES[c]+', not '+COLOR_NAMES[target]+'.') });
        d.style.position='absolute'; d.style.transition='left 0.2s,top 0.2s';
        buttonsArea.appendChild(d); place(d); return d;
      });

      state.movingInterval=setInterval(()=>{
        if(!state.challengeOver){ place(tBtn); dBtns.forEach(d=>place(d)); }
      },speed);
    }
  };
}

// 19. CHANGED RULE
function ch_changedRule(level) {
  const trueColor=rnd(COLORS); const remaining=rndInt(2,4);
  state.activeRule={text:COLOR_NAMES[trueColor]+' MEANS YES', trueColor, levelsLeft:remaining};
  return {
    label:'NEW RULE', instruction:'FOR THE NEXT '+remaining+' LEVELS:',
    info:'<span style="font-family:var(--font-mono);font-size:1.4rem;color:var(--accent3)">'+COLOR_NAMES[trueColor]+' MEANS YES</span>',
    sub:'This changes how YES/NO questions are answered.',
    duration:5000, passOnTimeout:true,
    setup(){}
  };
}

// 20. PREV CORRECT COLOR
function ch_prevColorRule(level) {
  const prev=state.memory.prevCorrectColor;
  if(!prev) return ch_pressColor(level);
  const others=shuffle(COLORS.filter(c=>c!==prev)).slice(0,rndInt(1,3));
  const all=shuffle([prev,...others]);
  return {
    label:'MEMORY', instruction:'PRESS THE BUTTON YOU CORRECTLY PRESSED LAST ROUND',
    setup() {
      all.forEach(c=>{
        buttonsArea.appendChild(createGameButton({ label:COLOR_NAMES[c], colorClass:'btn-'+c,
          onClick:()=>{ if(c===prev) onSuccess(); else triggerGameOver('Previous correct was '+COLOR_NAMES[prev]+'. You pressed '+COLOR_NAMES[c]+'.'); }
        }));
      });
    }
  };
}

// 21. PRESS POSITION
function ch_pressPosition(level) {
  const positions=['LEFT','MIDDLE','RIGHT'];
  const cols=shuffle(COLORS).slice(0,3);
  const target_pos=rnd(positions); const pos_idx=positions.indexOf(target_pos);
  return {
    label:'POSITION', instruction:'PRESS THE '+target_pos+' BUTTON',
    setup() {
      cols.forEach((c,i)=>{
        buttonsArea.appendChild(createGameButton({ label:positions[i], colorClass:'btn-'+c,
          onClick:()=>{ if(i===pos_idx) onSuccess(); else triggerGameOver('You pressed '+positions[i]+'. Required: '+target_pos+'.'); }
        }));
      });
    }
  };
}

// 22. COMBINE MEM + MATH
function ch_combineMemMath(level) {
  let base=state.memory.number?(state.memory.number%10):rndInt(2,9);
  if(base===0) base=rndInt(2,9);
  const mul=rndInt(2,5); const add=rndInt(1,8);
  const answer=base*mul+add;
  const wrong=new Set([answer]);
  while(wrong.size<4) wrong.add(Math.abs(answer+rndInt(-10,10)));
  const all=shuffle([answer,...[...wrong].filter(n=>n!==answer&&n>0).slice(0,3)]);
  return {
    label:'COMBINED', instruction:'CALCULATE: '+base+' x '+mul+' + '+add,
    sub:'(Using last digit of your remembered number: '+base+')',
    setup() {
      all.forEach(n=>{
        buttonsArea.appendChild(createGameButton({ label:String(n), colorClass:'btn-neutral',
          onClick:()=>{ if(n===answer) onSuccess(); else triggerGameOver(base+' x '+mul+' + '+add+' = '+answer+'. You pressed '+n+'.'); }
        }));
      });
    }
  };
}

// 23. FAKE SAFE
function ch_fakeSafe(level) {
  const nBtns=rndInt(4,6); const safeIdx=rndInt(0,nBtns-1);
  const cols=shuffle(COLORS).slice(0,nBtns);
  const labels=['PRESS','CLICK','OK','GO','DO IT','YES'];
  const shuffled=shuffle(labels);
  return {
    label:'IDENTIFICATION', instruction:'PRESS THE ONLY SAFE BUTTON',
    sub:'One is labeled SAFE. All others are traps.',
    setup() {
      cols.forEach((c,i)=>{
        const isSafe=(i===safeIdx);
        const lbl=isSafe?'SAFE':(shuffled[i]||'DANGER');
        buttonsArea.appendChild(createGameButton({ label:lbl, colorClass:'btn-'+c,
          onClick:()=>{ if(isSafe) onSuccess(); else triggerGameOver('That was a trap. Only SAFE was correct.'); }
        }));
      });
    }
  };
}

// 24. FIRST + LAST DIGITS
function ch_firstLastDigits(level) {
  const num=state.memory.number||rndInt(1000,9999);
  state.memory.number=num;
  const s=String(num); const first=parseInt(s[0]); const last=parseInt(s[s.length-1]);
  const answer=first+last;
  const wrong=new Set([answer]);
  while(wrong.size<4) wrong.add(Math.abs(answer+rndInt(-5,5)));
  const all=shuffle([answer,...[...wrong].filter(n=>n!==answer&&n>=0).slice(0,3)]);
  return {
    label:'CALCULATION', instruction:'ADD THE FIRST AND LAST DIGITS OF '+num,
    sub:'First: '+first+' — Last: '+last,
    setup() {
      all.forEach(n=>{
        buttonsArea.appendChild(createGameButton({ label:String(n), colorClass:'btn-neutral',
          onClick:()=>{ if(n===answer) onSuccess(); else triggerGameOver(first+' + '+last+' = '+answer+'. You pressed '+n+'.'); }
        }));
      });
    }
  };
}

// Global click interceptor for do-nothing levels
document.getElementById('screen-game').addEventListener('click', (e)=>{
  if(state.challengeOver) return;
  const ch=state.currentChallenge;
  if(!ch||!ch.passOnTimeout) return;
  // Only fail if the challenge has actual buttons visible AND click is on non-btn area
  const btns=buttonsArea.querySelectorAll('.game-btn');
  if(btns.length>0 && !e.target.closest('.game-btn') && !e.target.closest('.hud') && !e.target.closest('.timer-bar-container')) {
    triggerGameOver('You clicked outside. The instruction was: do nothing.');
  }
}, true);

// Boot
showScreen('screen-start');
