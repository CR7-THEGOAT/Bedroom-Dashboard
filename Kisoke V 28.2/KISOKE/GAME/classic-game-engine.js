(function () {
  const cfg = window.KISOKE_GAME || {};
  const root = document.getElementById('game-root');
  const modeLabels = { ai: 'AI vs Player 1', two: '2 Player' };
  const state = {
    mode: localStorage.getItem('kisoke.game.mode') || 'ai',
    scores: [0, 0],
    running: false,
    cleanup: null
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function setStatus(title, detail) {
    const box = el('status-box');
    if (!box) return;
    box.innerHTML = `<strong>${title}</strong><span>${detail || ''}</span>`;
  }

  function setScores(a, b) {
    state.scores = [a, b];
    const left = el('score-left');
    const right = el('score-right');
    if (left) left.textContent = String(a);
    if (right) right.textContent = String(b);
  }

  function cleanupCurrent() {
    if (typeof state.cleanup === 'function') state.cleanup();
    state.cleanup = null;
  }

  function shell() {
    const title = cfg.title || 'KISOKE Game';
    const detail = cfg.detail || 'Offline local classic game.';
    root.innerHTML = `
      <section class="game-shell theme-${cfg.theme || 'green'}">
        <header class="game-top">
          <div class="game-title">
            <h1>${title}</h1>
            <p>${detail}</p>
          </div>
          <div class="top-actions">
            <a href="/games">Back to Gaming</a>
            <a href="/GAME/index.html">All games</a>
          </div>
        </header>
        <main class="game-main">
          <section class="play-panel" id="play-panel"></section>
          <aside class="side-panel">
            <section class="game-card">
              <h2>Mode</h2>
              <div class="mode-row">
                <button type="button" data-mode="ai">AI vs Player 1</button>
                <button type="button" data-mode="two">2 Player</button>
              </div>
            </section>
            <section class="game-card">
              <h2>Status</h2>
              <div class="status-box" id="status-box"><strong>Ready</strong><span>Choose a mode and play.</span></div>
            </section>
            <section class="game-card">
              <h2>Score</h2>
              <div class="score-grid">
                <div class="score-row"><span>Player 1</span><strong id="score-left">0</strong></div>
                <div class="score-row"><span id="score-right-label">AI</span><strong id="score-right">0</strong></div>
              </div>
            </section>
            <section class="game-card">
              <h2>Controls</h2>
              <ul class="help-list" id="help-list"></ul>
            </section>
            <section class="game-card">
              <div class="game-actions">
                <button type="button" id="reset-game">Reset round</button>
              </div>
              <p>Runs offline from the KISOKE GAME folder.</p>
            </section>
          </aside>
        </main>
      </section>
    `;

    document.querySelectorAll('[data-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        state.mode = button.dataset.mode;
        localStorage.setItem('kisoke.game.mode', state.mode);
        boot();
      });
    });
    el('reset-game').addEventListener('click', boot);
  }

  function updateModeButtons() {
    document.querySelectorAll('[data-mode]').forEach((button) => {
      button.classList.toggle('active', button.dataset.mode === state.mode);
    });
    const label = el('score-right-label');
    if (label) label.textContent = state.mode === 'ai' ? 'AI' : 'Player 2';
  }

  function setHelp(items) {
    const list = el('help-list');
    if (!list) return;
    list.innerHTML = items.map((item) => `<li>${item}</li>`).join('');
  }

  function boot() {
    cleanupCurrent();
    updateModeButtons();
    setScores(0, 0);
    const engine = cfg.engine || 'line';
    if (engine === 'pong') startPong();
    else if (engine === 'snake') startSnake();
    else if (engine === 'memory') startMemory();
    else if (engine === 'dodger') startDodger();
    else if (engine === 'tap') startTap();
    else startLine();
  }

  function startLine() {
    const rows = cfg.rows || 3;
    const cols = cfg.cols || 3;
    const connect = cfg.connect || 3;
    const gravity = Boolean(cfg.gravity);
    const symbols = cfg.symbols || ['X', 'O'];
    let board = Array(rows * cols).fill(0);
    let turn = 1;
    let locked = false;
    let over = false;
    const panel = el('play-panel');
    panel.innerHTML = `<div class="line-board" id="line-board" style="grid-template-columns: repeat(${cols}, 1fr);"></div>`;
    setHelp([
      gravity ? 'Tap a column to drop your piece.' : 'Tap a square to place your piece.',
      state.mode === 'two' ? 'Players take turns on the same screen.' : 'AI moves after Player 1.',
      `Win by connecting ${connect}.`
    ]);

    function indexAt(r, c) {
      return r * cols + c;
    }

    function targetIndex(index) {
      if (!gravity) return board[index] ? -1 : index;
      const col = index % cols;
      for (let r = rows - 1; r >= 0; r -= 1) {
        const found = indexAt(r, col);
        if (!board[found]) return found;
      }
      return -1;
    }

    function possibleMoves() {
      if (!gravity) return board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      const moves = [];
      for (let c = 0; c < cols; c += 1) {
        const i = targetIndex(c);
        if (i >= 0) moves.push(i);
      }
      return moves;
    }

    function winnerFor(testBoard) {
      const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const player = testBoard[indexAt(r, c)];
          if (!player) continue;
          for (const [dr, dc] of directions) {
            let count = 1;
            for (let step = 1; step < connect; step += 1) {
              const nr = r + dr * step;
              const nc = c + dc * step;
              if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) break;
              if (testBoard[indexAt(nr, nc)] !== player) break;
              count += 1;
            }
            if (count >= connect) return player;
          }
        }
      }
      return testBoard.every(Boolean) ? 3 : 0;
    }

    function render() {
      const boardEl = el('line-board');
      boardEl.innerHTML = board.map((value, index) => {
        const cls = value === 1 ? 'p1' : value === 2 ? 'p2' : '';
        return `<button type="button" class="line-cell ${cls}" data-index="${index}">${value ? symbols[value - 1] : ''}</button>`;
      }).join('');
      boardEl.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => play(Number(button.dataset.index)));
      });
    }

    function finish(result) {
      over = true;
      if (result === 3) {
        setStatus('Draw', 'No more moves. Reset for another round.');
      } else {
        const nextScores = state.scores.slice();
        nextScores[result - 1] += 1;
        setScores(nextScores[0], nextScores[1]);
        setStatus(`${result === 1 ? 'Player 1' : (state.mode === 'ai' ? 'AI' : 'Player 2')} wins`, 'Reset for another round.');
      }
    }

    function bestAiMove() {
      const moves = possibleMoves();
      const center = Math.floor((rows * cols) / 2);
      for (const player of [2, 1]) {
        for (const move of moves) {
          const copy = board.slice();
          copy[move] = player;
          if (winnerFor(copy) === player) return move;
        }
      }
      const sorted = moves.slice().sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
      return sorted[0] ?? -1;
    }

    function aiMove() {
      if (over || state.mode !== 'ai') return;
      const move = bestAiMove();
      if (move >= 0) {
        board[move] = 2;
        const result = winnerFor(board);
        turn = 1;
        locked = false;
        render();
        if (result) finish(result);
        else setStatus('Player 1 turn', 'Your move.');
      }
    }

    function play(rawIndex) {
      if (locked || over) return;
      const index = targetIndex(rawIndex);
      if (index < 0 || board[index]) return;
      board[index] = turn;
      const result = winnerFor(board);
      render();
      if (result) {
        finish(result);
        return;
      }
      if (state.mode === 'ai') {
        turn = 2;
        locked = true;
        setStatus('AI thinking', 'Short local move calculation.');
        window.setTimeout(aiMove, 260);
      } else {
        turn = turn === 1 ? 2 : 1;
        setStatus(`${turn === 1 ? 'Player 1' : 'Player 2'} turn`, 'Next move.');
      }
    }

    render();
    setStatus('Player 1 turn', modeLabels[state.mode]);
  }

  function startMemory() {
    const pairs = cfg.pairs || ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const cards = shuffle([...pairs, ...pairs]).map((value, id) => ({ id, value, open: false, matched: false }));
    let turn = 1;
    let open = [];
    let locked = false;
    const cols = cfg.cols || 4;
    const panel = el('play-panel');
    panel.innerHTML = `<div class="memory-board" id="memory-board" style="grid-template-columns: repeat(${cols}, 1fr);"></div>`;
    setHelp([
      'Open two cards and find matching pairs.',
      state.mode === 'ai' ? 'AI takes a random memory turn after you miss.' : 'Players alternate when they miss.',
      'Highest matched pairs wins.'
    ]);

    function render() {
      const boardEl = el('memory-board');
      boardEl.innerHTML = cards.map((card) => {
        const visible = card.open || card.matched;
        return `<button type="button" class="memory-card ${visible ? 'open' : ''} ${card.matched ? 'matched' : ''}" data-id="${card.id}">${visible ? card.value : '?'}</button>`;
      }).join('');
      boardEl.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => flip(Number(button.dataset.id)));
      });
    }

    function hiddenCards() {
      return cards.filter((card) => !card.open && !card.matched);
    }

    function completeTurn() {
      if (open.length < 2) return;
      locked = true;
      const [a, b] = open;
      if (cards[a].value === cards[b].value) {
        cards[a].matched = true;
        cards[b].matched = true;
        const next = state.scores.slice();
        next[turn - 1] += 1;
        setScores(next[0], next[1]);
        open = [];
        locked = false;
        render();
        if (cards.every((card) => card.matched)) {
          setStatus('Game over', next[0] === next[1] ? 'Draw.' : `${next[0] > next[1] ? 'Player 1' : (state.mode === 'ai' ? 'AI' : 'Player 2')} wins.`);
        } else {
          setStatus(`${turn === 1 ? 'Player 1' : (state.mode === 'ai' ? 'AI' : 'Player 2')} matched`, 'Same player continues.');
          maybeAi();
        }
      } else {
        window.setTimeout(() => {
          cards[a].open = false;
          cards[b].open = false;
          open = [];
          turn = turn === 1 ? 2 : 1;
          locked = false;
          render();
          setStatus(`${turn === 1 ? 'Player 1' : (state.mode === 'ai' ? 'AI' : 'Player 2')} turn`, 'Find a pair.');
          maybeAi();
        }, 620);
      }
    }

    function flip(id) {
      if (locked || (state.mode === 'ai' && turn === 2)) return;
      const card = cards.find((item) => item.id === id);
      if (!card || card.open || card.matched || open.length >= 2) return;
      card.open = true;
      open.push(cards.indexOf(card));
      render();
      completeTurn();
    }

    function maybeAi() {
      if (state.mode !== 'ai' || turn !== 2 || cards.every((card) => card.matched)) return;
      locked = true;
      window.setTimeout(() => {
        const available = hiddenCards();
        const first = available[Math.floor(Math.random() * available.length)];
        if (!first) return;
        first.open = true;
        open = [cards.indexOf(first)];
        render();
        window.setTimeout(() => {
          const rest = hiddenCards();
          const second = rest[Math.floor(Math.random() * rest.length)];
          if (second) {
            second.open = true;
            open.push(cards.indexOf(second));
          }
          locked = false;
          render();
          completeTurn();
        }, 480);
      }, 420);
    }

    render();
    setStatus('Player 1 turn', modeLabels[state.mode]);
  }

  function canvasBase(help) {
    const panel = el('play-panel');
    panel.innerHTML = `
      <div class="canvas-wrap">
        <canvas id="game-canvas" width="960" height="540"></canvas>
        <div class="touch-controls">
          <button type="button" data-action="left">Left</button>
          <button type="button" data-action="up">Up</button>
          <button type="button" data-action="right">Right</button>
          <button type="button" data-action="down">Down</button>
          <button type="button" data-action="pause">Pause</button>
          <button type="button" data-action="boost">Action</button>
        </div>
      </div>
    `;
    setHelp(help);
    const canvas = el('game-canvas');
    return { canvas, ctx: canvas.getContext('2d') };
  }

  function startPong() {
    const { canvas, ctx } = canvasBase([
      'Player 1: W/S keys, touch left half, or move pointer.',
      state.mode === 'two' ? 'Player 2: Arrow Up/Down keys.' : 'AI controls the right paddle.',
      'First to 7 wins the round.'
    ]);
    const keys = {};
    const game = {
      leftY: 210,
      rightY: 210,
      ballX: 480,
      ballY: 270,
      vx: cfg.speed || 6,
      vy: 3.4,
      leftScore: 0,
      rightScore: 0,
      raf: 0,
      paused: false
    };

    function resetBall(dir) {
      game.ballX = 480;
      game.ballY = 270;
      game.vx = (cfg.speed || 6) * dir;
      game.vy = (Math.random() * 4) - 2;
    }

    function draw() {
      ctx.clearRect(0, 0, 960, 540);
      ctx.fillStyle = '#06100f';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let y = 20; y < 540; y += 34) ctx.fillRect(477, y, 6, 18);
      ctx.fillStyle = '#bbf7d0';
      ctx.fillRect(40, game.leftY, 18, 120);
      ctx.fillStyle = '#bfdbfe';
      ctx.fillRect(902, game.rightY, 18, 120);
      ctx.beginPath();
      ctx.fillStyle = '#f8fafc';
      ctx.arc(game.ballX, game.ballY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '900 42px system-ui';
      ctx.fillText(String(game.leftScore), 390, 62);
      ctx.fillText(String(game.rightScore), 535, 62);
    }

    function tick() {
      if (!game.paused) {
        if (keys.KeyW) game.leftY -= 8;
        if (keys.KeyS) game.leftY += 8;
        if (state.mode === 'two') {
          if (keys.ArrowUp) game.rightY -= 8;
          if (keys.ArrowDown) game.rightY += 8;
        } else {
          game.rightY += clamp(game.ballY - (game.rightY + 60), -6.2, 6.2);
        }
        game.leftY = clamp(game.leftY, 0, 420);
        game.rightY = clamp(game.rightY, 0, 420);
        game.ballX += game.vx;
        game.ballY += game.vy;
        if (game.ballY < 15 || game.ballY > 525) game.vy *= -1;
        if (game.ballX < 72 && game.ballX > 40 && game.ballY > game.leftY && game.ballY < game.leftY + 120) {
          game.vx = Math.abs(game.vx) + 0.25;
          game.vy += (game.ballY - (game.leftY + 60)) / 18;
        }
        if (game.ballX > 888 && game.ballX < 920 && game.ballY > game.rightY && game.ballY < game.rightY + 120) {
          game.vx = -Math.abs(game.vx) - 0.25;
          game.vy += (game.ballY - (game.rightY + 60)) / 18;
        }
        if (game.ballX < -20) {
          game.rightScore += 1;
          resetBall(1);
        }
        if (game.ballX > 980) {
          game.leftScore += 1;
          resetBall(-1);
        }
        setScores(game.leftScore, game.rightScore);
        if (game.leftScore >= 7 || game.rightScore >= 7) {
          setStatus('Round over', game.leftScore > game.rightScore ? 'Player 1 wins.' : `${state.mode === 'ai' ? 'AI' : 'Player 2'} wins.`);
          game.paused = true;
        }
      }
      draw();
      game.raf = requestAnimationFrame(tick);
    }

    function keydown(event) {
      keys[event.code] = true;
      if (event.code === 'Space') game.paused = !game.paused;
    }
    function keyup(event) {
      keys[event.code] = false;
    }
    function pointer(event) {
      const rect = canvas.getBoundingClientRect();
      const y = ((event.clientY - rect.top) / rect.height) * 540;
      if (event.clientX < rect.left + rect.width / 2) game.leftY = clamp(y - 60, 0, 420);
      else if (state.mode === 'two') game.rightY = clamp(y - 60, 0, 420);
    }
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    canvas.addEventListener('pointermove', pointer);
    canvas.addEventListener('pointerdown', pointer);
    state.cleanup = () => {
      cancelAnimationFrame(game.raf);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
    };
    setStatus('Serve', modeLabels[state.mode]);
    tick();
  }

  function startSnake() {
    const { canvas, ctx } = canvasBase([
      'Player 1: Arrow keys or WASD.',
      state.mode === 'two' ? 'Player 2: I/J/K/L.' : 'AI snake chases food.',
      'Eat food, avoid walls and trails.'
    ]);
    const keys = {};
    const size = 24;
    const cols = 40;
    const rows = 22;
    const game = {
      p1: [{ x: 8, y: 10 }],
      p2: [{ x: 31, y: 10 }],
      d1: { x: 1, y: 0 },
      d2: { x: -1, y: 0 },
      food: { x: 20, y: 11 },
      timer: 0,
      leftScore: 0,
      rightScore: 0,
      over: false
    };

    function placeFood() {
      game.food = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
    }

    function setDir(player, x, y) {
      const key = player === 1 ? 'd1' : 'd2';
      if (game[key].x === -x && game[key].y === -y) return;
      game[key] = { x, y };
    }

    function handleKeys() {
      if (keys.ArrowUp || keys.KeyW) setDir(1, 0, -1);
      if (keys.ArrowDown || keys.KeyS) setDir(1, 0, 1);
      if (keys.ArrowLeft || keys.KeyA) setDir(1, -1, 0);
      if (keys.ArrowRight || keys.KeyD) setDir(1, 1, 0);
      if (state.mode === 'two') {
        if (keys.KeyI) setDir(2, 0, -1);
        if (keys.KeyK) setDir(2, 0, 1);
        if (keys.KeyJ) setDir(2, -1, 0);
        if (keys.KeyL) setDir(2, 1, 0);
      } else {
        const head = game.p2[0];
        if (Math.abs(game.food.x - head.x) > Math.abs(game.food.y - head.y)) setDir(2, Math.sign(game.food.x - head.x) || -1, 0);
        else setDir(2, 0, Math.sign(game.food.y - head.y) || -1);
      }
    }

    function moveSnake(snake, dir, player) {
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows || snake.some((part) => part.x === head.x && part.y === head.y)) {
        game.over = true;
        setStatus('Crash', `${player === 1 ? 'Player 1' : (state.mode === 'ai' ? 'AI' : 'Player 2')} crashed.`);
        return snake;
      }
      snake.unshift(head);
      if (head.x === game.food.x && head.y === game.food.y) {
        if (player === 1) game.leftScore += 1;
        else game.rightScore += 1;
        placeFood();
      } else {
        snake.pop();
      }
      return snake;
    }

    function draw() {
      ctx.clearRect(0, 0, 960, 540);
      ctx.fillStyle = '#06100f';
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(game.food.x * size, game.food.y * size, size, size);
      ctx.fillStyle = '#86efac';
      game.p1.forEach((part) => ctx.fillRect(part.x * size, part.y * size, size - 2, size - 2));
      ctx.fillStyle = '#93c5fd';
      game.p2.forEach((part) => ctx.fillRect(part.x * size, part.y * size, size - 2, size - 2));
    }

    function step() {
      if (game.over) return;
      handleKeys();
      game.p1 = moveSnake(game.p1, game.d1, 1);
      if (!game.over) game.p2 = moveSnake(game.p2, game.d2, 2);
      setScores(game.leftScore, game.rightScore);
      draw();
    }

    function keydown(event) {
      keys[event.code] = true;
    }
    function keyup(event) {
      keys[event.code] = false;
    }
    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'up') setDir(1, 0, -1);
        if (action === 'down') setDir(1, 0, 1);
        if (action === 'left') setDir(1, -1, 0);
        if (action === 'right') setDir(1, 1, 0);
      });
    });
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    game.timer = window.setInterval(step, cfg.tick || 145);
    state.cleanup = () => {
      window.clearInterval(game.timer);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
    };
    setStatus('Race started', modeLabels[state.mode]);
    draw();
  }

  function startDodger() {
    const { canvas, ctx } = canvasBase([
      'Player 1: Arrow keys or WASD to move.',
      state.mode === 'two' ? 'Player 2: I/J/K/L.' : 'AI moves beside you.',
      'Catch green items and avoid red hazards.'
    ]);
    const keys = {};
    const player = { x: 250, y: 430, s: 32 };
    const rival = { x: 650, y: 430, s: 32 };
    const items = [];
    let timer = 0;
    let raf = 0;
    let lastSpawn = 0;

    function spawn(now) {
      if (now - lastSpawn < (cfg.spawn || 540)) return;
      lastSpawn = now;
      items.push({
        x: Math.random() * 900 + 30,
        y: -30,
        r: Math.random() < 0.72 ? 'good' : 'bad',
        v: 2.2 + Math.random() * (cfg.speed || 3)
      });
    }

    function moveActor(actor, up, down, left, right) {
      if (keys[up]) actor.y -= 6;
      if (keys[down]) actor.y += 6;
      if (keys[left]) actor.x -= 6;
      if (keys[right]) actor.x += 6;
      actor.x = clamp(actor.x, 20, 908);
      actor.y = clamp(actor.y, 20, 488);
    }

    function tick(now) {
      spawn(now);
      moveActor(player, 'KeyW', 'KeyS', 'KeyA', 'KeyD');
      moveActor(player, 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight');
      if (state.mode === 'two') moveActor(rival, 'KeyI', 'KeyK', 'KeyJ', 'KeyL');
      else {
        const target = items.find((item) => item.r === 'good') || items[0];
        if (target) {
          rival.x += clamp(target.x - rival.x, -4.5, 4.5);
          rival.y += clamp(target.y - rival.y, -3.2, 3.2);
        }
      }
      items.forEach((item) => { item.y += item.v; });
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const item = items[i];
        const hit1 = Math.hypot(item.x - player.x, item.y - player.y) < 34;
        const hit2 = Math.hypot(item.x - rival.x, item.y - rival.y) < 34;
        if (hit1 || hit2 || item.y > 580) {
          if (hit1) state.scores[0] += item.r === 'good' ? 1 : -1;
          if (hit2) state.scores[1] += item.r === 'good' ? 1 : -1;
          items.splice(i, 1);
          setScores(state.scores[0], state.scores[1]);
        }
      }
      ctx.clearRect(0, 0, 960, 540);
      ctx.fillStyle = '#06100f';
      ctx.fillRect(0, 0, 960, 540);
      items.forEach((item) => {
        ctx.fillStyle = item.r === 'good' ? '#86efac' : '#fb7185';
        ctx.beginPath();
        ctx.arc(item.x, item.y, 14, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = '#bbf7d0';
      ctx.fillRect(player.x - 16, player.y - 16, 32, 32);
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(rival.x - 16, rival.y - 16, 32, 32);
      timer = Math.max(0, timer - 1 / 60);
      if (timer <= 0) {
        setStatus('Round over', state.scores[0] === state.scores[1] ? 'Draw.' : `${state.scores[0] > state.scores[1] ? 'Player 1' : (state.mode === 'ai' ? 'AI' : 'Player 2')} wins.`);
      } else {
        raf = requestAnimationFrame(tick);
      }
    }

    function keydown(event) { keys[event.code] = true; }
    function keyup(event) { keys[event.code] = false; }
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    state.cleanup = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
    };
    timer = cfg.seconds || 45;
    setScores(0, 0);
    setStatus('Round started', 'Collect green. Avoid red.');
    raf = requestAnimationFrame(tick);
  }

  function startTap() {
    const panel = el('play-panel');
    panel.innerHTML = `<div class="target-stage" id="target-stage"><button type="button" class="tap-target" id="tap-target"></button></div>`;
    const stage = el('target-stage');
    const target = el('tap-target');
    let timeLeft = cfg.seconds || 20;
    let timer = 0;
    let aiTimer = 0;
    setHelp([
      'Tap the glowing target as fast as possible.',
      state.mode === 'two' ? 'Player 2 can press L for points.' : 'AI taps automatically after a short delay.',
      'Keyboard: A for Player 1, L for Player 2.'
    ]);

    function moveTarget() {
      const x = Math.random() * Math.max(1, stage.clientWidth - 90);
      const y = Math.random() * Math.max(1, stage.clientHeight - 90);
      target.style.left = `${x}px`;
      target.style.top = `${y}px`;
    }

    function point(player) {
      state.scores[player - 1] += 1;
      setScores(state.scores[0], state.scores[1]);
      moveTarget();
    }

    function keydown(event) {
      if (event.code === 'KeyA' || event.code === 'Space') point(1);
      if (state.mode === 'two' && event.code === 'KeyL') point(2);
    }

    target.addEventListener('click', () => point(1));
    window.addEventListener('keydown', keydown);
    timer = window.setInterval(() => {
      timeLeft -= 1;
      setStatus(`${timeLeft}s left`, 'Hit the target.');
      if (timeLeft <= 0) {
        window.clearInterval(timer);
        window.clearInterval(aiTimer);
        setStatus('Round over', state.scores[0] === state.scores[1] ? 'Draw.' : `${state.scores[0] > state.scores[1] ? 'Player 1' : (state.mode === 'ai' ? 'AI' : 'Player 2')} wins.`);
      }
    }, 1000);
    if (state.mode === 'ai') {
      aiTimer = window.setInterval(() => point(2), cfg.aiDelay || 1250);
    }
    state.cleanup = () => {
      window.clearInterval(timer);
      window.clearInterval(aiTimer);
      window.removeEventListener('keydown', keydown);
    };
    setScores(0, 0);
    moveTarget();
    setStatus(`${timeLeft}s left`, modeLabels[state.mode]);
  }

  shell();
  boot();
}());
