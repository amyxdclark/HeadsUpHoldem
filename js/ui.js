'use strict';

const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLORS  = { s: 'black', h: 'red', d: 'red', c: 'black' };

let game = null;
let selectedChip = 5;
let anteAmount = 5;
let tripsAmount = 0;
let adviceVisible = false;

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  game = new HeadsUpGame();
  setupChipButtons();
  setupActionButtons();
  setupModals();
  updateBetDisplays();
  updateStackDisplay();
  showPhase('betting');
});

// ─── Chip / Bet Setup ─────────────────────────────────────────────────────────

function setupChipButtons() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selectedChip = parseInt(chip.dataset.value, 10);
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });

  document.getElementById('btn-ante-add').addEventListener('click', () => {
    anteAmount += selectedChip;
    updateBetDisplays();
  });
  document.getElementById('btn-ante-sub').addEventListener('click', () => {
    anteAmount = Math.max(1, anteAmount - selectedChip);
    updateBetDisplays();
  });
  document.getElementById('btn-trips-add').addEventListener('click', () => {
    tripsAmount += selectedChip;
    updateBetDisplays();
  });
  document.getElementById('btn-trips-sub').addEventListener('click', () => {
    tripsAmount = Math.max(0, tripsAmount - selectedChip);
    updateBetDisplays();
  });
}

function updateBetDisplays() {
  document.getElementById('ante-display').textContent = '$' + anteAmount;
  document.getElementById('blind-display').textContent = '$' + anteAmount;
  document.getElementById('trips-display').textContent = tripsAmount > 0 ? '$' + tripsAmount : '-';
  document.getElementById('total-display').textContent = '$' + (anteAmount * 2 + tripsAmount);
}

// ─── Action Buttons ───────────────────────────────────────────────────────────

function setupActionButtons() {
  document.getElementById('btn-deal').addEventListener('click', handleDeal);
  document.getElementById('btn-bet4').addEventListener('click', () => handleBet(4));
  document.getElementById('btn-bet3').addEventListener('click', () => handleBet(3));
  document.getElementById('btn-bet2').addEventListener('click', () => handleBet(2));
  document.getElementById('btn-bet1').addEventListener('click', () => handleBet(1));
  document.getElementById('btn-check').addEventListener('click', handleCheck);
  document.getElementById('btn-check-flop').addEventListener('click', handleCheck);
  document.getElementById('btn-fold').addEventListener('click', handleFold);
  document.getElementById('btn-newgame').addEventListener('click', handleNewGame);
  document.getElementById('btn-advice').addEventListener('click', toggleAdvice);
}

function handleDeal() {
  const cost = anteAmount * 2 + tripsAmount;
  if (cost > game.playerStack) {
    showMessage('Insufficient funds!', 'lose'); return;
  }
  if (anteAmount < 1) {
    showMessage('Minimum ante is $1', 'lose'); return;
  }
  try {
    game.placeBets(anteAmount, tripsAmount);
    game.deal();
    renderGameState();
    showPhase('preflop');
    updateStackDisplay();
    updateBetDisplays();
    updateAdvice();
  } catch (e) {
    showMessage(e.message, 'lose');
  }
}

function handleBet(multiplier) {
  try {
    game.playerBet(multiplier);
    advanceGame();
  } catch (e) {
    showMessage(e.message, 'lose');
  }
}

function handleCheck() {
  game.playerCheck();
  advanceGame();
}

function handleFold() {
  const result = game.playerFold();
  renderShowdown(result);
  showPhase('done');
  updateStackDisplay();
}

function advanceGame() {
  updateStackDisplay();
  if (game.betStage === 'preflop') {
    if (game.hasActed) {
      game.dealFlop();
      renderCommunityCards();
      if (game.playBet > 0) {
        // Already bet preflop, deal straight to river
        game.dealTurnRiver();
        renderCommunityCards();
        const result = game.showdown();
        renderShowdown(result);
        showPhase('done');
        updateStackDisplay();
      } else {
        showPhase('flop');
        updateAdvice();
      }
    }
  } else if (game.betStage === 'flop') {
    game.dealTurnRiver();
    renderCommunityCards();
    if (game.playBet > 0) {
      const result = game.showdown();
      renderShowdown(result);
      showPhase('done');
      updateStackDisplay();
    } else {
      showPhase('river');
      updateAdvice();
    }
  } else if (game.betStage === 'river') {
    const result = game.showdown();
    renderShowdown(result);
    showPhase('done');
    updateStackDisplay();
  }
}

