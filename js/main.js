import { CONFIG, COLOR_LIST } from './config.js';
import { GameLogic } from './logic.js';

const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

/* ============================================================
   画面切り替えユーティリティ
   ============================================================ */
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

/* ============================================================
   GameBoard クラス
   物理演算フィールドを 1 つ管理する
   ============================================================ */
class GameBoard {
    constructor(id, elementId, character, gameManager) {
        this.id          = id;
        this.elementId   = elementId;
        this.character   = character;
        this.gameManager = gameManager;

        this.score        = 0;
        this.skillGauge   = 0;
        this.ojyamaPool   = 0;
        this.nextType     = this.getRandomType();
        this.isProcessing = false;
        this.isDroppingOjyama = false;
        this.gameStarted  = false;
        this.opponentBoard = null;

        this.chainCount          = 0;
        this.totalClearedThisTurn = 0;

        this.cpuTimer      = null;
        this.cpuSkillTimer = null;
        this.deadlineTimer = null;

        // DOM
        this.canvasWrapper    = document.getElementById(elementId);
        this.scoreElement     = document.getElementById(`${id}-score`);
        this.nextElement      = document.getElementById(`${id}-next-type`);
        this.ojyamaElement    = document.getElementById(`${id}-ojyama-count`);
        this.skillBarElement  = document.getElementById(`${id}-skill-bar`);
        this.skillBtnElement  = document.getElementById(`${id}-skill-btn`);

        if (this.skillBarElement) {
            this.skillBarElement.style.width = '0%';
            this.skillBarElement.classList.remove('ready');
        }
        if (this.skillBtnElement) {
            this.skillBtnElement.disabled = true;
        }

        // 物理エンジン
        this.engine = Engine.create({ gravity: { y: CONFIG.GAME.GRAVITY } });
        this.world  = this.engine.world;
        this.logic  = new GameLogic(this.world);

        this._initPhysics();
        this._updateAllUI();
    }

    /* ---- 物理初期化 ---- */
    _initPhysics() {
        const el = this.canvasWrapper;
        const w  = el.clientWidth  || CONFIG.GAME.WIDTH;
        const h  = el.clientHeight || CONFIG.GAME.HEIGHT;

        this.render = Render.create({
            element: el,
            engine : this.engine,
            options: {
                width      : w,
                height     : h,
                wireframes : false,
                background : 'transparent',
                hasBounds  : true,
            }
        });

        // 物理世界 ↔ Canvas 座標のマッピング（物理世界は常に CONFIG サイズ）
        Render.lookAt(this.render, {
            min: { x: 0, y: 0 },
            max: { x: CONFIG.GAME.WIDTH, y: CONFIG.GAME.HEIGHT }
        });

        Render.run(this.render);
        this.runner = Runner.create();
        Runner.run(this.runner, this.engine);

        /* 境界（壁・床） */
        const pw = CONFIG.GAME.WIDTH;
        const ph = CONFIG.GAME.HEIGHT;
        const wt = 80; // 壁の厚み

        Composite.add(this.world, [
            Bodies.rectangle(pw / 2, ph + wt / 2, pw, wt, { isStatic: true, render: { visible: false } }),
            Bodies.rectangle(-wt / 2, ph / 2, wt, ph * 2, { isStatic: true, render: { visible: false } }),
            Bodies.rectangle(pw + wt / 2, ph / 2, wt, ph * 2, { isStatic: true, render: { visible: false } }),
        ]);

        /* 毎フレーム後処理 */
        Events.on(this.engine, 'afterUpdate', () => {
            if (this.gameStarted && !this.gameManager.isGameOver) {
                this._gameLoop();
                this._checkGameOver();
            }
        });
    }

    /* ---- ゲームループ ---- */
    _gameLoop() {
        if (this.isProcessing || this.isDroppingOjyama) return;

        const toRemove = this.logic.checkChains();
        if (toRemove.length > 0) {
            this.isProcessing = true;
            this.chainCount++;
            this.totalClearedThisTurn += toRemove.filter(b => b.label !== 'ojyama').length;
            this._removeBodies(toRemove);
        } else {
            if (this.chainCount > 0) {
                this._sendOjyama();
                this.chainCount           = 0;
                this.totalClearedThisTurn = 0;
            }
            if (this.ojyamaPool > 0) {
                this._dropOjyama();
            }
        }
    }

