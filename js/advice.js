'use strict';

function getAdvice(playerCards, communityCards, betStage, ante) {
  if (!playerCards || playerCards.length < 2) return { action: 'check', reason: '' };

  if (betStage === 'preflop') {
    return preflopAdvice(playerCards);
  } else if (betStage === 'flop') {
    return flopAdvice(playerCards, communityCards);
  } else if (betStage === 'river') {
    return riverAdvice(playerCards, communityCards);
  }
  return { action: 'check', reason: '' };
}

function rankValue(r) {
  const map = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14 };
  return map[r];
}

function preflopAdvice(cards) {
  const [c1, c2] = cards;
  const r1 = rankValue(c1.rank);
  const r2 = rankValue(c2.rank);
  const hi = Math.max(r1, r2);
  const lo = Math.min(r1, r2);
  const suited = c1.suit === c2.suit;
  const isPair = r1 === r2;

  // Bet 4x conditions
  if (isPair) return { action: 'bet4', reason: 'Pair — Bet 4x' };
  if (hi === 14) return { action: 'bet4', reason: 'Ace high — Bet 4x' };
  // K+5 or better offsuit, K+any suited
  if (hi === 13) {
    if (suited) return { action: 'bet4', reason: 'King suited — Bet 4x' };
    if (lo >= 5) return { action: 'bet4', reason: 'King-' + rankName(lo) + ' offsuit — Bet 4x' };
  }
  // Q+6 suited, Q+T+
  if (hi === 12) {
    if (suited && lo >= 6) return { action: 'bet4', reason: 'Queen-' + rankName(lo) + ' suited — Bet 4x' };
    if (lo >= 10) return { action: 'bet4', reason: 'Queen-Ten+ — Bet 4x' };
  }
  // J+9 suited, J+T
  if (hi === 11) {
    if (suited && lo >= 9) return { action: 'bet4', reason: 'Jack-' + rankName(lo) + ' suited — Bet 4x' };
    if (lo >= 10) return { action: 'bet4', reason: 'Jack-Ten — Bet 4x' };
  }

  // Bet 3x conditions
  // K+2-4 offsuit
  if (hi === 13 && !suited && lo >= 2 && lo <= 4) return { action: 'bet3', reason: 'King-' + rankName(lo) + ' offsuit — Bet 3x' };
  // Q+7-9 offsuit
  if (hi === 12 && !suited && lo >= 7 && lo <= 9) return { action: 'bet3', reason: 'Queen-' + rankName(lo) + ' offsuit — Bet 3x' };
  // J+8 offsuit
  if (hi === 11 && !suited && lo === 8) return { action: 'bet3', reason: 'Jack-Eight offsuit — Bet 3x' };
  // T+9 suited
  if (hi === 10 && lo === 9 && suited) return { action: 'bet3', reason: 'Ten-Nine suited — Bet 3x' };
  // Connected suited 8-9, 7-8
  if (suited && hi - lo === 1 && lo >= 7 && lo <= 8) return { action: 'bet3', reason: rankName(hi) + '-' + rankName(lo) + ' suited connected — Bet 3x' };

  return { action: 'check', reason: 'Weak hand — Check' };
}

function rankName(v) {
  const map = { 2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'Ten',11:'Jack',12:'Queen',13:'King',14:'Ace' };
  return map[v] || v;
}

function flopAdvice(playerCards, communityCards) {
  const allCards = [...playerCards, ...communityCards];

  // Check pair or better using at least one hole card
  if (hasPairOrBetterWithHoleCard(playerCards, communityCards)) {
    return { action: 'bet2', reason: 'Pair or better with hole card — Bet 2x' };
  }

  // 4-card flush draw with a hole card
  if (has4CardFlushDraw(playerCards, communityCards)) {
    return { action: 'bet2', reason: '4-card flush draw — Bet 2x' };
  }

  // Open-ended straight draw with hole card
  if (hasOESDrawWithHoleCard(playerCards, communityCards)) {
    return { action: 'bet2', reason: 'Open-ended straight draw — Bet 2x' };
  }

  return { action: 'check', reason: 'No strong draw — Check' };
}

function riverAdvice(playerCards, communityCards) {
  if (hasPairOrBetterWithHoleCard(playerCards, communityCards)) {
    return { action: 'bet1', reason: 'Pair or better with hole card — Bet 1x' };
  }
  return { action: 'fold', reason: 'No pair with hole card — Fold' };
}

