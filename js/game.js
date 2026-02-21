'use strict';

class HeadsUpGame {
  constructor() {
    this.playerStack = parseInt(localStorage.getItem('huholdem_stack') || '1000', 10);
    this.reset();
  }

  reset() {
    this.ante = 0;
    this.blind = 0;
    this.tripsBet = 0;
    this.playBet = 0;
    this.betStage = 'idle'; // idle | preflop | flop | river | done
    this.playerCards = [];
    this.dealerCards = [];
    this.communityCards = [];
    this.pot = 0;
    this.lastResult = null;
    this.deck = [];
    this.hasActed = false;
  }

  saveStack() {
    localStorage.setItem('huholdem_stack', this.playerStack);
  }

  buildDeck() {
    const suits = ['s', 'h', 'd', 'c'];
    const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
    this.deck = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        this.deck.push({ rank, suit });
      }
    }
  }

  shuffle() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  dealCard() {
    return this.deck.pop();
  }

  newGame() {
    this.reset();
  }

  placeBets(ante, trips) {
    if (ante < 1) throw new Error('Ante must be at least $1');
    const total = ante * 2 + trips;
    if (total > this.playerStack) throw new Error('Insufficient funds');
    this.ante = ante;
    this.blind = ante;
    this.tripsBet = trips;
    this.playerStack -= total;
    this.pot = total;
    this.saveStack();
  }

  deal() {
    this.buildDeck();
    this.shuffle();
    this.playerCards = [this.dealCard(), this.dealCard()];
    this.dealerCards = [this.dealCard(), this.dealCard()];
    this.communityCards = [];
    this.hasActed = false;
    this.betStage = 'preflop';
  }

  playerBet(multiplier) {
    // multiplier: 4, 3 (preflop), 2 (flop), 1 (river)
    if (this.hasActed) throw new Error('Already bet');
    const amount = this.ante * multiplier;
    if (amount > this.playerStack) throw new Error('Insufficient funds');
    this.playBet = amount;
    this.playerStack -= amount;
    this.pot += amount;
    this.hasActed = true;
    this.saveStack();
  }

  playerCheck() {
    if (this.hasActed) throw new Error('Already bet');
    this.hasActed = true;
  }

  playerFold() {
    // Lose ante and blind
    this.betStage = 'done';
    this.hasActed = true;
    this.lastResult = {
      winner: 'dealer',
      playerHand: null,
      dealerHand: null,
      dealerQualified: true,
      folded: true,
      payouts: { ante: -this.ante, blind: -this.blind, trips: this._tripsResult([]), play: 0 },
      message: 'You folded. Lost Ante and Blind.'
    };
    // Trips pays out on fold if applicable (no community cards = lose)
    this.lastResult.payouts.trips = this.tripsBet > 0 ? -this.tripsBet : 0;
    this.saveStack();
    return this.lastResult;
  }

  dealFlop() {
    this.communityCards.push(this.dealCard(), this.dealCard(), this.dealCard());
    this.hasActed = false;
    this.betStage = 'flop';
  }

  dealTurnRiver() {
    this.communityCards.push(this.dealCard(), this.dealCard());
    this.hasActed = false;
    this.betStage = 'river';
  }

  showdown() {
    // Deal remaining community cards if needed
    while (this.communityCards.length < 5) {
      this.communityCards.push(this.dealCard());
    }

    const allCards = [...this.playerCards, ...this.communityCards];
    const dealerAll = [...this.dealerCards, ...this.communityCards];

    const playerHand = this.evaluateBest5(allCards);
    const dealerHand = this.evaluateBest5(dealerAll);

    const dealerQualified = dealerHand.rank >= 1; // pair or better

    let winner;
    const cmp = this.compareHands(playerHand, dealerHand);
    if (cmp > 0) winner = 'player';
    else if (cmp < 0) winner = 'dealer';
    else winner = 'tie';

    const payouts = { ante: 0, blind: 0, trips: 0, play: 0 };

    if (winner === 'player') {
      if (!dealerQualified) {
        // Ante pushes, blind pays per table, play wins 1:1
        payouts.ante = 0; // push = return bet, net 0
        payouts.blind = this._blindPayout(playerHand.rank);
        payouts.play = this.playBet; // win 1:1 = get back + profit
      } else {
        payouts.ante = this.ante;
        payouts.blind = this._blindPayout(playerHand.rank);
        payouts.play = this.playBet;
      }
    } else if (winner === 'dealer') {
      payouts.ante = -this.ante;
      payouts.blind = -this.blind;
      payouts.play = -this.playBet;
    } else {
      // tie - all push
      payouts.ante = 0;
      payouts.blind = 0;
      payouts.play = 0;
    }

    // Trips side bet
    if (this.tripsBet > 0) {
      payouts.trips = this._tripsResult(playerHand);
    }

    // Apply payouts to stack
    // Return original bets + winnings
    // Ante bet: always returned unless dealer wins
    // Blind bet: always returned unless dealer wins
    // Play bet: always returned unless dealer wins
    let stackDelta = 0;

    if (winner === 'player') {
      if (!dealerQualified) {
        stackDelta += this.ante; // ante returned (push)
        stackDelta += this.blind + payouts.blind; // blind returned + payout
        stackDelta += this.playBet + payouts.play; // play returned + win
      } else {
        stackDelta += this.ante + payouts.ante; // ante returned + win
        stackDelta += this.blind + payouts.blind; // blind returned + payout
        stackDelta += this.playBet + payouts.play; // play returned + win
      }
    } else if (winner === 'tie') {
      stackDelta += this.ante;
      stackDelta += this.blind;
      stackDelta += this.playBet;
    }
    // dealer wins: nothing returned

    // Trips
    if (this.tripsBet > 0) {
      if (payouts.trips > 0) {
        stackDelta += this.tripsBet + payouts.trips;
      }
      // if trips loses, bet already deducted
    }

    this.playerStack += stackDelta;
    this.saveStack();

    let message = '';
    if (winner === 'player') {
      message = dealerQualified
        ? `You win! Dealer qualifies. Your ${playerHand.name} beats dealer's ${dealerHand.name}.`
        : `You win! Dealer doesn't qualify (${dealerHand.name}). Ante pushes.`;
    } else if (winner === 'dealer') {
      message = `Dealer wins with ${dealerHand.name} vs your ${playerHand.name}.`;
    } else {
      message = `Push! Both have ${playerHand.name}.`;
    }

    this.betStage = 'done';
    this.lastResult = {
      winner,
      playerHand,
      dealerHand,
      dealerQualified,
      folded: false,
      payouts,
      message
    };

    return this.lastResult;
  }

  _blindPayout(handRank) {
    // Returns NET profit on the blind bet
    switch (handRank) {
      case 9: return this.blind * 500; // Royal Flush 500:1
      case 8: return this.blind * 50;  // Straight Flush 50:1
      case 7: return this.blind * 10;  // Four of a Kind 10:1
      case 6: return this.blind * 3;   // Full House 3:1
      case 5: return Math.floor(this.blind * 1.5); // Flush 3:2 (round down per casino standard)
      case 4: return this.blind * 1;   // Straight 1:1
      default: return 0;               // Push (hand < straight)
    }
  }

  _tripsResult(playerHand) {
    if (!playerHand || playerHand.rank === undefined) return -this.tripsBet;
    const rank = playerHand.rank;
    let multiplier = 0;
    switch (rank) {
      case 9: multiplier = 50; break;  // Royal Flush
      case 8: multiplier = 40; break;  // Straight Flush
      case 7: multiplier = 30; break;  // Four of a Kind
      case 6: multiplier = 9; break;   // Full House
      case 5: multiplier = 7; break;   // Flush
      case 4: multiplier = 4; break;   // Straight
      case 3: multiplier = 3; break;   // Three of a Kind
      default: return -this.tripsBet;  // Lose
    }
    return this.tripsBet * multiplier;
  }

  // ─── Hand Evaluator ──────────────────────────────────────────────────────────

  rankValue(r) {
    const map = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14 };
    return map[r];
  }

  evaluateBest5(cards) {
    // Generate all C(n,5) combinations
    const combos = this.combinations(cards, 5);
    let best = null;
    for (const combo of combos) {
      const ev = this.evaluate5(combo);
      if (!best || this.compareHands(ev, best) > 0) {
        best = ev;
      }
    }
    return best;
  }

  combinations(arr, k) {
    if (k === 0) return [[]];
    if (arr.length === 0) return [];
    const [first, ...rest] = arr;
    const withFirst = this.combinations(rest, k - 1).map(c => [first, ...c]);
    const withoutFirst = this.combinations(rest, k);
    return [...withFirst, ...withoutFirst];
  }

  evaluate5(cards) {
    const vals = cards.map(c => this.rankValue(c.rank)).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);
    const isFlush = suits.every(s => s === suits[0]);

    // Check straight (including A-2-3-4-5)
    let isStraight = false;
    let straightHigh = vals[0];
    if (vals[0] - vals[4] === 4 && new Set(vals).size === 5) {
      isStraight = true;
    } else if (vals[0] === 14 && vals[1] === 5 && vals[2] === 4 && vals[3] === 3 && vals[4] === 2) {
      isStraight = true;
      straightHigh = 5; // wheel
    }

    const counts = {};
    for (const v of vals) counts[v] = (counts[v] || 0) + 1;
    const freq = Object.values(counts).sort((a, b) => b - a);
    const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

    let rank, tiebreak, name;

    if (isFlush && isStraight) {
      rank = straightHigh === 14 ? 9 : 8;
      name = straightHigh === 14 ? 'Royal Flush' : 'Straight Flush';
      tiebreak = [straightHigh];
    } else if (freq[0] === 4) {
      rank = 7; name = 'Four of a Kind';
      const quad = parseInt(groups[0][0]);
      const kicker = parseInt(groups[1][0]);
      tiebreak = [quad, kicker];
    } else if (freq[0] === 3 && freq[1] === 2) {
      rank = 6; name = 'Full House';
      const trip = parseInt(groups[0][0]);
      const pair = parseInt(groups[1][0]);
      tiebreak = [trip, pair];
    } else if (isFlush) {
      rank = 5; name = 'Flush';
      tiebreak = vals;
    } else if (isStraight) {
      rank = 4; name = 'Straight';
      tiebreak = [straightHigh];
    } else if (freq[0] === 3) {
      rank = 3; name = 'Three of a Kind';
      const trip = parseInt(groups[0][0]);
      const kickers = groups.slice(1).map(g => parseInt(g[0])).sort((a,b) => b-a);
      tiebreak = [trip, ...kickers];
    } else if (freq[0] === 2 && freq[1] === 2) {
      rank = 2; name = 'Two Pair';
      const p1 = parseInt(groups[0][0]);
      const p2 = parseInt(groups[1][0]);
      const kicker = parseInt(groups[2][0]);
      tiebreak = [Math.max(p1,p2), Math.min(p1,p2), kicker];
    } else if (freq[0] === 2) {
      rank = 1; name = 'One Pair';
      const pair = parseInt(groups[0][0]);
      const kickers = groups.slice(1).map(g => parseInt(g[0])).sort((a,b) => b-a);
      tiebreak = [pair, ...kickers];
    } else {
      rank = 0; name = 'High Card';
      tiebreak = vals;
    }

    return { rank, name, tiebreak, cards };
  }

  compareHands(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
      const av = a.tiebreak[i] || 0;
      const bv = b.tiebreak[i] || 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  }
}