    /* ---- コマ消去 ---- */
    _removeBodies(bodies) {
        const normalCount = bodies.filter(b => b.label !== 'ojyama').length;
        const ojyamaCount = bodies.filter(b => b.label === 'ojyama').length;

        this.score += normalCount * 10 + ojyamaCount * 5;
        this.scoreElement.innerText = this.score;

        // スキルゲージ加算
        this.skillGauge = Math.min(CONFIG.GAME.SKILL_MAX, this.skillGauge + normalCount * 4);
        this._updateSkillGaugeUI();

        // 縮小アニメーション
        let frame = 0;
        const shrink = setInterval(() => {
            bodies.forEach(b => { if (b && b.position) Body.scale(b, 0.78, 0.78); });
            if (++frame >= 7) {
                clearInterval(shrink);
                bodies.forEach(b => Composite.remove(this.world, b));
                setTimeout(() => {
                    this.isProcessing = false;
                    this._gameLoop();
                }, 80);
            }
        }, 28);
    }

    /* ---- お邪魔送信 ---- */
    _sendOjyama() {
        if (!this.opponentBoard) return;
        let count = 0;
        if (this.totalClearedThisTurn >= CONFIG.GAME.OJYAMA_SEND_THRESHOLD)
            count += this.totalClearedThisTurn - CONFIG.GAME.OJYAMA_SEND_THRESHOLD + 1;
        if (this.chainCount >= 2)
            count += (this.chainCount - 1) * 3;
        if (count > 0) this.opponentBoard.receiveOjyama(count);
    }

    receiveOjyama(count) {
        this.ojyamaPool += count;
        this._updateOjyamaUI();
    }

    /* ---- お邪魔落下 ---- */
    _dropOjyama() {
        this.isDroppingOjyama = true;
        this.isProcessing     = true;

        const drop = Math.min(5, this.ojyamaPool);
        this.ojyamaPool -= drop;
        this._updateOjyamaUI();

        let dropped = 0;
        const iv = setInterval(() => {
            if (!this.gameStarted || this.gameManager.isGameOver) { clearInterval(iv); return; }
            const x = Math.random() * (CONFIG.GAME.WIDTH - 60) + 30;
            this._spawnBody(x, -20, CONFIG.COLORS.OJYAMA);
            if (++dropped >= drop) {
                clearInterval(iv);
                setTimeout(() => {
                    this.isDroppingOjyama = false;
                    this.isProcessing     = false;
                    this._gameLoop();
                }, 600);
            }
        }, 150);
    }

    /* ---- コマ投入（プレイヤー操作） ---- */
    spawnPuyo(x) {
        if (!this.gameStarted || this.gameManager.isGameOver) return;
        const type = this.nextType;
        this.nextType = this.getRandomType();
        this._updateNextUI();
        this._spawnBody(x, 40, type);
    }

    /* ---- 物理ボディ生成 ---- */
    _spawnBody(x, y, type) {
        const r     = CONFIG.GAME.PUYO_SIZE;     // 半径 20
        const scale = (r * 2) / 128;             // 画像 128px → 40px

        const body = Bodies.circle(x, y, r, {
            restitution: 0.22,
            friction   : 0.09,
            density    : 0.001,
            angle      : Math.random() * Math.PI * 2,
            render     : {
                sprite: {
                    texture: type.image,
                    xScale : scale,
                    yScale : scale
                }
            },
            label: type.id
        });

        Body.setVelocity(body, { x: (Math.random() - 0.5) * 1.2, y: 0 });
        Composite.add(this.world, body);
    }