function handleNewGame() {
  game.newGame();
  clearCards();
  clearBetCircles();
  hideResult();
  hideMessage();
  anteAmount = 5;
  tripsAmount = 0;
  updateBetDisplays();
  updateStackDisplay();
  showPhase('betting');
  if (adviceVisible) hideAdvicePanel();
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderGameState() {
  clearCards();
  renderPlayerCards();
  renderDealerCardBacks();
  clearBetCircles();
  renderBetCircles();
}

function renderPlayerCards() {
  const area = document.getElementById('player-cards');
  area.innerHTML = '';
  game.playerCards.forEach((card, i) => {
    const el = createCardElement(card, false, i * 80);
    area.appendChild(el);
  });
  updateHandStrength();
}

function renderDealerCardBacks() {
  const area = document.getElementById('dealer-cards');
  area.innerHTML = '';
  for (let i = 0; i < 2; i++) {
    const el = createCardBack(i * 80);
    area.appendChild(el);
  }
}

function renderCommunityCards() {
  const slots = document.querySelectorAll('.community-slot');
  game.communityCards.forEach((card, i) => {
    if (slots[i]) {
      slots[i].innerHTML = '';
      const el = createCardElement(card, false, i * 60);
      slots[i].appendChild(el);
    }
  });
  updateHandStrength();
}

function renderBetCircles() {
  document.querySelector('#circle-ante .circle-amount').textContent = '$' + game.ante;
  document.querySelector('#circle-blind .circle-amount').textContent = '$' + game.blind;
  document.querySelector('#circle-trips .circle-amount').textContent = game.tripsBet > 0 ? '$' + game.tripsBet : '';
  document.querySelector('#circle-play .circle-amount').textContent = '';
}

function updatePlayCircle() {
  document.querySelector('#circle-play .circle-amount').textContent = game.playBet > 0 ? '$' + game.playBet : '';
}

function clearBetCircles() {
  ['circle-ante', 'circle-blind', 'circle-trips', 'circle-play'].forEach(id => {
    document.querySelector('#' + id + ' .circle-amount').textContent = '';
  });
}

function renderShowdown(result) {
  // Reveal dealer cards
  const area = document.getElementById('dealer-cards');
  area.innerHTML = '';
  if (result.folded) {
    for (let i = 0; i < 2; i++) area.appendChild(createCardBack(i * 80));
  } else {
    game.dealerCards.forEach((card, i) => {
      const el = createCardElement(card, false, i * 80);
      area.appendChild(el);
    });
  }

  updatePlayCircle();

  // Show result overlay
  const overlay = document.getElementById('result-overlay');
  overlay.className = 'result-overlay';
  overlay.classList.add(result.winner === 'player' ? 'win' : result.winner === 'tie' ? 'tie' : 'lose');

  const msgEl = document.getElementById('result-message');
  msgEl.textContent = result.message;

  const payEl = document.getElementById('result-payouts');
  if (!result.folded) {
    const lines = [];
    const { payouts } = result;
    if (payouts.ante > 0) lines.push(`Ante: +$${payouts.ante}`);
    else if (payouts.ante < 0) lines.push(`Ante: -$${Math.abs(payouts.ante)}`);
    else lines.push('Ante: Push');

    if (payouts.blind > 0) lines.push(`Blind: +$${payouts.blind}`);
    else if (payouts.blind < 0) lines.push(`Blind: -$${Math.abs(payouts.blind)}`);
    else lines.push('Blind: Push');

    if (game.tripsBet > 0) {
      if (payouts.trips > 0) lines.push(`Trips+: +$${payouts.trips}`);
      else lines.push(`Trips+: -$${game.tripsBet}`);
    }

    if (game.playBet > 0) {
      if (payouts.play > 0) lines.push(`Play: +$${payouts.play}`);
      else if (payouts.play < 0) lines.push(`Play: -$${Math.abs(payouts.play)}`);
      else lines.push('Play: Push');
    }

    payEl.textContent = lines.join(' | ');

    // Hand names
    document.getElementById('dealer-hand-name').textContent =
      result.dealerHand ? result.dealerHand.name : '';
    document.getElementById('player-hand-name').textContent =
      result.playerHand ? result.playerHand.name : '';
  } else {
    payEl.textContent = 'Lost Ante + Blind';
    document.getElementById('dealer-hand-name').textContent = '';
    document.getElementById('player-hand-name').textContent = '';
  }

  overlay.classList.remove('hidden');
}

function updateHandStrength() {
  const allCards = [...game.playerCards, ...game.communityCards];
  const nameEl = document.getElementById('player-hand-name');
  if (allCards.length >= 5) {
    const ev = evaluateBest5ForUI(allCards);
    nameEl.textContent = ev ? ev.name : '';
  } else if (allCards.length === 2) {
    // Show hole card info
    nameEl.textContent = '';
  } else {
    nameEl.textContent = '';
  }
}

function evaluateBest5ForUI(cards) {
  // Use game's evaluator
  if (game && game.evaluateBest5) return game.evaluateBest5(cards);
  return null;
}

function clearCards() {
  document.getElementById('player-cards').innerHTML = '';
  document.getElementById('dealer-cards').innerHTML = '';
  document.querySelectorAll('.community-slot').forEach(s => s.innerHTML = '');
  document.getElementById('dealer-hand-name').textContent = '';
  document.getElementById('player-hand-name').textContent = '';
}

function hideResult() {
  const overlay = document.getElementById('result-overlay');
  overlay.classList.add('hidden');
}

// ─── Card Creation ────────────────────────────────────────────────────────────

function createCardElement(card, faceDown, delay) {
  const el = document.createElement('div');
  el.className = 'card ' + SUIT_COLORS[card.suit];
  el.style.animationDelay = (delay || 0) + 'ms';
  el.classList.add('deal-anim');

  const rankDisplay = card.rank === 'T' ? '10' : card.rank;
  const suitSym = SUIT_SYMBOLS[card.suit];

  el.innerHTML = `
    <div class="card-corner top-left"><span class="card-rank">${rankDisplay}</span><span class="card-suit">${suitSym}</span></div>
    <div class="card-center">${suitSym}</div>
    <div class="card-corner bottom-right"><span class="card-rank">${rankDisplay}</span><span class="card-suit">${suitSym}</span></div>
  `;
  return el;
}

function createCardBack(delay) {
  const el = document.createElement('div');
  el.className = 'card card-back';
  el.style.animationDelay = (delay || 0) + 'ms';
  el.classList.add('deal-anim');
  el.innerHTML = '<div class="card-back-pattern"></div>';
  return el;
}

// ─── Phase Management ─────────────────────────────────────────────────────────

function showPhase(phase) {
  // Hide all action groups
  document.querySelectorAll('.action-group').forEach(g => g.classList.add('hidden'));

  if (phase === 'betting') {
    document.getElementById('actions-betting').classList.remove('hidden');
  } else if (phase === 'preflop') {
    document.getElementById('actions-preflop').classList.remove('hidden');
  } else if (phase === 'flop') {
    document.getElementById('actions-flop').classList.remove('hidden');
  } else if (phase === 'river') {
    document.getElementById('actions-river').classList.remove('hidden');
  } else if (phase === 'done') {
    document.getElementById('actions-done').classList.remove('hidden');
  }
}

// ─── Stack Display ────────────────────────────────────────────────────────────

function updateStackDisplay() {
  document.getElementById('stack-display').textContent = '$' + game.playerStack;
  if (game.playerStack <= 0) {
    showMessage('Out of chips! Starting fresh with $1000.', 'lose');
    game.playerStack = 1000;
    game.saveStack();
    updateStackDisplay();
  }
}

// ─── Advice ───────────────────────────────────────────────────────────────────

function toggleAdvice() {
  adviceVisible = !adviceVisible;
  const panel = document.getElementById('advice-panel');
  if (adviceVisible) {
    panel.classList.remove('hidden');
    updateAdvice();
  } else {
    panel.classList.add('hidden');
  }
}

function hideAdvicePanel() {
  adviceVisible = false;
  document.getElementById('advice-panel').classList.add('hidden');
}

function updateAdvice() {
  if (!adviceVisible) return;
  if (!game.playerCards.length) return;

  const advice = getAdvice(game.playerCards, game.communityCards, game.betStage, game.ante);
  const el = document.getElementById('advice-text');
  el.textContent = '💡 ' + advice.reason;
  el.className = 'advice-text advice-' + advice.action;
}

// ─── Messages ────────────────────────────────────────────────────────────────

function showMessage(text, type) {
  const el = document.getElementById('flash-message');
  el.textContent = text;
  el.className = 'flash-message ' + (type || '');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function hideMessage() {
  document.getElementById('flash-message').classList.add('hidden');
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function setupModals() {
  document.getElementById('btn-help').addEventListener('click', () => {
    document.getElementById('modal-help').classList.remove('hidden');
  });
  document.getElementById('btn-paytable').addEventListener('click', () => {
    document.getElementById('modal-paytable').classList.remove('hidden');
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay').classList.add('hidden');
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
}
