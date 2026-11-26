import type { ClassicStudy, OpeningInfo } from '../types/chess';

export const ECO_OPENINGS: OpeningInfo[] = [
  // King's Pawn Openings (e4)
  { eco: 'C65', name: 'Ruy Lopez: Berlin Defense', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'] },
  { eco: 'C70', name: 'Ruy Lopez: Morphy Defense', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4'] },
  { eco: 'C68', name: 'Ruy Lopez: Exchange Variation', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6'] },
  { eco: 'C60', name: 'Ruy Lopez', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'C57', name: 'Italian Game: Fried Liver Attack', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'] },
  { eco: 'C55', name: 'Italian Game: Two Knights Defense', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'] },
  { eco: 'C53', name: 'Italian Game: Giuoco Piano', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3'] },
  { eco: 'C51', name: 'Italian Game: Evans Gambit', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'] },
  { eco: 'C50', name: 'Italian Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { eco: 'C45', name: 'Scotch Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },
  { eco: 'C47', name: 'Four Knights Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'] },
  { eco: 'C42', name: "Petrov's Defense", moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { eco: 'C41', name: 'Philidor Defense', moves: ['e4', 'e5', 'Nf3', 'd6'] },
  { eco: 'C30', name: "King's Gambit", moves: ['e4', 'e5', 'f4'] },
  { eco: 'C25', name: 'Vienna Game', moves: ['e4', 'e5', 'Nc3'] },
  { eco: 'C23', name: "Bishop's Opening", moves: ['e4', 'e5', 'Bc4'] },
  { eco: 'C20', name: "King's Pawn Game", moves: ['e4', 'e5'] },

  // Sicilian Defense
  { eco: 'B90', name: 'Sicilian Defense: Najdorf Variation', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] },
  { eco: 'B70', name: 'Sicilian Defense: Dragon Variation', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'] },
  { eco: 'B50', name: 'Sicilian Defense: Open', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4'] },
  { eco: 'B33', name: 'Sicilian Defense: Sveshnikov', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5'] },
  { eco: 'B32', name: 'Sicilian Defense: Open Nc6', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4'] },
  { eco: 'B23', name: 'Sicilian Defense: Closed', moves: ['e4', 'c5', 'Nc3'] },
  { eco: 'B22', name: 'Sicilian Defense: Alapin', moves: ['e4', 'c5', 'c3'] },
  { eco: 'B20', name: 'Sicilian Defense', moves: ['e4', 'c5'] },

  // French, Caro-Kann, Scandinavian, Pirc, Alekhine
  { eco: 'C02', name: 'French Defense: Advance Variation', moves: ['e4', 'e6', 'd4', 'd5', 'e5'] },
  { eco: 'C01', name: 'French Defense: Exchange Variation', moves: ['e4', 'e6', 'd4', 'd5', 'exd5'] },
  { eco: 'C10', name: 'French Defense: Rubinstein / Classical', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3'] },
  { eco: 'C00', name: 'French Defense', moves: ['e4', 'e6'] },
  { eco: 'B12', name: 'Caro-Kann Defense: Advance Variation', moves: ['e4', 'c6', 'd4', 'd5', 'e5'] },
  { eco: 'B13', name: 'Caro-Kann Defense: Exchange Variation', moves: ['e4', 'c6', 'd4', 'd5', 'exd5'] },
  { eco: 'B10', name: 'Caro-Kann Defense', moves: ['e4', 'c6'] },
  { eco: 'B01', name: 'Scandinavian Defense', moves: ['e4', 'd5'] },
  { eco: 'B07', name: 'Pirc Defense', moves: ['e4', 'd6', 'd4', 'Nf6'] },
  { eco: 'B02', name: "Alekhine's Defense", moves: ['e4', 'Nf6'] },
  { eco: 'B06', name: 'Modern Defense', moves: ['e4', 'g6'] },

  // Queen's Pawn Openings (d4)
  { eco: 'D30', name: "Queen's Gambit Declined", moves: ['d4', 'd5', 'c4', 'e6'] },
  { eco: 'D20', name: "Queen's Gambit Accepted", moves: ['d4', 'd5', 'c4', 'dxc4'] },
  { eco: 'D10', name: 'Slav Defense', moves: ['d4', 'd5', 'c4', 'c6'] },
  { eco: 'D06', name: "Queen's Gambit", moves: ['d4', 'd5', 'c4'] },
  { eco: 'D02', name: 'London System', moves: ['d4', 'd5', 'Bf4'] },
  { eco: 'A45', name: 'London System', moves: ['d4', 'Nf6', 'Bf4'] },
  { eco: 'D02', name: 'London System', moves: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'] },
  { eco: 'E60', name: "King's Indian Defense", moves: ['d4', 'Nf6', 'c4', 'g6'] },
  { eco: 'E20', name: 'Nimzo-Indian Defense', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'E12', name: "Queen's Indian Defense", moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'] },
  { eco: 'D85', name: 'Grünfeld Defense', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'] },
  { eco: 'E00', name: 'Catalan Opening', moves: ['d4', 'Nf6', 'c4', 'e6', 'g3'] },
  { eco: 'A80', name: 'Dutch Defense', moves: ['d4', 'f5'] },
  { eco: 'A56', name: 'Benoni Defense', moves: ['d4', 'Nf6', 'c4', 'c5'] },
  { eco: 'D00', name: "Queen's Pawn Game", moves: ['d4', 'd5'] },
  { eco: 'A45', name: 'Indian Defense', moves: ['d4', 'Nf6'] },

  // Flank Openings
  { eco: 'A20', name: 'English Opening: Reversed Sicilian', moves: ['c4', 'e5'] },
  { eco: 'A30', name: 'English Opening: Symmetrical', moves: ['c4', 'c5'] },
  { eco: 'A10', name: 'English Opening', moves: ['c4'] },
  { eco: 'A04', name: 'Réti Opening', moves: ['Nf3'] },
  { eco: 'A02', name: "Bird's Opening", moves: ['f4'] },
  { eco: 'A01', name: "Nimzo-Larsen Attack", moves: ['b3'] },
  { eco: 'B00', name: "King's Pawn Opening", moves: ['e4'] },
  { eco: 'A40', name: "Queen's Pawn Opening", moves: ['d4'] },
];

/**
 * Matches the longest prefix in ECO_OPENINGS for a given SAN move list.
 */
export function detectOpening(sanMoves: string[]): OpeningInfo | null {
  if (sanMoves.length === 0) return null;
  let bestMatch: OpeningInfo | null = null;
  for (const opening of ECO_OPENINGS) {
    if (opening.moves.length > sanMoves.length) continue;
    let matches = true;
    for (let i = 0; i < opening.moves.length; i++) {
      if (opening.moves[i] !== sanMoves[i]) {
        matches = false;
        break;
      }
    }
    if (matches && (!bestMatch || opening.moves.length > bestMatch.moves.length)) {
      bestMatch = opening;
    }
  }
  return bestMatch;
}

export const CLASSIC_STUDIES: ClassicStudy[] = [
  {
    id: 'opera-game',
    title: 'The Opera Game (1858)',
    subtitle: 'Paul Morphy vs. Duke Karl & Count Isouard',
    category: 'Classic Game',
    pgn: '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#',
  },
  {
    id: 'immortal-game',
    title: 'The Immortal Game (1851)',
    subtitle: 'Adolf Anderssen vs. Lionel Kieseritzky',
    category: 'Classic Game',
    pgn: '1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7#',
  },
  {
    id: 'smothered-mate',
    title: 'Philidor Smothered Mate',
    subtitle: 'White to move — find the forced mate in 4',
    category: 'Tactic',
    fen: 'r4rk1/ppp2ppp/8/4N3/2B5/8/PPP2PPP/R2Q2K1 w - - 0 1',
  },
  {
    id: 'mate-in-2',
    title: 'Opera Queen Sacrifice',
    subtitle: 'White to move — forced mate in 2 (Qb8+!)',
    category: 'Tactic',
    fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 16',
  },
  {
    id: 'lucena-endgame',
    title: 'Lucena Position',
    subtitle: 'Classic winning rook endgame — build the bridge',
    category: 'Endgame',
    fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
  },
];
