# Role & Project Goal
You are an expert Full-stack Game Engineer and TypeScript Architect. 
Your task is to build a modern, high-performance, polished, and fully playable 2D "Water Sort Puzzle" web game designed to train analytical thinking and problem-solving for students and young learners. 

Key philosophy: Zero energy limits, zero forced ads, unlimited undo, responsive UI, fluid micro-interactions, and 100% mathematically solvable puzzles with an integrated hint system.

---

## 1. Technical Stack & Setup

- **Language:** TypeScript (strict mode enabled, no `any`).
- **Framework:** React 18+ with Vite.
- **State Management:** Zustand (for clean decoupling of game state, history, and sound/theme settings).
- **Styling:** Tailwind CSS (modern, clean, minimal glassmorphism theme).
- **Animations:** Framer Motion (for tube lifting, tilting, pouring animations, and layout transitions) and `canvas-confetti` (for level-complete celebration).
- **Icons:** `lucide-react`.

---

## 2. Project Architecture & Directory Structure

Organize the code strictly into modular layers:

src/├── core/                       # Pure algorithmic engine (Zero UI dependencies)
│   ├── types.ts                # Domain types (Color, Tube, GameState, Move, LevelConfig)
│   ├── engine.ts               # Invariant validation, pour mechanics, win condition
│   ├── solver.ts               # Canonical BFS solver with symmetry reduction & hint finder
│   └── generator.ts            # Solvable level generator with parametric difficulty
├── store/│   
└── useGameStore.ts         # Zustand store bridging core engine to React UI
├── components/│   
├── Tube.tsx                # Visual tube component with animated liquid segments
│   ├── PourStream.tsx          # Dynamic liquid pouring stream effect
│   ├── GameBoard.tsx           # Responsive flex/grid layout for tubes
│   ├── ControlBar.tsx          # Restart, Undo, Hint, Level Select, Dark Mode toggle
│   └── VictoryModal.tsx        # Victory dialog with move efficiency score├── hooks/
│   └── useGameAudio.ts         # Lightweight Web Audio API synthesize (no external audio assets)
├── styles/
│   └── index.css               # Tailwind directives and custom liquid masks
├── App.tsx
└── main.tsx
---

## 3. Core Domain & Data Structures (`src/core/types.ts`)

```typescript
export type ColorHex = string;

// A Tube is a Stack represented by an array of ColorHex (index 0 is bottom, index length-1 is top)
export type Tube = ColorHex[];

export interface Move {
  from: number;
  to: number;
  colorsPoured: ColorHex[];
  count: number;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface LevelConfig {
  id: number;
  name: string;
  difficulty: Difficulty;
  tubeCapacity: number;
  colorCount: number;
  emptyTubes: number;
  minOptimalMoves: number;
}
4. Game Rules & Pouring Invariants (src/core/engine.ts)
Implement WaterSortEngine with strict logic:
    1. Capacity: Fixed per level (default: 4 units per tube).
    2. Pour Rule:
        Source tube must NOT be empty.
        Target tube must NOT be full.
        Poured color must match target tube's current top color OR target tube is completely empty.
        Pruning Trivial Moves: Do NOT allow pouring into an empty tube if the source tube already contains only that single uniform color.
    Multi-segment Pour: If the source tube has $k$ identical consecutive color blocks on top, it pours min(k, capacity - target.length) blocks in a single turn. 
    3. Win Condition:
    Every tube is either completely empty OR completely full with exactly 1 uniform color.

5.Solver & Level Generator (src/core/solver.ts & src/core/generator.ts)
Canonical BFS Solver (with Symmetry Reduction)
    Problem: Permutations of identical tubes cause $N!$ redundant search branches.
    Solution: Canonical Hashing. For every state, sort the array of tubes lexicographically before generating the string key for the visited: Set<string>.
    Outputs:
    solve(tubes): Move[] | null: Returns the shortest optimal path.
    getNextBestMove(tubes): Move | null: For dynamic hints during gameplay.
    Level Generator:
    Use Generate-and-Test with Reverse Fisher-Yates:
        Pick $C$ colors from a preset harmonious palette.
        Create full pools ($C \times \text{capacity}$) and shuffle randomly.
        Distribute into $C$ tubes + append $E$ empty tubes (default $E = 2$).
        Discard immediately if any tube is already pre-solved.
        Pass into BFS Solver. Only accept if solution.length >= minOptimalMoves.
        Return generated level with precomputed minOptimalMoves for star ratings.
        
        Difficulty 
        Presets:Easy: 3-4 colors, 2 empty tubes, minOptimalMoves: 8 - 12.
        Medium: 5-6 colors, 2 empty tubes, minOptimalMoves: 14 - 22.
        Hard: 7-9 colors, 2 empty tubes, minOptimalMoves: 25 - 35+.

6. Visual Design, UX, & Animations
Tube & Liquid Styling:
Tube Structure:
Rounded pill-like glass container (border-2 border-white/30 backdrop-blur-md rounded-b-3xl rounded-t-lg bg-white/5).

Realistic glass reflection overlay (subtle linear gradient sheen on the left and right border).

Liquid Layers:

Stacked rectangles inside the tube with smooth top-surface curvature.

Color palette: Modern, pastel, high-contrast, colorblind-friendly hex values.

Motion Details (Framer Motion):
Select: Clicking a source tube lifts it up by 24px (translateY(-24px)) and gives it a glowing outline.Pouring Motion:
    The source tube translates toward the target tube and rotates $45^\circ$ to $75^\circ$ depending on liquid height.
    Render an animated vertical pouring stream (PourStream.tsx) spanning from the source spout to the target liquid surface.
    Target tube's liquid smoothly increments height using CSS transition/Framer motion.Deselect/Invalid: Quick horizontal shake animation if an illegal move is tapped.

Audio Effects (Web Audio API):
Create procedural, synthetic sound effects using Web Audio oscillators:

Select tube: Gentle high pop (Sine oscillator, 400Hz -> 600Hz, 80ms).

Pouring liquid: Soft bubbling/trickle pitch sweep.

Error/Blocked: Low damp thud.

Level Won: Harmonious chord arpeggio (C-E-G-C).

7. Delivery Instructions
Write clear, production-grade, self-contained TypeScript files.

Ensure there are no type errors, missing exports, or unresolved imports.

Include an interactive header with:

Level indicator & Move counter.

Optimal move target badge.

Undo button (reverts history stack with state restoration).

Hint button (highlights the next recommended source and destination tubes).

Restart button and Difficulty selector dropdown.

