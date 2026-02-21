/**
 * ui.js — Buy-in buttons, denomination selector, stack assist toggle, reset.
 */
import { spawnRack, clearAllChips, chips, DENOMINATIONS } from './chips.js';
import { removeBody } from './physics.js';
import { setAssistEnabled } from './interaction.js';

let _scene  = null;
let _stack  = 1000;
let _selectedDenom = 25;

export function initUI(scene) {
  _scene = scene;

  // Denomination buttons
  const denomGroup = document.getElementById('denom-group');
  if (denomGroup) {
    DENOMINATIONS.forEach(d => {
      const btn = document.createElement('button');
      btn.className = 'denom-btn' + (d.value === _selectedDenom ? ' active' : '');
      btn.title = d.label;
      btn.textContent = d.label;
      btn.style.background   = d.color;
      btn.style.color        = d.textColor;
      btn.style.borderColor  = d.edgeColor;
      btn.dataset.value      = String(d.value);
      btn.addEventListener('click', () => {
        _selectedDenom = d.value;
        denomGroup.querySelectorAll('.denom-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.value === String(d.value))
        );
      });
      denomGroup.appendChild(btn);
    });
  }

  // Buy-in
  const btnBuyin = document.getElementById('btn-buyin');
  if (btnBuyin) {
    btnBuyin.addEventListener('click', () => {
      if (_stack <= 0) { showToast('No chips left!'); return; }
      const buyAmount = Math.min(_stack, 200);
      _stack -= buyAmount;
      updateStackDisplay();
      spawnRack(_scene, buyAmount, [100, 25, 5, 1]);
      showToast(`Bought in $${buyAmount}`);
    });
  }

  // Reset table
  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', resetTable);
  }

  // Stack Assist toggle
  const toggleAssist = document.getElementById('toggle-assist');
  if (toggleAssist) {
    toggleAssist.addEventListener('change', () => {
      setAssistEnabled(toggleAssist.checked);
    });
  }

  updateStackDisplay();
  updateChipCountDisplay();
}

function resetTable() {
  // Return chip values to stack, remove all chips
  const total = chips.reduce((sum, c) => sum + c.value, 0);
  _stack += total;

  // Remove physics bodies
  for (const chip of chips) {
    removeBody(chip.body);
  }
  clearAllChips(_scene);

  updateStackDisplay();
  updateChipCountDisplay();
  showToast('Table reset!');
}

export function updateChipCountDisplay() {
  const el = document.getElementById('chip-count-display');
  if (el) el.textContent = `${chips.length} chip${chips.length !== 1 ? 's' : ''}`;
}

function updateStackDisplay() {
  const el = document.getElementById('stack-display');
  if (el) el.textContent = `$${_stack.toLocaleString()}`;
}

let _toastTimer = null;
export function showToast(msg) {
  const tt = document.getElementById('tooltip');
  if (!tt) return;
  tt.textContent = msg;
  tt.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => tt.classList.remove('show'), 2500);
}
