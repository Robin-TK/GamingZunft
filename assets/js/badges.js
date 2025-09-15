// assets/js/badges.js
// Zentrale Achievements-Konfig (wird von index.html & player.html verwendet)

window.GZ_BADGES = {
  defs: {
    zuschauer:  { icon: '👀', tip: 'Zuschauer' },
    addict:     { icon: '🔥', tip: 'Addict' },
    degenerate: { icon: '🥵', tip: 'Degenerate Gambler' },
    bewusster:  { icon: '🧠', tip: 'Bewusster Gambler' },
  },
  // Zuweisungen pro Spieler (Name exakt wie in CSV-Spalte "player")
  players: {
    'Simon':   ['zuschauer', 'bewusster'],
    'Fabi':    ['zuschauer'],
    'Eltschgo':['zuschauer'],

    'Moses':   ['addict', 'degenerate'],
    'Robin':   ['addict', 'degenerate'],
    'Planki':  ['addict', 'bewusster'],
    'Domi':    ['addict', 'degenerate'],
    'Jonas':   ['addict', 'bewusster'],

    'Alex':    ['bewusster'],

    // Wer leer bleibt, bekommt einfach keine manuellen Badges
    // 'Leks': [],
    // 'Jakob': [],
  }
};