function hasPairOrBetterWithHoleCard(playerCards, communityCards) {
  // Check if best hand from all 5 cards is pair+ AND at least one hole card contributes
  const allCards = [...playerCards, ...communityCards];
  const game = { rankValue };

  // Try to find any combination of 2 hole cards + community that forms pair+
  // Simpler: check if either hole card rank matches any other card in full set
  // OR evaluate the best 5 out of all and check if hand rank >= 1 using hole cards

  // For pair check: does any hole card pair with community or each other?
  const holeRanks = playerCards.map(c => rankValue(c.rank));
  const commRanks = communityCards.map(c => rankValue(c.rank));
  const allRanks = [...holeRanks, ...commRanks];

  // Check if hole cards pair each other
  if (holeRanks[0] === holeRanks[1]) return true;

  // Check if either hole card matches a community card rank
  for (const hr of holeRanks) {
    if (commRanks.includes(hr)) return true;
  }

  // Check for better hands (trips, straight, flush etc) using hole cards
  // Use a mini-evaluator for the 5 cards (at flop: 2+3=5, at river: 2+5=7)
  if (allCards.length >= 5) {
    const best = evaluateBest5Simple(allCards);
    if (best.rank >= 1) {
      // Verify hole card contribution
      return handUsesHoleCard(best.usedCards, playerCards);
    }
  }

  return false;
}

function has4CardFlushDraw(playerCards, communityCards) {
  const allCards = [...playerCards, ...communityCards];
  const suitCounts = {};
  const suitCards = {};
  for (const c of allCards) {
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    if (!suitCards[c.suit]) suitCards[c.suit] = [];
    suitCards[c.suit].push(c);
  }
  for (const suit in suitCounts) {
    if (suitCounts[suit] >= 4) {
      // Check at least one hole card is in this suit
      const holeInSuit = playerCards.filter(c => c.suit === suit);
      if (holeInSuit.length >= 1) return true;
    }
  }
  return false;
}

function hasOESDrawWithHoleCard(playerCards, communityCards) {
  const allCards = [...playerCards, ...communityCards];
  const vals = [...new Set(allCards.map(c => rankValue(c.rank)))].sort((a,b) => a-b);
  const holeVals = new Set(playerCards.map(c => rankValue(c.rank)));

  // Check for 4 consecutive values; open-ended = completable on both ends
  for (let i = 0; i <= vals.length - 4; i++) {
    const seq = vals.slice(i, i + 4);
    if (seq[3] - seq[0] === 3 && seq[3] < 14) { // exclude sequences ending at A (e.g. J-Q-K-A is not truly open-ended)
      // Check hole card is part of this sequence
      for (const v of seq) {
        if (holeVals.has(v)) return true;
      }
    }
  }
  return false;
}

function evaluateBest5Simple(cards) {
  const combos = combinations(cards, Math.min(5, cards.length));
  let best = null;
  for (const combo of combos) {
    const ev = evaluate5Simple(combo);
    if (!best || ev.rank > best.rank) best = ev;
    else if (ev.rank === best.rank) {
      // compare tiebreak
      for (let i = 0; i < ev.tiebreak.length; i++) {
        if (ev.tiebreak[i] > (best.tiebreak[i] || 0)) { best = ev; break; }
        if (ev.tiebreak[i] < (best.tiebreak[i] || 0)) break;
      }
    }
  }
  return best;
}

function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function evaluate5Simple(cards) {
  const vals = cards.map(c => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  let isStraight = false;
  let straightHigh = vals[0];
  if (vals[0] - vals[4] === 4 && new Set(vals).size === 5) {
    isStraight = true;
  } else if (vals[0] === 14 && vals[1] === 5 && vals[2] === 4 && vals[3] === 3 && vals[4] === 2) {
    isStraight = true;
    straightHigh = 5;
  }

  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const freq = Object.values(counts).sort((a, b) => b - a);

  let rank;
  if (isFlush && isStraight) rank = straightHigh === 14 ? 9 : 8;
  else if (freq[0] === 4) rank = 7;
  else if (freq[0] === 3 && freq[1] === 2) rank = 6;
  else if (isFlush) rank = 5;
  else if (isStraight) rank = 4;
  else if (freq[0] === 3) rank = 3;
  else if (freq[0] === 2 && freq[1] === 2) rank = 2;
  else if (freq[0] === 2) rank = 1;
  else rank = 0;

  return { rank, tiebreak: vals, usedCards: cards };
}

function handUsesHoleCard(usedCards, playerCards) {
  if (!usedCards) return false;
  const holeSet = new Set(playerCards.map(c => c.rank + c.suit));
  return usedCards.some(c => holeSet.has(c.rank + c.suit));
}