    /* ---- スキル発動 ---- */
    useSkill() {
        if (this.skillGauge < CONFIG.GAME.SKILL_MAX || !this.gameStarted || this.gameManager.isGameOver) return;

        this.skillGauge = 0;
        this._updateSkillGaugeUI();
        this._showCutIn();
        this.isProcessing = true;

        setTimeout(() => {
            if (!this.gameStarted || this.gameManager.isGameOver) return;

            if (this.character.id === 'elfin') {
                /* ---- エルフィン「魔弾の暴走」---- */
                const targetColor = CONFIG.COLORS.GREEN;
                const targets = this.world.bodies
                    .filter(b => !b.isStatic && b.label !== 'ojyama' && b.label !== targetColor.id)
                    .sort(() => 0.5 - Math.random());
                const count = Math.max(3, Math.min(targets.length, Math.ceil(targets.length * 0.4)));
                for (let i = 0; i < count; i++) {
                    targets[i].label                      = targetColor.id;
                    targets[i].render.sprite.texture      = targetColor.image;
                }
                this.isProcessing = false;
                this._gameLoop();

            } else if (this.character.id === 'velita') {
                /* ---- ベリータ「ディメンションバースト」---- */
                const blastPoints = 3;
                const blastRadius = 70;
                const toRemove    = new Set();

                for (let i = 0; i < blastPoints; i++) {
                    const rx = Math.random() * (CONFIG.GAME.WIDTH  - 100) + 50;
                    const ry = Math.random() * (CONFIG.GAME.HEIGHT - 180) + 120;
                    this.logic.getBodiesInRadius(rx, ry, blastRadius).forEach(b => toRemove.add(b));
                }

                const list = [...toRemove];
                if (list.length > 0) {
                    this._removeBodies(list);
                } else {
                    this.isProcessing = false;
                    this._gameLoop();
                }
            }
        }, 1900);
    }

    _showCutIn() {
        const layer = document.getElementById('cut-in');
        document.getElementById('cut-in-img').src       = this.character.image;
        document.getElementById('cut-in-char-name').innerText  = this.character.name;
        document.getElementById('cut-in-skill-name').innerText = this.character.skill + '！';

        // アニメーションを再生させるためにクラスを付け直す
        layer.classList.remove('hidden');
        // DOM 強制再描画
        void layer.offsetWidth;

        setTimeout(() => layer.classList.add('hidden'), 2000);
    }

    /* ---- ゲームオーバー判定 ---- */
    _checkGameOver() {
        const dead = this.world.bodies.some(b =>
            !b.isStatic && b.position.y < CONFIG.GAME.DEADLINE && b.speed < 0.2
        );

        if (dead) {
            if (!this.deadlineTimer) {
                this.deadlineTimer = setTimeout(() => {
                    this.gameManager.triggerGameOver(this.id);
                }, 2000);
            }
        } else {
            if (this.deadlineTimer) {
                clearTimeout(this.deadlineTimer);
                this.deadlineTimer = null;
            }
        }
    }

    /* ---- CPU AI ---- */
    startCpuAI() {
        const dropLoop = () => {
            if (!this.gameStarted || this.gameManager.isGameOver) return;
            if (!this.isProcessing && !this.isDroppingOjyama) {
                this.spawnPuyo(this._cpuDecideX());
            }
            this.cpuTimer = setTimeout(dropLoop, Math.random() * 800 + 1300);
        };
        this.cpuTimer = setTimeout(dropLoop, 2000);

        const skillLoop = () => {
            if (!this.gameStarted || this.gameManager.isGameOver) return;
            if (this.skillGauge >= CONFIG.GAME.SKILL_MAX) {
                setTimeout(() => this.useSkill(), 500);
            }
            this.cpuSkillTimer = setTimeout(skillLoop, 500);
        };
        this.cpuSkillTimer = setTimeout(skillLoop, 1000);
    }

    _cpuDecideX() {
        const same = this.world.bodies.filter(b => !b.isStatic && b.label === this.nextType.id);
        let x;
        if (same.length > 0) {
            same.sort((a, b) => a.position.y - b.position.y);
            x = same[0].position.x;
        } else {
            const any = this.world.bodies.filter(b => !b.isStatic && b.label !== 'ojyama');
            x = (any.length > 0 && Math.random() < 0.5)
                ? any.sort((a, b) => a.position.y - b.position.y)[0].position.x
                : Math.random() * (CONFIG.GAME.WIDTH - 100) + 50;
        }
        x += (Math.random() - 0.5) * 38;
        return Math.max(30, Math.min(CONFIG.GAME.WIDTH - 30, x));
    }

    /* ---- 停止 ---- */
    stop() {
        this.gameStarted = false;
        clearTimeout(this.cpuTimer);
        clearTimeout(this.cpuSkillTimer);
        clearTimeout(this.deadlineTimer);
        Engine.clear(this.engine);
        if (this.render) Render.stop(this.render);
        if (this.runner) Runner.stop(this.runner);
    }

    /* ---- ユーティリティ ---- */
    getRandomType() {
        return COLOR_LIST[Math.floor(Math.random() * COLOR_LIST.length)];
    }

    _updateAllUI() {
        this.scoreElement.innerText = this.score;
        this._updateNextUI();
        this._updateOjyamaUI();
        this._updateSkillGaugeUI();
    }

    _updateNextUI() {
        if (!this.nextElement) return;
        this.nextElement.innerText    = this.nextType.id.toUpperCase();
        this.nextElement.style.color  = this.nextType.color;
    }

    _updateOjyamaUI() {
        if (!this.ojyamaElement) return;
        this.ojyamaElement.innerText = this.ojyamaPool;
        this.ojyamaElement.parentElement.style.animation =
            this.ojyamaPool > 0 ? 'skillPulse 0.4s infinite alternate' : 'none';
    }

    _updateSkillGaugeUI() {
        if (!this.skillBarElement) return;
        const pct = (this.skillGauge / CONFIG.GAME.SKILL_MAX) * 100;
        this.skillBarElement.style.width = `${pct}%`;
        const ready = this.skillGauge >= CONFIG.GAME.SKILL_MAX;
        this.skillBarElement.classList.toggle('ready', ready);
        if (this.skillBtnElement) this.skillBtnElement.disabled = !ready;
    }
}

/* ============================================================
   メインコントローラー
   ============================================================ */
class MotiMotiPanicBattle {
    constructor() {
        this.isGameOver   = false;
        this.playerBoard  = null;
        this.cpuBoard     = null;

        this._initTitleScreen();
        this._initSelectScreen();
        // バトル画面のイベントは _startGame() 後に設定
    }

    /* ---- タイトル画面 ---- */
    _initTitleScreen() {
        document.getElementById('btn-start').addEventListener('click', () => {
            showScreen('screen-select');
        });

        document.getElementById('btn-howto').addEventListener('click', () => {
            document.getElementById('howto-overlay').classList.remove('hidden');
        });

        document.getElementById('btn-howto-close').addEventListener('click', () => {
            document.getElementById('howto-overlay').classList.add('hidden');
        });
    }

    /* ---- キャラ選択画面 ---- */
    _initSelectScreen() {
        document.getElementById('btn-back-title').addEventListener('click', () => {
            showScreen('screen-title');
        });

        const charList = document.getElementById('char-list');
        charList.innerHTML = '';

        CONFIG.CHARACTERS.forEach(char => {
            const card = document.createElement('div');
            card.className = 'char-card';
            card.innerHTML = `
                <div class="char-card-img-container">
                    <img src="${char.image}" alt="${char.name}" class="char-card-img" loading="lazy">
                </div>
                <h3>${char.name}</h3>
                <span class="skill-badge">⚡ ${char.skill}</span>
                <div class="skill-desc">${char.description}</div>
            `;
            card.addEventListener('click', () => this._startGame(char));
            charList.appendChild(card);
        });
    }

    /* ---- ゲーム開始 ---- */
    _startGame(playerChar) {
        if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
        // 既存ボードが残っていたら停止・クリア
        if (this.playerBoard) { this.playerBoard.stop(); this.playerBoard = null; }
        if (this.cpuBoard)    { this.cpuBoard.stop();    this.cpuBoard    = null; }
        this.isGameOver = false;

        // CPU キャラは選ばれなかった方
        const cpuChar = CONFIG.CHARACTERS.find(c => c.id !== playerChar.id);

        // バトル画面に切り替え（この後 clientWidth/Height が確定する）
        showScreen('screen-battle');

        // canvas ラッパーをリセット（前回の canvas のみを除去し、カットイン等の静的HTML構造は維持する）
        ['player-canvas', 'cpu-canvas'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const canvas = el.querySelector('canvas');
                if (canvas) canvas.remove();
            }
        });

        // キャラ情報を UI に反映
        document.getElementById('player-char-img').src         = playerChar.image;
        document.getElementById('player-char-name').innerText  = playerChar.name;
        document.getElementById('cpu-char-img').src            = cpuChar.image;
        document.getElementById('cpu-char-name').innerText     = cpuChar.name;

        // DOM が描画され clientWidth が確定するのを 1 フレーム待つ
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.playerBoard = new GameBoard('player', 'player-canvas', playerChar, this);
                this.cpuBoard    = new GameBoard('cpu',    'cpu-canvas',    cpuChar,    this);

                this.playerBoard.opponentBoard = this.cpuBoard;
                this.cpuBoard.opponentBoard    = this.playerBoard;

                this.playerBoard.gameStarted = true;
                this.cpuBoard.gameStarted    = true;

                this.cpuBoard.startCpuAI();

                this._initBattleEvents();
            });
        });
    }

    /* ---- バトル画面のイベント ---- */
    _initBattleEvents() {
        /* プレイヤーのクリック入力 */
        const playerCanvas = document.getElementById('player-canvas');
        playerCanvas.onmousedown = (e) => {
            if (this.isGameOver || !this.playerBoard) return;
            if (this.playerBoard.isProcessing || this.playerBoard.isDroppingOjyama) return;

            const rect     = playerCanvas.getBoundingClientRect();
            const physicsX = ((e.clientX - rect.left) / rect.width) * CONFIG.GAME.WIDTH;
            const clampedX = Math.max(30, Math.min(CONFIG.GAME.WIDTH - 30, physicsX));
            this.playerBoard.spawnPuyo(clampedX);
        };

        /* タッチ操作 */
        playerCanvas.ontouchstart = (e) => {
            e.preventDefault();
            if (this.isGameOver || !this.playerBoard) return;
            if (this.playerBoard.isProcessing || this.playerBoard.isDroppingOjyama) return;

            const rect     = playerCanvas.getBoundingClientRect();
            const touch    = e.touches[0];
            const physicsX = ((touch.clientX - rect.left) / rect.width) * CONFIG.GAME.WIDTH;
            const clampedX = Math.max(30, Math.min(CONFIG.GAME.WIDTH - 30, physicsX));
            this.playerBoard.spawnPuyo(clampedX);
        };

        /* スペースキー → スキル */
        const onKey = (e) => {
            if (e.code === 'Space' && !this.isGameOver && this.playerBoard) {
                e.preventDefault();
                this.playerBoard.useSkill();
            }
        };
        if (window._motiKeyHandler) window.removeEventListener('keydown', window._motiKeyHandler);
        window._motiKeyHandler = onKey;
        window.addEventListener('keydown', onKey);

        /* スキルボタン */
        document.getElementById('player-skill-btn').onclick = () => {
            if (!this.isGameOver && this.playerBoard) this.playerBoard.useSkill();
        };

        /* リザルト → リスタート */
        document.getElementById('restart-btn').onclick = () => {
            document.getElementById('result-overlay').classList.add('hidden');
            // 同じキャラで再戦
            if (this.playerBoard) this._startGame(this.playerBoard.character);
        };

        /* リザルト → キャラ選択へ */
        document.getElementById('btn-back-select').onclick = () => {
            document.getElementById('result-overlay').classList.add('hidden');
            if (this.playerBoard) { this.playerBoard.stop(); this.playerBoard = null; }
            if (this.cpuBoard)    { this.cpuBoard.stop();    this.cpuBoard    = null; }
            showScreen('screen-select');
        };
    }

    /* ---- ゲームオーバー判定 ---- */
    triggerGameOver(loserId) {
        if (this.isGameOver) return;
        this.isGameOver = true;

        if (this.playerBoard) this.playerBoard.stop();
        if (this.cpuBoard)    this.cpuBoard.stop();

        const playerWon = (loserId === 'cpu');
        const titleEl   = document.getElementById('result-title');

        if (playerWon) {
            titleEl.innerText    = '🎉 YOU WIN!';
            titleEl.style.color  = 'var(--accent-pink)';
        } else {
            titleEl.innerText    = '💀 YOU LOSE...';
            titleEl.style.color  = '#888';
        }

        document.getElementById('result-player-score').innerText = this.playerBoard?.score ?? 0;
        document.getElementById('result-cpu-score').innerText    = this.cpuBoard?.score    ?? 0;

        const oppNameEl = document.getElementById('result-opponent-name');
        if (oppNameEl) {
            oppNameEl.innerText = 'CPU';
        }

        document.getElementById('result-overlay').classList.remove('hidden');
    }
}

/* ---- 起動 ---- */
window.addEventListener('load', () => new MotiMotiPanicBattle());
