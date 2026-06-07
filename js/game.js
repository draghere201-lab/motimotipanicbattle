/* ================================================================
   トリッカルもちもちパニックバトル - game.js (落下パズル・ビジュアル強化版)
   ================================================================ */

/* ---- 定数設定 ---- */
const CONFIG = {
    COLORS: {
        RED:    { id: 'red',    color: '#ff4d6d', image: 'assets/puyo/red.png' },
        BLUE:   { id: 'blue',   color: '#00f5ff', image: 'assets/puyo/cyan.png' },
        GREEN:  { id: 'green',  color: '#39ff14', image: 'assets/puyo/green.png' },
        PURPLE: { id: 'purple', color: '#bd00ff', image: 'assets/puyo/purple.png' },
        YELLOW: { id: 'yellow', color: '#ffe600', image: 'assets/puyo/yellow.png' },
        OJYAMA: { id: 'ojyama', color: '#a0a0a0', image: 'assets/puyo/ojyama.png' }
    },
    GAME: {
        WIDTH:  480, // フィールド幅を 360 ➔ 420 ➔ 480 に拡大して見やすく！
        HEIGHT: 600, // フィールド高さを 550 ➔ 600 に拡大して見やすく！
        PUYO_SIZE: 35, // コマをさらに大きく 30 ➔ 35 (直径 70px) に拡大しイラストを際立たせる！
        GRAVITY: 1.0,
        MIN_CHAIN: 5,
        DEADLINE: 90, // デッドライン高さを 80 ➔ 90 に微調整
        SKILL_MAX: 100,
        OJYAMA_SEND_THRESHOLD: 5,
        DROP_SPEED: 2.0 // 落下速度
    },
    CHARACTERS: [
        {
            id: 'elfin', name: 'エルフィン', skill: '魔弾の暴走',
            description: 'フィールド上のランダムなコマを緑に変える！大量連鎖のチャンス！',
            image: 'assets/char/エルフィン.png', color: '#39ff14'
        },
        {
            id: 'velita', name: 'ベリータ', skill: 'ディメンションバースト',
            description: '数カ所を爆破し、範囲内のコマを一斉に消去！ピンチ脱出に最適！',
            image: 'assets/char/ベリータ.png', color: '#bd00ff'
        }
    ]
};

const COLOR_LIST = [
    CONFIG.COLORS.RED, CONFIG.COLORS.BLUE, CONFIG.COLORS.GREEN,
    CONFIG.COLORS.PURPLE, CONFIG.COLORS.YELLOW
];

/* ---- Matter.js エイリアス ---- */
const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

/* ================================================================
   PRNG - 擬似乱数生成器 (落下コマを共通化するため)
   ================================================================ */
class PRNG {
    constructor(seed) {
        this.a = seed !== null && seed !== undefined ? seed : Math.floor(Math.random() * 2147483647);
    }
    next() {
        var t = this.a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
}

/* ================================================================
   画像プリロード＆サウンドマネージャー
   ================================================================ */
const imageCache = {};
function preloadImages(callback) {
    let loaded = 0;
    const sources = {};
    CONFIG.CHARACTERS.forEach(c => { sources[c.id] = c.image; });
    Object.keys(CONFIG.COLORS).forEach(k => {
        sources[CONFIG.COLORS[k].id] = CONFIG.COLORS[k].image;
    });

    const total = Object.keys(sources).length;
    if (total === 0) {
        if (callback) callback();
        return;
    }

    for (let id in sources) {
        const img = new Image();
        img.src = sources[id];
        img.onload = () => {
            imageCache[id] = img;
            loaded++;
            if (loaded === total && callback) callback();
        };
        img.onerror = () => {
            console.error("Failed to load image: " + sources[id]);
            imageCache[id] = new Image();
            loaded++;
            if (loaded === total && callback) callback();
        };
    }
}

class SoundManager {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playMove() {
        try {
            this.init();
            const ctx = this.ctx;
            if (ctx.state === 'suspended') ctx.resume();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);

            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.08);
        } catch(e) {}
    }

    playRotate() {
        try {
            this.init();
            const ctx = this.ctx;
            if (ctx.state === 'suspended') ctx.resume();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(350, now);
            osc.frequency.exponentialRampToValueAtTime(850, now + 0.1);

            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.12);
        } catch(e) {}
    }

    playLand() {
        try {
            this.init();
            const ctx = this.ctx;
            if (ctx.state === 'suspended') ctx.resume();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.exponentialRampToValueAtTime(70, now + 0.15);

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.18);
        } catch(e) {}
    }

    playClear(chainCount = 1) {
        try {
            this.init();
            const ctx = this.ctx;
            if (ctx.state === 'suspended') ctx.resume();
            const now = ctx.currentTime;
            
            const baseFreq = 261.63;
            const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];
            const noteIndex = Math.min(scale.length - 1, chainCount - 1);
            const freq = baseFreq * Math.pow(2, scale[noteIndex] / 12);

            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(freq, now);
            osc1.frequency.setValueAtTime(freq * 1.5, now + 0.08);

            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(freq * 2, now);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.4);
            osc2.stop(now + 0.4);
        } catch(e) {}
    }

    playSkill() {
        try {
            this.init();
            const ctx = this.ctx;
            if (ctx.state === 'suspended') ctx.resume();
            const now = ctx.currentTime;
            
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(300, now);
            osc1.frequency.exponentialRampToValueAtTime(1800, now + 0.4);
            gain1.gain.setValueAtTime(0.06, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.45);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(100, now + 0.1);
            osc2.frequency.linearRampToValueAtTime(30, now + 0.7);
            gain2.gain.setValueAtTime(0.01, now);
            gain2.gain.linearRampToValueAtTime(0.12, now + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.1);
            osc2.stop(now + 0.7);
        } catch(e) {}
    }

    playGameOver() {
        try {
            this.init();
            const ctx = this.ctx;
            if (ctx.state === 'suspended') ctx.resume();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.linearRampToValueAtTime(60, now + 0.8);

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.85);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.85);
        } catch(e) {}
    }

    playCountdown() {
        try {
            this.init();
            const ctx = this.ctx;
            if (ctx.state === 'suspended') ctx.resume();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.15);
        } catch(e) {}
    }

    playGo() {
        try {
            this.init();
            const ctx = this.ctx;
            if (ctx.state === 'suspended') ctx.resume();
            const now = ctx.currentTime;
            [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, now + i * 0.06);
                gain.gain.setValueAtTime(0.06, now + i * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.06);
                osc.stop(now + i * 0.06 + 0.2);
            });
        } catch(e) {}
    }
}
const sounds = new SoundManager();

/* ================================================================
   VoiceManager - ボイス・セリフ・BGMの再生管理
   ================================================================ */
class VoiceManager {
    constructor() {
        this.bgmAudio = null;
        this.bgmVolume = parseFloat(localStorage.getItem('moti_bgm_vol')) || 0.3;
        this.seVolume  = parseFloat(localStorage.getItem('moti_se_vol'))  || 0.7;
    }

    setBgmVolume(val) {
        this.bgmVolume = Math.max(0, Math.min(1, parseFloat(val)));
        localStorage.setItem('moti_bgm_vol', this.bgmVolume);
        if (this.bgmAudio) {
            this.bgmAudio.volume = this.bgmVolume;
        }
    }

    setSeVolume(val) {
        this.seVolume = Math.max(0, Math.min(1, parseFloat(val)));
        localStorage.setItem('moti_se_vol', this.seVolume);
    }

    play(path, volumeScale = 1.0) {
        try {
            const audio = new Audio(path);
            audio.volume = this.seVolume * volumeScale;
            audio.play().catch(() => {});
        } catch(e) {}
    }

    playChainVoice(charName) {
        const path = `assets/voice/${charName}/chain.mp3`;
        this.play(path, 1.0);
    }

    playSkillVoice(charName) {
        const path = `assets/voice/${charName}/skill.mp3`;
        this.play(path, 1.0);
    }

    playConnectVoice(colorId) {
        // BLUEのIDは'blue'だがファイル名はcyan.mp3
        const name = (colorId === 'blue') ? 'cyan' : colorId;
        const path = `assets/voice/puyo/${name}.mp3`;
        this.play(path, 0.6);
    }

    playOjyamaLandVoice() {
        const path = `assets/voice/puyo/スピキ.mp3`;
        this.play(path, 0.8);
    }

    playSelectVoice(charName) {
        const path = `assets/voice/${charName}/select.mp3`;
        this.play(path, 1.0);
    }

    playWinVoice(charName) {
        const path = `assets/voice/${charName}/win.mp3`;
        this.play(path, 1.0);
    }

    playLoseVoice(charName) {
        const path = `assets/voice/${charName}/lose.mp3`;
        this.play(path, 1.0);
    }

    playBGM(path) {
        if (this.currentBgmPath === path && this.bgmAudio) {
            // 既に同じBGMが再生されている場合は何もしない
            return;
        }
        this.stopBGM();
        this.currentBgmPath = path;
        try {
            this.bgmAudio = new Audio(path);
            this.bgmAudio.loop = true;
            this.bgmAudio.volume = this.bgmVolume;
            this.bgmAudio.play().catch(() => {});
        } catch(e) {}
    }

    stopBGM() {
        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio.currentTime = 0;
            this.bgmAudio = null;
        }
        this.currentBgmPath = null;
    }
}
const voice = new VoiceManager();

/* ================================================================
   NetworkManager - PeerJSを使った通信管理
   ================================================================ */
class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.myId = null;
        this.isHost = false;
        
        // コールバック
        this.onConnected = null;
        this.onData = null;
        this.onError = null;
        this.onClose = null;
    }

    init(callback) {
        // initは便宜上コールバックを呼ぶだけにする（実際の初期化は _tryHostOrJoin で行う）
        if (callback) callback();
    }

    _setupConnection() {
        this.conn.on('open', () => {
            console.log('Connected to: ' + this.conn.peer);
            if (this.onConnected) this.onConnected(this.isHost);
        });

        this.conn.on('data', (data) => {
            if (this.onData) this.onData(data);
        });

        this.conn.on('close', () => {
            console.log('Connection closed');
            if (this.onClose) this.onClose();
            this.disconnect();
        });
        
        this.conn.on('error', (err) => {
            console.error('Connection error:', err);
            if (this.onError) this.onError(err);
        });
    }

    // フリーマッチ：連番ID探索方式
    async searchFreeMatch() {
        return new Promise((resolve) => {
            const prefix = 'motimoti-free-';
            const maxRooms = 20;
            let currentRoomId = 1;

            const tryRoom = () => {
                if (currentRoomId > maxRooms) {
                    alert('現在全てのフリーマッチ部屋が満室です。');
                    if (this.onError) this.onError(new Error('満室'));
                    resolve(false);
                    return;
                }
                const roomId = prefix + currentRoomId;
                this._tryHostOrJoin(roomId, () => {
                    // unavailable 以外のエラー等で失敗した場合は次を試す
                    currentRoomId++;
                    tryRoom();
                });
            };
            tryRoom();
        });
    }

    // あいことばマッチ：指定の部屋IDに接続
    async joinPasswordMatch(password) {
        return new Promise((resolve) => {
            const roomId = 'motimoti-room-' + password;
            this._tryHostOrJoin(roomId, () => {
                alert('通信エラーが発生しました。');
                resolve(false);
            });
        });
    }
    
    _tryHostOrJoin(targetId, onFailNext) {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        let timeoutCheck = null;
        
        // インターネット越しの接続の成功率を上げるため、複数のSTUNサーバーを指定
        const peerOptions = {
            debug: 2,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
                ]
            }
        };
        
        // 1. まず通常のランダムIDで初期化し、ゲストとして接続を試みる
        this.peer = new Peer(peerOptions);
        
        this.peer.on('open', (myRandomId) => {
            this.myId = myRandomId;
            this.isHost = false;
            
            // 対象の部屋に接続を試みる
            console.log('Attempting to join as guest: ' + targetId);
            const c = this.peer.connect(targetId, { reliable: true });
            
            // すぐにconnをセットし、リスナーを登録する（openイベントを逃さないため）
            this.conn = c;
            this._setupConnection();
            
            // 接続に成功した場合（すでにホストが存在した）
            let joined = false;
            
            c.on('open', () => {
                joined = true;
                if (timeoutCheck) clearTimeout(timeoutCheck);
                console.log('Joined room successfully as guest.');
            });
            
            c.on('error', (err) => {
                console.error('Guest connection error:', err);
            });
            
            timeoutCheck = setTimeout(() => {
                if (!joined) {
                    console.log('Guest connection attempt timed out.');
                    // 繋がらなかったら、自分がホストになってみる
                    this.peer.emit('error', { type: 'peer-unavailable' });
                }
            }, 15000); // インターネット越しは時間がかかるため、15秒待機にする
        });
        
        // エラーハンドリング
        this.peer.on('error', (err) => {
            if (timeoutCheck) clearTimeout(timeoutCheck);
            
            if (err.type === 'peer-unavailable') {
                // 相手（ホスト）がまだ存在しない -> 自分がホストになる
                console.log('Room not found. Creating room as host...');
                this.peer.destroy();
                
                // ホストとして対象IDで再初期化
                setTimeout(() => {
                    this.peer = new Peer(targetId, peerOptions);
                    
                    this.peer.on('open', (id) => {
                        this.myId = id;
                        this.isHost = true;
                        console.log('Hosting room: ' + id);
                    });
                    
                    this.peer.on('connection', (c) => {
                        console.log('Guest connected to my hosted room.');
                        this.conn = c;
                        this._setupConnection();
                    });
                    
                    this.peer.on('error', (hostErr) => {
                        if (hostErr.type === 'unavailable-id') {
                            // ちょうど同タイミングで別の人がホストになった場合など
                            if (onFailNext) onFailNext();
                        } else {
                            console.error('Host peer error:', hostErr);
                            if (onFailNext) onFailNext();
                        }
                    });
                }, 500); // 少し待ってから初期化してポート競合を回避
                
            } else {
                console.error('Peer error:', err);
                if (onFailNext) onFailNext();
            }
        });
    }

    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        }
    }

    disconnect() {
        this.onClose = null; // 意図的な切断時にアラートが出ないようにする
        this.onData = null;
        if (this.conn) {
            this.conn.close();
            this.conn = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
    }
}
const net = new NetworkManager();

/* ================================================================
   GameLogic クラス
   ================================================================ */
class GameLogic {
    constructor(world) {
        this.world = world;
    }

    checkChains() {
        const bodies = this.world.bodies.filter(b => !b.isStatic && !b.isActivePiece && b.label !== 'ojyama');
        const checked = new Set();
        const groupsToRemove = [];

        for (const body of bodies) {
            if (checked.has(body.id)) continue;
            const group = [];
            this.findConnected(body, group, checked);
            if (group.length >= CONFIG.GAME.MIN_CHAIN) {
                groupsToRemove.push(...group);
            }
        }

        if (groupsToRemove.length > 0) {
            const ojyamaToRemove = new Set();
            for (const body of groupsToRemove) {
                this.getTouchingBodies(body).forEach(other => {
                    if (other.label === 'ojyama') ojyamaToRemove.add(other);
                });
            }
            groupsToRemove.push(...ojyamaToRemove);
        }

        return groupsToRemove;
    }

    findConnected(body, group, checked) {
        checked.add(body.id);
        group.push(body);
        this.getTouchingBodies(body).forEach(other => {
            if (!checked.has(other.id) && !other.isActivePiece && other.label === body.label) {
                this.findConnected(other, group, checked);
            }
        });
    }

    getTouchingBodies(body) {
        const ps = CONFIG.GAME.PUYO_SIZE;
        const r1 = body.circleRadius || ps;
        return this.world.bodies
            .filter(b => !b.isStatic && b.id !== body.id && !b.isActivePiece)
            .filter(other => {
                const dx = body.position.x - other.position.x;
                const dy = body.position.y - other.position.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const r2 = other.circleRadius || ps;
                return dist <= (r1 + r2) * 1.15;
            });
    }

    getBodiesInRadius(x, y, radius) {
        return this.world.bodies
            .filter(b => !b.isStatic && !b.isActivePiece)
            .filter(b => {
                const dx = b.position.x - x;
                const dy = b.position.y - y;
                return Math.sqrt(dx*dx + dy*dy) <= radius;
            });
    }
}

/* ================================================================
   GameBoard クラス
   ================================================================ */
class GameBoard {
    constructor(id, elementId, character, gameManager, isNetwork = false, sharedSeed = null) {
        this.prng         = new PRNG(sharedSeed);
        this.id           = id;
        this.elementId    = elementId;
        this.character    = character;
        this.gameManager  = gameManager;
        this.isNetwork    = isNetwork;
        this.networkBodies = [];

        this.score        = 0;
        this.skillGauge   = 0;
        this.readyOjyama  = 0;
        this.pendingOjyama = 0;
        this.nextSet      = this._generatePieceSet();
        this.activePiece  = null;
        
        this.isProcessing = false;
        this.isDroppingOjyama = false;
        this.gameStarted  = false;
        this.opponentBoard = null;
        this.vfxEffects    = []; // エフェクト管理用配列

        this.chainCount           = 0;
        this.totalClearedThisTurn = 0;
        this.hasDroppedOjyamaThisTurn = false;
        this.lastLockTime         = 0; // 最後にコマが設置された時刻
        this.sentOjyamaThisTurn   = 0; // 重複送信防止
        this.shakeCount           = 3; // シェイク可能回数

        this.isLeftPressed  = false;
        this.isRightPressed = false;

        this.cpuTimer      = null;
        this.cpuSkillTimer = null;
        this.deadlineTimer = null;
        
        // アクティブチェイン用タイマーとUI
        this.chainTimeLeft = 0;
        this.chainMaxTime = (character && character.chainTime) ? character.chainTime : 5000;
        this.chainActive = false;
        this.lastTime = Date.now();
        this.chainGaugeEl = document.getElementById(`${id}-chain-gauge`);
        this.chainBarEl   = document.getElementById(`${id}-chain-bar`);

        this.canvasWrapper   = document.getElementById(elementId);
        this.scoreElement    = document.getElementById(`${id}-score`);
        this.nextContainer   = document.getElementById(`${id}-next-preview`);
        this.ojyamaElement   = document.getElementById(`${id}-ojyama-icons`);
        this.skillBarElement = document.getElementById(`${id}-skill-bar`);
        this.skillBtnElement = document.getElementById(`${id}-skill-btn`);

        // コマが埋まるのを防ぐため、Matter.jsの物理エンジンのイテレーション回数を増やす（精度向上）
        this.engine = Engine.create({ 
            gravity: { y: CONFIG.GAME.GRAVITY },
            positionIterations: 12, // デフォルト 6 ➔ 12
            velocityIterations: 10  // デフォルト 4 ➔ 10
        });
        this.world  = this.engine.world;
        this.logic  = new GameLogic(this.world);

        this._initPhysics();
        this._updateAllUI();

        // キャラクター立ち絵を自分フィールドの背景に置く
        if (this.character && this.character.image) {
            this.canvasWrapper.style.backgroundImage = `url('${this.character.image}')`;
            this.canvasWrapper.style.backgroundSize = 'contain';
            this.canvasWrapper.style.backgroundPosition = 'center bottom';
            this.canvasWrapper.style.backgroundRepeat = 'no-repeat';
        }

        // フィールド枠の色をキャラクターカラーで設定
        const fieldColor = (this.character && this.character.fieldColor) ? this.character.fieldColor : '#ff65a3';
        const boardContainer = this.canvasWrapper.closest('.board-container');
        if (boardContainer) {
            boardContainer.style.setProperty('--field-color', fieldColor);
            boardContainer.style.borderColor = fieldColor;
            boardContainer.style.boxShadow = `0 0 0 3px ${fieldColor}, 0 8px 32px ${fieldColor}55`;
        }
        this.canvasWrapper.style.borderColor = fieldColor;
        this.canvasWrapper.style.boxShadow = `inset 0 0 0 3px ${fieldColor}88`;
    }

    _initPhysics() {
        const el = this.canvasWrapper;

        this.render = Render.create({
            element: el,
            engine:  this.engine,
            options: { 
                width: CONFIG.GAME.WIDTH, 
                height: CONFIG.GAME.HEIGHT, 
                wireframes: false, 
                background: 'transparent', 
                hasBounds: true 
            }
        });

        Render.lookAt(this.render, {
            min: { x: 0, y: 0 },
            max: { x: CONFIG.GAME.WIDTH, y: CONFIG.GAME.HEIGHT }
        });

        // 描画ループは自前で回すため Render.run(this.render) は呼ばない
        this.runner = Runner.create();
        Runner.run(this.runner, this.engine);

        const pw = CONFIG.GAME.WIDTH;
        const ph = CONFIG.GAME.HEIGHT;
        const wt = 5000;
        const groundHeight = 16; // CSSストライプ床の高さ分、物理床を上げる
        
        this.walls = [
            Bodies.rectangle(pw/2, ph + wt/2 - groundHeight, pw, wt,   { isStatic: true, render: { visible: false }, label: 'wall' }),
            Bodies.rectangle(-wt/2, ph/2, wt, ph*2,     { isStatic: true, render: { visible: false }, label: 'wall' }),
            Bodies.rectangle(pw+wt/2, ph/2, wt, ph*2,   { isStatic: true, render: { visible: false }, label: 'wall' })
        ];
        Composite.add(this.world, this.walls);

        Events.on(this.engine, 'beforeUpdate', () => {
            if (this.gameStarted && !this.gameManager.isGameOver && !this.isNetwork) {
                this._updateActivePiece();
            }
        });

        // スピキ（お邪魔）接地時のボイス判定
        Events.on(this.engine, 'collisionStart', (event) => {
            if (this.isNetwork || !this.gameStarted || this.gameManager.isGameOver) return;
            let newlyLanded = false;
            event.pairs.forEach(pair => {
                const { bodyA, bodyB } = pair;
                // 両方とも操作中のコマでなければ接地とみなす
                if (!bodyA.isActivePiece && !bodyB.isActivePiece) {
                    if (bodyA.label === 'ojyama' && !bodyA.hasLanded) {
                        bodyA.hasLanded = true;
                        newlyLanded = true;
                    }
                    if (bodyB.label === 'ojyama' && !bodyB.hasLanded) {
                        bodyB.hasLanded = true;
                        newlyLanded = true;
                    }
                }
            });
            if (newlyLanded) {
                const now = Date.now();
                if (now - (this.lastOjyamaSoundTime || 0) > 800) {
                    this.lastOjyamaSoundTime = now;
                    voice.playOjyamaLandVoice();
                    sounds.playLand(); // 仮のサウンド
                }
            }
        });

        Events.on(this.engine, 'afterUpdate', () => {
            if (this.gameStarted && !this.gameManager.isGameOver) {
                if (this.isNetwork) return; // ネットワークモードは物理演算をスキップ
                
                // 連結ボイスの判定（1ペアにつき1回のみ、連続再生防止スロットリング付き）
                const pairs = this.getConnectedPairs();
                if (!this.connectedPairsSet) this.connectedPairsSet = new Set();
                
                let newConnection = false;
                let latestColorId = null;
                
                pairs.forEach(p => {
                    const pairId = p.b1.id < p.b2.id ? `${p.b1.id}-${p.b2.id}` : `${p.b2.id}-${p.b1.id}`;
                    if (!this.connectedPairsSet.has(pairId)) {
                        this.connectedPairsSet.add(pairId);
                        newConnection = true;
                        latestColorId = p.colorId;
                    }
                });
                
                const now = Date.now();
                if (newConnection && now - (this.lastConnectSoundTime || 0) > 150) {
                    this.lastConnectSoundTime = now;
                    voice.playConnectVoice(latestColorId);
                    sounds.playLand(); // 仮のサウンド
                }
                
                // 毎フレーム: 定着済みコマのめり込みを強制解消
                this._resolveOverlaps();

                // アクティブチェインタイマーの更新
                const nowTime = Date.now();
                const dt = nowTime - (this.lastTime || nowTime);
                this.lastTime = nowTime;
                
                // 処理中（消去アニメ中や落下中）はタイマーを減らさない
                if (this.chainActive && !this.isProcessing && !this.isDroppingOjyama) {
                    this.chainTimeLeft -= dt;
                    this._updateChainGaugeUI();
                    if (this.chainTimeLeft <= 0) {
                        this.endChain();
                    }
                }

                const allSettled = this.world.bodies.every(b => b.isStatic || b.speed < 0.5);
                
                if (allSettled && !this.activePiece && !this.isProcessing && !this.isDroppingOjyama) {
                    this.restingFrames = (this.restingFrames || 0) + 1;
                } else {
                    this.restingFrames = 0;
                }

                const settleTimeout = (this.lastLockTime > 0 && (Date.now() - this.lastLockTime) > 1500);
                
                // タイムアウト時は全コマを強制停止させる
                if (settleTimeout && !allSettled && !this.activePiece && !this.isProcessing) {
                    this.world.bodies.forEach(b => {
                        if (!b.isStatic && !b.isActivePiece) {
                            Body.setVelocity(b, { x: 0, y: 0 });
                            Body.setAngularVelocity(b, 0);
                        }
                    });
                }
                
                const isResting = (this.restingFrames > 5 || settleTimeout) && 
                                  !this.activePiece && !this.isProcessing && !this.isDroppingOjyama;

                if (isResting) {
                    this.restingFrames = 0;
                    const toRemove = this.logic.checkChains();
                    if (toRemove.length > 0) {
                        this.isProcessing = true;
                        this.chainCount++;
                        this.totalClearedThisTurn += toRemove.filter(b => b.label !== 'ojyama').length;
                        
                        // アクティブチェイン稼働
                        this.chainActive = true;
                        this.chainTimeLeft = this.chainMaxTime;
                        this._updateChainGaugeUI();
                        
                        // その都度お邪魔を送信・相殺する（ツムツム/eスポーツ方式）
                        this._sendOjyama();
                        
                        sounds.playClear(this.chainCount);
                        this._showChainDisplay(this.chainCount);
                        // 消去ボイス再生 (2連鎖以上)
                        if (this.chainCount >= 2) {
                            voice.playChainVoice(this.character.name);
                        }
                        this._removeBodies(toRemove);
                    } else {
                        // 連鎖が発生しなかった時（通常落下時）
                        if (!this.chainActive) {
                            if (this.hasDroppedOjyamaThisTurn) {
                                this.hasDroppedOjyamaThisTurn = false;
                                this.spawnNextPiece();
                            } else if (this.readyOjyama > 0) {
                                this.hasDroppedOjyamaThisTurn = true;
                                this._dropOjyama();
                            } else {
                                this.spawnNextPiece();
                            }
                        } else {
                            // チェイン中はお邪魔を降らせず、すぐに次をスポーン
                            this.spawnNextPiece();
                        }
                    }
                }
                this._checkGameOver();
                
                // プレイヤーの座標データを送信 (軽量化のため2フレームに1回)
                if (this.id === 'player') {
                    this._syncFrameCount = (this._syncFrameCount || 0) + 1;
                    if (this._syncFrameCount % 2 === 0) {
                        net.send({
                            type: 'sync',
                            bodies: this._getSyncData(),
                            score: this.score,
                            ojyama: this.ojyamaPool,
                            skill: this.skillGauge,
                            next: this.nextSet.map(s => s.type.id)
                        });
                    }
                }
            }
            this.draw();
        });
    }

    /* ---- 落下ピース生成・管理 ---- */
    _generatePieceSet() {
        const count = 2;
        const set = [];
        const ps = CONFIG.GAME.PUYO_SIZE * 2;
        
        for (let i = 0; i < count; i++) {
            set.push({
                type: this._randType(),
                rx: 0,
                ry: i * -ps
            });
        }
        return set;
    }

    spawnNextPiece() {
        if (!this.gameStarted || this.gameManager.isGameOver) return;
        
        // 猶予スピキ（予告）を落下準備完了状態に移行
        if (this.pendingOjyama > 0) {
            this.readyOjyama += this.pendingOjyama;
            this.pendingOjyama = 0;
            this._updateOjyamaUI();
        }

        const set = this.nextSet;
        this.nextSet = this._generatePieceSet();
        this._updateNextUI();

        const ps = CONFIG.GAME.PUYO_SIZE;
        const scale = (ps * 2) / 128;
        const startX = CONFIG.GAME.WIDTH / 2;
        const startY = 40;

        const bodies = set.map(item => {
            const b = Bodies.circle(startX + item.rx, startY + item.ry, ps, {
                restitution: 0.25,
                friction: 0.3,
                frictionAir: 0.02, // 空気抵抗を追加して回転・滑りの減衰を早める
                density: 0.003,
                render: { sprite: { texture: item.type.image, xScale: scale, yScale: scale } },
                label: item.type.id,
                isSensor: true
            });
            b.isActivePiece = true;
            b.rx = item.rx;
            b.ry = item.ry;
            return b;
        });

        Composite.add(this.world, bodies);
        
        this.activePiece = {
            bodies: bodies,
            x: startX,
            y: startY
        };
        this.isFastDropping = false; // 高速落下フラグの初期化
        this.lockDelay = 0; // 設置猶予タイマーの初期化
        this.totalLockDelay = 0; // 絶対限界タイマー
    }

    _updateActivePiece() {
        if (!this.activePiece) return;

        // キー入力によるスルスル（滑らか）横移動
        const moveSpeed = 6;
        if (this.isLeftPressed) {
            if (!this._checkCollision(this.activePiece.x - moveSpeed, this.activePiece.y)) {
                this.activePiece.x -= moveSpeed;
                this.lockDelay = 0;
            }
        }
        if (this.isRightPressed) {
            if (!this._checkCollision(this.activePiece.x + moveSpeed, this.activePiece.y)) {
                this.activePiece.x += moveSpeed;
                this.lockDelay = 0;
            }
        }

        // 高速落下の処理
        const dropSpeed = this.isFastDropping ? CONFIG.GAME.DROP_SPEED * 15 : CONFIG.GAME.DROP_SPEED;
        this.activePiece.y += dropSpeed;
        this._syncActivePiecePositions();

        if (this._checkCollision(this.activePiece.x, this.activePiece.y)) {
            this.activePiece.y -= dropSpeed;
            this._syncActivePiecePositions();
            
            // 設置猶予（ロックディレイ）の処理
            this.lockDelay = (this.lockDelay || 0) + 1;
            this.totalLockDelay = (this.totalLockDelay || 0) + 1; // どんなに動かしても蓄積するタイマー
            
            const limit = this.isFastDropping ? 5 : 45; // 通常時は約0.75秒（45フレーム）の猶予
            const maxLimit = 150; // 約2.5秒で強制設置（無限あがき防止）
            
            if (this.lockDelay >= limit || this.totalLockDelay >= maxLimit) {
                this._lockActivePiece();
            }
        } else {
            // 空中を落下中の場合はタイマーをリセット
            this.lockDelay = 0;
        }
    }

    _syncActivePiecePositions() {
        if (!this.activePiece) return;
        this.activePiece.bodies.forEach(b => {
            Body.setPosition(b, {
                x: this.activePiece.x + b.rx,
                y: this.activePiece.y + b.ry
            });
            Body.setVelocity(b, {x:0, y:0});
            Body.setAngularVelocity(b, 0);
        });
    }

    _lockActivePiece() {
        if (!this.activePiece) return;

        // 定着させる前に、他のブロックとのめり込みが完全に解消されるまで上に少しずつ押し戻す
        let safetyCounter = 0;
        while (this._checkCollision(this.activePiece.x, this.activePiece.y) && safetyCounter < 200) {
            this.activePiece.y -= 0.5;
            this._syncActivePiecePositions();
            safetyCounter++;
        }

        this.activePiece.bodies.forEach(b => {
            b.isSensor = false;
            b.isActivePiece = false;
            // ロック時に速度をゼロにして物理エンジンの暴走を防ぐ
            Body.setVelocity(b, { x: 0, y: 0 });
            Body.setAngularVelocity(b, 0);
        });
        this.activePiece = null;
        this.lastLockTime = Date.now(); // 設置時刻を記録
        if (this.id === 'player') {
            sounds.playLand();
        }
    }

    /* ---- 衝突判定 ---- */
    _checkCollision(newX, newY) {
        if (!this.activePiece) return false;
        
        const ps = CONFIG.GAME.PUYO_SIZE;
        for (let b of this.activePiece.bodies) {
            const tx = newX + b.rx;
            const ty = newY + b.ry;
            
            const groundHeight = 16;
            if (ty + ps >= CONFIG.GAME.HEIGHT - groundHeight || tx - ps <= 0 || tx + ps >= CONFIG.GAME.WIDTH) return true;

            const obstacles = this.world.bodies.filter(ob => !ob.isActivePiece && ob.label !== 'wall');
            for (let ob of obstacles) {
                const dx = tx - ob.position.x;
                const dy = ty - ob.position.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const rSum = ps + (ob.circleRadius || ps);
                // 半径合計の95%で衝突判定 → 早めに止めてめり込みを防ぐ
                if (dist < rSum * 0.95) return true;
            }
        }
        return false;
    }

    /* ---- 定着済みコマのめり込み解消 ---- */
    _resolveOverlaps() {
        const ps = CONFIG.GAME.PUYO_SIZE;
        const settled = this.world.bodies.filter(b => !b.isStatic && !b.isActivePiece && b.label !== 'wall');
        
        for (let i = 0; i < settled.length; i++) {
            for (let j = i + 1; j < settled.length; j++) {
                const a = settled[i];
                const b = settled[j];
                const dx = b.position.x - a.position.x;
                const dy = b.position.y - a.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const r1 = a.circleRadius || ps;
                const r2 = b.circleRadius || ps;
                const minDist = (r1 + r2) * 0.92; // 実際に物理的にめり込んでいる場合だけ補正
                
                if (dist > 0 && dist < minDist) {
                    const overlap = minDist - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const push = overlap * 0.5;
                    
                    Body.setPosition(a, {
                        x: a.position.x - nx * push,
                        y: a.position.y - ny * push
                    });
                    Body.setPosition(b, {
                        x: b.position.x + nx * push,
                        y: b.position.y + ny * push
                    });
                }
            }
        }
    }

    /* ---- プレイヤー入力処理 ---- */
    moveLeft() {
        if (!this.activePiece) return;
        const dx = -CONFIG.GAME.PUYO_SIZE;
        if (!this._checkCollision(this.activePiece.x + dx, this.activePiece.y)) {
            this.activePiece.x += dx;
            this._syncActivePiecePositions();
            this.lockDelay = 0; // 移動成功時に猶予をリセット
            if (this.id === 'player') sounds.playMove();
        }
    }

    moveRight() {
        if (!this.activePiece) return;
        const dx = CONFIG.GAME.PUYO_SIZE;
        if (!this._checkCollision(this.activePiece.x + dx, this.activePiece.y)) {
            this.activePiece.x += dx;
            this._syncActivePiecePositions();
            this.lockDelay = 0; // 移動成功時に猶予をリセット
            if (this.id === 'player') sounds.playMove();
        }
    }

    fastDrop() {
        if (!this.activePiece) return;
        this.isFastDropping = true;
    }

    rotate() {
        if (!this.activePiece) return;

        const oldBodies = this.activePiece.bodies.map(b => ({rx: b.rx, ry: b.ry}));
        
        this.activePiece.bodies.forEach(b => {
            const newRx = -b.ry;
            const newRy = b.rx;
            b.rx = newRx;
            b.ry = newRy;
        });

        let success = false;
        const offsets = [0, -CONFIG.GAME.PUYO_SIZE, CONFIG.GAME.PUYO_SIZE, -CONFIG.GAME.PUYO_SIZE*2, CONFIG.GAME.PUYO_SIZE*2];

        for (let ox of offsets) {
            if (!this._checkCollision(this.activePiece.x + ox, this.activePiece.y)) {
                this.activePiece.x += ox;
                success = true;
                break;
            }
        }

        if (success) {
            this._syncActivePiecePositions();
            this.lockDelay = 0; // 回転成功時に猶予をリセット
            if (this.id === 'player') sounds.playRotate();
        } else {
            for (let i=0; i<this.activePiece.bodies.length; i++) {
                this.activePiece.bodies[i].rx = oldBodies[i].rx;
                this.activePiece.bodies[i].ry = oldBodies[i].ry;
            }
        }
    }

    shakeBoard() {
        if (this.shakeCount <= 0 || !this.gameStarted || this.gameManager.isGameOver) return;
        this.shakeCount--;
        
        const btn = document.getElementById(`${this.id}-shake-btn`);
        const countSpan = document.getElementById(`${this.id}-shake-count`);
        if (countSpan) countSpan.innerText = `(残:${this.shakeCount})`;
        if (btn && this.shakeCount <= 0) btn.disabled = true;

        sounds.playSkill();
        
        // 静止していない全てのコマを上に跳ねさせる
        const bodies = this.world.bodies.filter(b => !b.isStatic && !b.isActivePiece);
        bodies.forEach(b => {
            Body.setVelocity(b, { 
                x: (Math.random() - 0.5) * 8, 
                y: -12 - Math.random() * 8 
            });
        });
    }

    /* ---- 連結コマ結合描画 ---- */
    draw() {
        const render = this.render;
        const ctx = render.context;
        const canvas = render.canvas;

        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        
        const bounds = render.bounds;
        const scaleX = canvas.width / (bounds.max.x - bounds.min.x);
        const scaleY = canvas.height / (bounds.max.y - bounds.min.y);
        ctx.scale(scaleX, scaleY);
        ctx.translate(-bounds.min.x, -bounds.min.y);

        const ps = CONFIG.GAME.PUYO_SIZE;
        
        // ユーザー要望「縁取りを縮小してほしい」に応え、黒い枠線の太さを 1 に細線化！
        const strokeWidth = 1; 

        // 全てのコマ（非静的、かつ壁以外のオブジェクト）またはネットワーク受信データ
        const bodies = this.isNetwork ? this.networkBodies : this.world.bodies.filter(b => !b.isStatic && b.label !== 'wall');

        // 枠線と中身カラーを描画する「通常コマのみ」（お邪魔コマを除外）
        const normalBodies = bodies.filter(b => b.label !== 'ojyama');

        // 隣接する同じ色の通常コマのペアを取得（お邪魔コマは除外されている）
        const pairs = this.getConnectedPairs();

        // ---- 1. 太い枠線（通常コマのみ、黒色など）を描画 ----
        ctx.strokeStyle = '#1e1e24';
        ctx.lineWidth = (ps * 2) + strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 連結ブリッジ（太い枠線）
        pairs.forEach(pair => {
            ctx.beginPath();
            ctx.moveTo(pair.b1.position.x, pair.b1.position.y);
            ctx.lineTo(pair.b2.position.x, pair.b2.position.y);
            ctx.stroke();
        });

        // 通常コマのみ枠円を描画
        normalBodies.forEach(b => {
            const r = b.circleRadius || ps;
            ctx.fillStyle = '#1e1e24';
            ctx.beginPath();
            ctx.arc(b.position.x, b.position.y, r + strokeWidth / 2, 0, Math.PI * 2);
            ctx.fill();
        });

        // ---- 2. カラー中身（通常コマのみ）を描画 ----
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = ps * 2;

        // 連結ブリッジ（カラー）
        pairs.forEach(pair => {
            const colorCfg = Object.values(CONFIG.COLORS).find(c => c.id === pair.colorId);
            ctx.strokeStyle = colorCfg ? colorCfg.color : '#ffffff';
            ctx.beginPath();
            ctx.moveTo(pair.b1.position.x, pair.b1.position.y);
            ctx.lineTo(pair.b2.position.x, pair.b2.position.y);
            ctx.stroke();
        });

        // 通常コマのみカラー円を描画
        normalBodies.forEach(b => {
            const r = b.circleRadius || ps;
            const colorCfg = Object.values(CONFIG.COLORS).find(c => c.id === b.label);
            ctx.fillStyle = colorCfg ? colorCfg.color : '#ffffff';
            ctx.beginPath();
            ctx.arc(b.position.x, b.position.y, r, 0, Math.PI * 2);
            ctx.fill();
        });

        // ---- 3. キャラクター画像（スプライト）を描画 ----
        bodies.forEach(b => {
            const r = b.circleRadius || ps;
            const img = imageCache[b.label];
            if (img) {
                ctx.save();
                ctx.translate(b.position.x, b.position.y);
                ctx.rotate(b.angle);
                if (b.label === 'ojyama') {
                    // おじゃまコマは連結・縁取り不要のため、縮小せず元の丸いスプライト画像のまま描画
                    const imgSize = r * 2.0;
                    ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
                } else {
                    // 通常コマはスプライト画像サイズを 1.55 ➔ 1.75 倍に拡大し、フチをより細く綺麗に見せ、顔を大きく表示！
                    const imgSize = r * 1.75;
                    ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
                }
                ctx.restore();
            }

            // エルフィンスキル対象コマの発光エフェクト
            if (b.isSkillTarget) {
                const elapsed = Date.now() - b.skillTimer;
                const r = b.circleRadius || ps;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                
                // 点滅と拡大
                const intensity = Math.abs(Math.sin(elapsed / 100));
                ctx.beginPath();
                ctx.arc(b.position.x, b.position.y, r * 1.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(150, 255, 150, ${0.3 + intensity * 0.4})`;
                ctx.fill();
                
                // 魔法陣っぽい後光
                ctx.beginPath();
                ctx.arc(b.position.x, b.position.y, r * 2.5 - (elapsed % 300) / 10, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(100, 255, 100, ${0.5 - (elapsed % 300) / 600})`;
                ctx.lineWidth = 3;
                ctx.stroke();
                
                ctx.restore();
            }
        });

        // ---- 4. VFXエフェクトの描画 ----
        const now = Date.now();
        this.vfxEffects = this.vfxEffects.filter(eff => {
            const elapsed = now - eff.startTime;
            if (elapsed > eff.duration) return false;
            
            const progress = elapsed / eff.duration; // 0.0 ~ 1.0
            ctx.save();
            ctx.translate(eff.x, eff.y);
            
            if (eff.type === 'marker') {
                // ワインレッドのマーカー（集束していく円）
                ctx.globalCompositeOperation = 'lighter';
                const r = 100 * (1 - progress);
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fillStyle = eff.color;
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(0, 0, 80, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 0, 100, ${progress})`;
                ctx.lineWidth = 2;
                ctx.stroke();
                
            } else if (eff.type === 'explosion') {
                // ワインレッドの爆発（広がる衝撃波）
                ctx.globalCompositeOperation = 'lighter';
                const r = 30 + progress * 150;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                const alpha = 1 - Math.pow(progress, 2);
                ctx.fillStyle = `rgba(255, 50, 100, ${alpha * 0.8})`;
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 100, 150, ${alpha})`;
                ctx.lineWidth = 15 * (1 - progress);
                ctx.stroke();
                
            } else if (eff.type === 'flash') {
                // 緑のフラッシュ（変化完了時）
                ctx.globalCompositeOperation = 'lighter';
                const r = progress * 70;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(100, 255, 100, ${1 - progress})`;
                ctx.fill();
            }
            
            ctx.restore();
            return true;
        });

        ctx.restore();
    }

    getConnectedPairs() {
        // お邪魔コマ（ojyama）は連結対象からあらかじめ除外
        const bodies = this.isNetwork ? this.networkBodies.filter(b => b.label !== 'ojyama') : this.world.bodies.filter(b => !b.isStatic && b.label !== 'wall' && b.label !== 'ojyama');
        const pairs = [];
        const ps = CONFIG.GAME.PUYO_SIZE;
        
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const b1 = bodies[i];
                const b2 = bodies[j];
                
                if (b1.label !== b2.label) continue;
                
                const dx = b1.position.x - b2.position.x;
                const dy = b1.position.y - b2.position.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                const r1 = b1.circleRadius || ps;
                const r2 = b2.circleRadius || ps;
                const threshold = (r1 + r2) * 1.15;
                
                if (dist <= threshold) {
                    pairs.push({ b1, b2, colorId: b1.label });
                }
            }
        }
        
        // 操作中のアクティブピース（2個）
        if (this.activePiece && this.activePiece.bodies.length === 2) {
            const b1 = this.activePiece.bodies[0];
            const b2 = this.activePiece.bodies[1];
            // お邪魔コマでなく、同じ色のときのみ連結ペアに追加
            if (b1.label !== 'ojyama' && b1.label === b2.label) {
                if (!pairs.some(p => (p.b1 === b1 && p.b2 === b2) || (p.b1 === b2 && p.b2 === b1))) {
                    pairs.push({ b1, b2, colorId: b1.label });
                }
            }
        }
        
        return pairs;
    }

    _getSyncData() {
        return this.world.bodies.filter(b => !b.isStatic && b.label !== 'wall').map(b => ({
            position: { x: Math.round(b.position.x), y: Math.round(b.position.y) },
            angle: Number(b.angle.toFixed(2)),
            label: b.label,
            circleRadius: b.circleRadius || CONFIG.GAME.PUYO_SIZE
        }));
    }

    endChain() {
        this.chainActive = false;
        this.chainTimeLeft = 0;
        this.chainCount = 0;
        this.totalClearedThisTurn = 0;
        this.sentOjyamaThisTurn = 0; // 重複送信の防止リセット
        this._updateChainGaugeUI();
        
        // チェインが切れた際、落下準備完了スピキがあれば落下させる
        if (this.readyOjyama > 0 && !this.activePiece && !this.isProcessing) {
            this._dropOjyama();
        }
    }

    /* ---- 消去・スキル処理等 ---- */
    _removeBodies(bodies) {
        const normalCount = bodies.filter(b => b.label !== 'ojyama').length;
        const ojyamaCount = bodies.filter(b => b.label === 'ojyama').length;

        this.score += normalCount * 10 + ojyamaCount * 5;
        if (this.scoreElement) {
            this.scoreElement.innerText = this.score;
            this.scoreElement.classList.remove('pop');
            void this.scoreElement.offsetWidth; // アニメーション再トリガー
            this.scoreElement.classList.add('pop');
        }

        this.skillGauge = Math.min(CONFIG.GAME.SKILL_MAX, this.skillGauge + normalCount * 4);
        this._updateSkillGaugeUI();

        let frame = 0;
        const shrink = setInterval(() => {
            bodies.forEach(b => { try { Body.scale(b, 0.78, 0.78); } catch(e){} });
            if (++frame >= 7) {
                clearInterval(shrink);
                bodies.forEach(b => { try { Composite.remove(this.world, b); } catch(e){} });
                setTimeout(() => {
                    this.isProcessing = false;
                }, 150); // 上のコマが落ち始める（速度がつく）まで少し待つ
            }
        }, 28);
    }

    _sendOjyama() {
        let count = 0;
        if (this.totalClearedThisTurn >= CONFIG.GAME.OJYAMA_SEND_THRESHOLD)
            count += this.totalClearedThisTurn - CONFIG.GAME.OJYAMA_SEND_THRESHOLD + 1;
        if (this.chainCount >= 2)
            count += (this.chainCount - 1) * 3;
            
        // これまでに送信した分を引き算して差分のみを送信（重複バグ修正）
        let newOjyama = count - this.sentOjyamaThisTurn;
        
        if (newOjyama > 0) {
            this.sentOjyamaThisTurn += newOjyama;
            let totalPool = this.readyOjyama + this.pendingOjyama;
            if (totalPool > 0) {
                if (newOjyama >= totalPool) {
                    newOjyama -= totalPool;
                    this.readyOjyama = 0;
                    this.pendingOjyama = 0;
                } else {
                    if (newOjyama >= this.readyOjyama) {
                        newOjyama -= this.readyOjyama;
                        this.readyOjyama = 0;
                        this.pendingOjyama -= newOjyama;
                        newOjyama = 0;
                    } else {
                        this.readyOjyama -= newOjyama;
                        newOjyama = 0;
                    }
                }
                this._updateOjyamaUI();
            }
            if (newOjyama > 0 && this.opponentBoard) {
                if (this.gameManager.gameMode === 'online') {
                    // オンライン対戦時はネットワーク経由で攻撃を送る
                    net.send({ type: 'attack', count: newOjyama });
                } else {
                    // CPU戦時は直接相手の盤面を操作する
                    this.opponentBoard.receiveOjyama(newOjyama);
                }
            }
        }
    }

    receiveOjyama(count) {
        this.pendingOjyama += count;
        this._updateOjyamaUI();
    }

    _dropOjyama() {
        this.isDroppingOjyama = true;
        this.isProcessing = true;

        const drop = Math.min(5, this.readyOjyama);
        this.readyOjyama -= drop;
        this._updateOjyamaUI();

        const ps = CONFIG.GAME.PUYO_SIZE;
        const scale = (ps * 2) / 128;
        let dropped = 0;

        const iv = setInterval(() => {
            if (!this.gameStarted || this.gameManager.isGameOver) { clearInterval(iv); return; }
            const x = Math.random() * (CONFIG.GAME.WIDTH - 60) + 30;
            
            const b = Bodies.circle(x, -20, ps, {
                restitution: 0.1, friction: 0.1, density: 0.001,
                render: { sprite: { texture: CONFIG.COLORS.OJYAMA.image, xScale: scale, yScale: scale } },
                label: 'ojyama'
            });
            Body.setVelocity(b, { x: (Math.random() - 0.5), y: 0 });
            Composite.add(this.world, b);

            if (++dropped >= drop) {
                clearInterval(iv);
                setTimeout(() => {
                    this.isDroppingOjyama = false;
                    this.isProcessing = false;
                }, 600);
            }
        }, 150);
    }

    useSkill() {
        if (this.skillGauge < CONFIG.GAME.SKILL_MAX || !this.gameStarted || this.gameManager.isGameOver) return;
        this.skillGauge = 0;
        this._updateSkillGaugeUI();
        this._showCutIn();
        sounds.playSkill();
        voice.playSkillVoice(this.character.name);
        
        // ネットワークモード時、自分のスキル発動を相手に通知
        if (this.gameManager.gameMode === 'online' && this.id === 'player') {
            net.send({ type: 'skill_used' });
        }
        
        this._lockActivePiece();
        this.isProcessing = true;

        setTimeout(() => {
            if (!this.gameStarted || this.gameManager.isGameOver) return;

            if (this.character.id === 'elfin') {
                const targetColor = CONFIG.COLORS.GREEN;
                const targets = this.world.bodies
                    .filter(b => !b.isStatic && !b.isActivePiece && b.label !== 'ojyama' && b.label !== targetColor.id)
                    .sort(() => 0.5 - Math.random());
                const count = Math.max(3, Math.min(targets.length, Math.ceil(targets.length * 0.4)));
                
                // 1. 対象を光らせる（タメ演出）
                for (let i = 0; i < count; i++) {
                    targets[i].isSkillTarget = true;
                    targets[i].skillTimer = Date.now();
                }

                // 2. 1.2秒後に変化とフラッシュエフェクト
                setTimeout(() => {
                    for (let i = 0; i < count; i++) {
                        targets[i].isSkillTarget = false;
                        targets[i].label = targetColor.id;
                        targets[i].render.sprite.texture = targetColor.image;
                        
                        this.vfxEffects.push({
                            type: 'flash',
                            x: targets[i].position.x,
                            y: targets[i].position.y,
                            startTime: Date.now(),
                            duration: 500
                        });
                    }
                    this.isProcessing = false;
                }, 1200);

            } else if (this.character.id === 'velita') {
                const toRemove = new Set();
                const points = [];
                const targetBodies = this.world.bodies.filter(b => !b.isStatic && !b.isActivePiece);
                // 存在するコマの中からランダムに候補を選ぶ
                let candidates = [...targetBodies].sort(() => 0.5 - Math.random());
                
                for (let i = 0; i < 3; i++) {
                    let rx, ry;
                    if (candidates.length > 0) {
                        const target = candidates.pop();
                        rx = target.position.x;
                        ry = target.position.y;
                    } else {
                        // コマが一つもない場合はランダムな場所
                        rx = Math.random() * (CONFIG.GAME.WIDTH  - 100) + 50;
                        ry = Math.random() * (CONFIG.GAME.HEIGHT - 180) + 120;
                    }
                    points.push({ x: rx, y: ry });
                    this.logic.getBodiesInRadius(rx, ry, 70).forEach(b => toRemove.add(b));
                    
                    // 1. 爆発マーカー（タメ演出）を配置
                    this.vfxEffects.push({
                        type: 'marker',
                        x: rx,
                        y: ry,
                        startTime: Date.now(),
                        duration: 800,
                        color: 'rgba(150, 0, 50, 0.6)'
                    });
                }
                
                // 2. タメの後に爆発と消去
                setTimeout(() => {
                    points.forEach(p => {
                        this.vfxEffects.push({
                            type: 'explosion',
                            x: p.x,
                            y: p.y,
                            startTime: Date.now(),
                            duration: 600
                        });
                    });
                    
                    const list = [...toRemove];
                    if (list.length > 0) {
                        this._removeBodies(list);
                    } else {
                        this.isProcessing = false;
                    }
                }, 800);
            }
        }, 1000);
    }

    _showCutIn() {
        const layer = document.getElementById('cut-in');
        document.getElementById('cut-in-img').src          = this.character.image;
        document.getElementById('cut-in-char-name').innerText   = this.character.name;
        document.getElementById('cut-in-skill-name').innerText  = this.character.skill + '！';
        layer.classList.remove('hidden');
        void layer.offsetWidth;
        setTimeout(() => layer.classList.add('hidden'), 1200);
    }

    _checkGameOver() {
        const dead = this.world.bodies.some(b =>
            !b.isStatic && !b.isActivePiece && b.position.y < CONFIG.GAME.DEADLINE && b.speed < 0.2
        );
        if (dead) {
            if (!this.deadlineTimer) {
                this.deadlineTimer = setTimeout(() => {
                    this.gameManager.triggerGameOver(this.id);
                }, 2000);
            }
        } else {
            if (this.deadlineTimer) { clearTimeout(this.deadlineTimer); this.deadlineTimer = null; }
        }
    }

    /* ---- CPU AI ---- */
    startCpuAI() {
        if (this.isNetwork) return;
        const thinkLoop = () => {
            if (!this.gameStarted || this.gameManager.isGameOver) return;
            
            if (this.activePiece) {
                if (!this.cpuTargetX) {
                    const any = this.world.bodies.filter(b => !b.isStatic && !b.isActivePiece && b.label !== 'ojyama');
                    this.cpuTargetX = any.length > 0 
                        ? any[Math.floor(Math.random()*any.length)].position.x 
                        : Math.random() * (CONFIG.GAME.WIDTH - 100) + 50;
                }

                if (Math.random() < 0.3) this.rotate();
                
                if (this.activePiece.x < this.cpuTargetX - 15) this.moveRight();
                else if (this.activePiece.x > this.cpuTargetX + 15) this.moveLeft();
                else if (Math.random() < 0.1) this.fastDrop();
            } else {
                this.cpuTargetX = null;
            }

            this.cpuTimer = setTimeout(thinkLoop, 400);
        };
        this.cpuTimer = setTimeout(thinkLoop, 1000);

        const skillLoop = () => {
            if (!this.gameStarted || this.gameManager.isGameOver) return;
            if (this.skillGauge >= CONFIG.GAME.SKILL_MAX) setTimeout(() => this.useSkill(), 500);
            this.cpuSkillTimer = setTimeout(skillLoop, 1000);
        };
        this.cpuSkillTimer = setTimeout(skillLoop, 1000);
    }

    stop() {
        this.gameStarted = false;
        clearTimeout(this.cpuTimer);
        clearTimeout(this.cpuSkillTimer);
        clearTimeout(this.deadlineTimer);
        try { Engine.clear(this.engine); } catch(e) {}
        try { if (this.render) Render.stop(this.render); } catch(e) {}
        try { if (this.runner) Runner.stop(this.runner); } catch(e) {}
    }

    _randType() {
        return COLOR_LIST[Math.floor(this.prng.next() * COLOR_LIST.length)];
    }

    _updateAllUI() {
        if (this.scoreElement) this.scoreElement.innerText = this.score;
        this._updateNextUI();
        this._updateOjyamaUI();
        this._updateSkillGaugeUI();
    }

    _updateNextUI() {
        if (!this.nextContainer) return;
        this.nextContainer.innerHTML = '';
        this.nextSet.forEach(item => {
            const img = document.createElement('img');
            img.src = item.type.image;
            img.className = 'next-preview-img';
            this.nextContainer.appendChild(img);
        });
    }

    _updateOjyamaUI() {
        if (!this.ojyamaElement) return;
        this.ojyamaElement.innerHTML = '';
        
        let remaining = this.readyOjyama + this.pendingOjyama;
        
        while (remaining >= 30) {
            this._createOjyamaIcon('supiki-30');
            remaining -= 30;
        }
        while (remaining >= 5) {
            this._createOjyamaIcon('supiki-5');
            remaining -= 5;
        }
        while (remaining >= 1) {
            this._createOjyamaIcon('supiki-1');
            remaining -= 1;
        }
        
        const parent = this.ojyamaElement.parentElement;
        if (parent) parent.style.animation = this.ojyamaPool > 0 ? 'skillPulse 0.4s infinite alternate' : 'none';
    }

    _createOjyamaIcon(className) {
        const img = document.createElement('img');
        img.src = CONFIG.COLORS.OJYAMA.image;
        img.className = 'supiki-icon ' + className;
        this.ojyamaElement.appendChild(img);
    }

    _updateSkillGaugeUI() {
        if (!this.skillBarElement) return;
        const pct = (this.skillGauge / CONFIG.GAME.SKILL_MAX) * 100;
        this.skillBarElement.style.width = `${pct}%`;
        const ready = this.skillGauge >= CONFIG.GAME.SKILL_MAX;
        this.skillBarElement.classList.toggle('ready', ready);
        if (this.skillBtnElement) this.skillBtnElement.disabled = !ready;
    }

    _showChainDisplay(chainCount) {
        const el = document.getElementById(`${this.id}-chain-display`);
        if (!el) return;
        
        el.classList.remove('hidden', 'chain-high');
        if (chainCount >= 3) el.classList.add('chain-high');
        
        el.innerHTML = `
            <div class="chain-number">${chainCount}</div>
            <div class="chain-label">れんさ！</div>
        `;
        // アニメーションをリセット
        void el.offsetWidth;
        
        clearTimeout(this._chainDisplayTimer);
        this._chainDisplayTimer = setTimeout(() => {
            el.classList.add('hidden');
        }, 1200);
    }

    _updateChainGaugeUI() {
        if (!this.chainBarEl) return;
        if (this.chainActive && this.chainTimeLeft > 0) {
            const ratio = Math.max(0, this.chainTimeLeft / this.chainMaxTime) * 100;
            this.chainBarEl.style.height = `${ratio}%`;
            if (ratio > 30) {
                this.chainBarEl.style.background = 'linear-gradient(to top, #ff3366, #ff99bb)';
            } else {
                this.chainBarEl.style.background = '#ff0000';
            }
        } else {
            // チェインなし: バーを空にする（ゲージ枠は常に表示）
            this.chainBarEl.style.height = '0%';
        }
    }
}

/* ================================================================
   メインコントローラー
   ================================================================ */
class MotiMotiPanicBattle {
    constructor() {
        this.isGameOver  = false;
        this.playerBoard = null;
        this.cpuBoard    = null;

        this.gameMode = 'single'; // 'single' or 'online'
        this.networkMode = '';    // 'free' or 'password'
        this.myChar = null;
        this.oppChar = null;
        this.myReady = false;
        this.oppReady = false;

        this._initTitleScreen();
        this._initOnlineMenuScreen();
        this._initSelectScreen();
        this._initMatchingScreen();
        this._initResultScreen();
    }

    _initTitleScreen() {
        const btnStartScoreAttack = document.getElementById('btn-start-scoreattack');
        const btnStartScoreAttack180 = document.getElementById('btn-start-scoreattack-180');
        const btnStartSingle = document.getElementById('btn-start-single');
        const btnStartOnline = document.getElementById('btn-start-online');
        const btnHowto = document.getElementById('btn-howto');
        const btnClose = document.getElementById('btn-howto-close');
        const overlay  = document.getElementById('howto-overlay');

        if (btnStartScoreAttack) btnStartScoreAttack.addEventListener('click', () => {
            this.gameMode = 'scoreAttack';
            this.scoreAttackTime = 90;
            showScreen('screen-select');
        });
        if (btnStartScoreAttack180) btnStartScoreAttack180.addEventListener('click', () => {
            this.gameMode = 'scoreAttack';
            this.scoreAttackTime = 180;
            showScreen('screen-select');
        });
        if (btnStartSingle) btnStartSingle.addEventListener('click', () => {
            this.gameMode = 'single';
            showScreen('screen-select');
        });
        if (btnStartOnline) btnStartOnline.addEventListener('click', () => {
            this.gameMode = 'online';
            showScreen('screen-online-menu');
        });
        if (btnHowto) btnHowto.addEventListener('click', () => { if (overlay) overlay.classList.remove('hidden'); });
        if (btnClose) btnClose.addEventListener('click', () => { if (overlay) overlay.classList.add('hidden'); });
        if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });

        // 設定モーダル
        const btnSettings = document.getElementById('btn-settings');
        const settingsOverlay = document.getElementById('settings-overlay');
        const btnSettingsClose = document.getElementById('btn-settings-close');
        
        if (btnSettings) btnSettings.addEventListener('click', () => {
            if (settingsOverlay) settingsOverlay.classList.remove('hidden');
        });
        if (btnSettingsClose) btnSettingsClose.addEventListener('click', () => {
            if (settingsOverlay) settingsOverlay.classList.add('hidden');
        });
        if (settingsOverlay) settingsOverlay.addEventListener('click', (e) => {
            if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden');
        });

        // 音量スライダーの連動
        const bgmSlider = document.getElementById('bgm-volume-slider');
        const seSlider  = document.getElementById('se-volume-slider');
        
        if (bgmSlider) {
            bgmSlider.value = voice.bgmVolume;
            bgmSlider.addEventListener('input', (e) => voice.setBgmVolume(e.target.value));
        }
        if (seSlider) {
            seSlider.value = voice.seVolume;
            seSlider.addEventListener('input', (e) => voice.setSeVolume(e.target.value));
        }

        // 初回クリック時にタイトルBGMを再生（ブラウザの自動再生ブロック回避）
        let titleBgmPlayed = false;
        const playTitleBgm = () => {
            if (!titleBgmPlayed) {
                voice.playBGM('assets/bgm/title.mp3');
                titleBgmPlayed = true;
            }
        };
        document.body.addEventListener('click', playTitleBgm, { once: true });
        document.body.addEventListener('touchstart', playTitleBgm, { once: true });
    }

    _initOnlineMenuScreen() {
        const btnBack = document.getElementById('btn-back-online-menu');
        if (btnBack) btnBack.addEventListener('click', () => showScreen('screen-title'));

        const nameInput = document.getElementById('input-player-name');
        if (nameInput) {
            nameInput.value = localStorage.getItem('motimoti-player-name') || '';
            nameInput.addEventListener('input', (e) => {
                localStorage.setItem('motimoti-player-name', e.target.value);
            });
        }

        const btnFree = document.getElementById('btn-free-match');
        if (btnFree) btnFree.addEventListener('click', () => {
            this.networkMode = 'free';
            this.playerName = nameInput ? (nameInput.value || 'ゲスト') : 'ゲスト';
            showScreen('screen-select');
        });

        const btnPass = document.getElementById('btn-password-match');
        if (btnPass) btnPass.addEventListener('click', () => {
            const pass = document.getElementById('input-room-password').value;
            if (!pass) return alert('あいことばを入力してください');
            this.networkMode = 'password';
            this.roomPassword = pass;
            this.playerName = nameInput ? (nameInput.value || 'ゲスト') : 'ゲスト';
            showScreen('screen-select');
        });
    }

    _initSelectScreen() {
        const btnBack = document.getElementById('btn-back-title');
        if (btnBack) btnBack.addEventListener('click', () => {
            if (this.gameMode === 'online') showScreen('screen-online-menu');
            else showScreen('screen-title');
        });

        const charList = document.getElementById('char-list');
        if (!charList) return;
        charList.innerHTML = '';

        CONFIG.CHARACTERS.forEach(char => {
            const card = document.createElement('div');
            card.className = 'char-card';
            card.innerHTML = `
                <div class="char-card-img-container"><img src="${char.image}" alt="${char.name}" class="char-card-img" loading="lazy"></div>
                <h3>${char.name}</h3><span class="skill-badge">⚡ ${char.skill}</span>
                <div class="skill-desc">${char.description}</div>
            `;
            card.addEventListener('click', () => {
                sounds.init();
                voice.playSelectVoice(char.name);
                
                // キャラクター登場演出
                const introOverlay = document.getElementById('char-intro-overlay');
                if (introOverlay) {
                    document.getElementById('char-intro-img').src = char.image;
                    document.getElementById('char-intro-name').innerText = char.name;
                    introOverlay.classList.remove('hidden');
                    // CSSアニメーション再トリガーのため少し待ってからactiveクラス付与
                    requestAnimationFrame(() => requestAnimationFrame(() => introOverlay.classList.add('active')));
                    
                    // ボイスが鳴り終わるくらいの時間を待つ (+0.8秒のゆとり)
                    setTimeout(() => {
                        introOverlay.classList.remove('active');
                        setTimeout(() => {
                            introOverlay.classList.add('hidden');
                            if (this.gameMode === 'scoreAttack' || this.gameMode === 'single') {
                                this._startGame(char);
                            } else {
                                this.myChar = char;
                                this._startMatching();
                            }
                        }, 300); // フェードアウト待ち
                    }, 3300);
                } else {
                    if (this.gameMode === 'scoreAttack' || this.gameMode === 'single') {
                        this._startGame(char);
                    } else {
                        this.myChar = char;
                        this._startMatching();
                    }
                }
            });
            charList.appendChild(card);
        });
    }

    async _startMatching() {
        showScreen('screen-matching');
        const statusText = document.getElementById('matching-status-text');
        const loader = document.getElementById('matching-loader');
        const playersDiv = document.getElementById('matching-players');
        const btnReady = document.getElementById('btn-ready');
        
        statusText.innerText = '通信準備中...';
        loader.classList.remove('hidden');
        playersDiv.classList.add('hidden');
        btnReady.classList.add('hidden');
        
        this.myReady = false;
        this.oppReady = false;

        net.onConnected = (isHost) => {
            this._onNetworkConnected();
        };

        net.onData = (data) => {
            this._onNetworkData(data);
        };

        net.onClose = () => {
            alert('通信が切断されました');
            this._backToTitle();
        };

        net.init(async () => {
            statusText.innerText = '対戦相手を探しています...';
            if (this.networkMode === 'free') {
                await net.searchFreeMatch();
            } else if (this.networkMode === 'password') {
                await net.joinPasswordMatch(this.roomPassword);
            }
        });
    }

    _onNetworkConnected() {
        // キャラクター情報とプレイヤー名を送信
        net.send({ type: 'char', charId: this.myChar.id, name: this.playerName });

        const statusText = document.getElementById('matching-status-text');
        const loader = document.getElementById('matching-loader');
        const playersDiv = document.getElementById('matching-players');
        const btnReady = document.getElementById('btn-ready');

        statusText.innerText = '対戦相手が見つかりました！準備OKを押してください。';
        loader.classList.add('hidden');
        playersDiv.classList.remove('hidden');
        btnReady.classList.remove('hidden');

        document.getElementById('match-my-char').src = this.myChar.image;
        const matchMyName = document.getElementById('match-my-name');
        if (matchMyName) matchMyName.innerText = this.playerName || 'あなた';
        document.getElementById('match-my-ready').innerText = '準備中...';
        document.getElementById('match-my-ready').classList.remove('is-ready');
        
        document.getElementById('match-opp-char').src = '';
        document.getElementById('match-opp-ready').innerText = '準備中...';
        document.getElementById('match-opp-ready').classList.remove('is-ready');
    }

    _initMatchingScreen() {
        const btnReady = document.getElementById('btn-ready');
        if (btnReady) btnReady.addEventListener('click', () => {
            this.myReady = true;
            document.getElementById('match-my-ready').innerText = '準備完了！';
            document.getElementById('match-my-ready').classList.add('is-ready');
            btnReady.classList.add('hidden'); // 何度も押せないように隠す
            
            if (net.isHost) {
                this.randomSeed = Math.floor(Math.random() * 2147483647);
                net.send({ type: 'ready', seed: this.randomSeed });
            } else {
                net.send({ type: 'ready' });
            }
            
            this._checkBothReady();
        });

        const btnCancel = document.getElementById('btn-cancel-match');
        if (btnCancel) btnCancel.addEventListener('click', () => {
            net.disconnect();
            showScreen('screen-online-menu');
        });
    }

    _onNetworkData(data) {
        if (data.type === 'char') {
            this.oppChar = CONFIG.CHARACTERS.find(c => c.id === data.charId) || CONFIG.CHARACTERS[0];
            this.oppName = data.name || 'あいて';
            document.getElementById('match-opp-char').src = this.oppChar.image;
            const matchOppName = document.getElementById('match-opp-name');
            if (matchOppName) matchOppName.innerText = this.oppName;
        } else if (data.type === 'ready') {
            this.oppReady = true;
            if (data.seed !== undefined) {
                this.randomSeed = data.seed;
            }
            document.getElementById('match-opp-ready').innerText = '準備完了！';
            document.getElementById('match-opp-ready').classList.add('is-ready');
            this._checkBothReady();
        } else if (data.type === 'sync' && this.cpuBoard && this.cpuBoard.isNetwork) {
            // 同期データ受信
            this.cpuBoard.networkBodies = data.bodies;
            if (data.score !== undefined) {
                this.cpuBoard.score = data.score;
                if (this.cpuBoard.scoreElement) this.cpuBoard.scoreElement.innerText = this.cpuBoard.score;
            }
            if (data.ojyama !== undefined) {
                // ネットワークからの同期データはすべて ready 扱いとして表示
                this.cpuBoard.readyOjyama = data.ojyama;
                this.cpuBoard.pendingOjyama = 0;
                this.cpuBoard._updateOjyamaUI();
            }
            if (data.skill !== undefined) {
                this.cpuBoard.skillGauge = data.skill;
                this.cpuBoard._updateSkillGaugeUI();
            }
            if (data.next !== undefined && this.cpuBoard.nextContainer) {
                this.cpuBoard.nextContainer.innerHTML = '';
                data.next.forEach(id => {
                    const c = Object.values(CONFIG.COLORS).find(cc => cc.id === id);
                    if (c) {
                        const img = document.createElement('img');
                        img.src = c.image;
                        img.className = 'next-preview-img';
                        this.cpuBoard.nextContainer.appendChild(img);
                    }
                });
            }
            
            // 物理演算を行わない代わりに、データ受信時に再描画を行う
            this.cpuBoard.draw();
            
        } else if (data.type === 'attack' && this.playerBoard) {
            // 相手からのスピキ（お邪魔）攻撃を受信
            this.playerBoard.receiveOjyama(data.count);
        } else if (data.type === 'gameover') {
            // 相手がゲームオーバーになった通知を受信（自分の勝利）
            this.triggerGameOver('cpu');
        } else if (data.type === 'skill_used' && this.cpuBoard) {
            // 相手がスキルを使用した
            this.cpuBoard._showCutIn();
            sounds.playSkill();
            if (this.oppChar) voice.playSkillVoice(this.oppChar.name);
        }
    }

    _checkBothReady() {
        if (this.myReady && this.oppReady) {
            setTimeout(() => {
                this._startGame(this.myChar, this.oppChar);
            }, 1000); // すこし待ってから開始
        }
    }

    _startGame(playerChar, oppCharInput = null) {
        if (this.playerBoard) { this.playerBoard.stop(); this.playerBoard = null; }
        if (this.cpuBoard)    { this.cpuBoard.stop();    this.cpuBoard    = null; }
        this.isGameOver = false;

        const oppChar = oppCharInput || CONFIG.CHARACTERS.find(c => c.id !== playerChar.id);
        showScreen('screen-battle');

        ['player-canvas', 'cpu-canvas'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const chainEl = el.querySelector('.chain-display');
                el.innerHTML = '<div class="deadline-line"></div>';
                if (chainEl) el.appendChild(chainEl);
                else {
                    const cd = document.createElement('div');
                    cd.id = id.replace('-canvas', '-chain-display');
                    cd.className = 'chain-display hidden';
                    el.appendChild(cd);
                }
            }
        });

        const screenBattle = document.getElementById('screen-battle');
        if (this.gameMode === 'scoreAttack') {
            screenBattle.classList.add('score-attack-mode');
        } else {
            screenBattle.classList.remove('score-attack-mode');
        }

        document.getElementById('player-char-img').src = playerChar.image;
        document.getElementById('player-char-name').innerText = (this.gameMode === 'online' && this.playerName) ? this.playerName : playerChar.name;

        if (this.gameMode !== 'scoreAttack') {
            document.getElementById('cpu-char-img').src = oppChar.image;
            document.getElementById('cpu-char-name').innerText = this.gameMode === 'online' ? (this.oppName || 'あいて') : oppChar.name;

            const cpuSkillStatus = document.querySelector('.cpu-skill-status');
            if (cpuSkillStatus) {
                cpuSkillStatus.innerText = this.gameMode === 'online' ? 'ONLINE' : 'AUTO';
            }
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.playerBoard = new GameBoard('player', 'player-canvas', playerChar, this, false, this.randomSeed);
                
                if (this.gameMode !== 'scoreAttack') {
                    this.cpuBoard = new GameBoard('cpu', 'cpu-canvas', oppChar, this, this.gameMode === 'online', this.randomSeed);
                    this.playerBoard.opponentBoard = this.cpuBoard;
                    this.cpuBoard.opponentBoard    = this.playerBoard;
                }

                this._showCountdown(() => {
                    if (this.gameMode === 'scoreAttack') {
                        voice.playBGM('assets/bgm/solo.mp3');
                    } else {
                        voice.playBGM('assets/bgm/battle.mp3');
                    }
                    this.playerBoard.gameStarted = true;
                    this.playerBoard.spawnNextPiece();
                    
                    if (this.gameMode === 'single') {
                        this.cpuBoard.gameStarted = true;
                        this.cpuBoard.spawnNextPiece();
                        this.cpuBoard.startCpuAI();
                    } else if (this.gameMode === 'scoreAttack') {
                        // スコアアタック用のメインタイマー開始
                        this._startMainTimer(this.scoreAttackTime || 90);
                    }
                });

                this._initBattleEvents();
            });
        });
    }

    _startMainTimer(seconds) {
        this.mainTimerLeft = seconds;
        const timerEl = document.getElementById('main-timer-display');
        if (!timerEl) return;
        timerEl.classList.remove('hidden');
        timerEl.innerText = `⏰ ${this.mainTimerLeft}`;
        
        clearInterval(this.mainTimerInterval);
        this.mainTimerInterval = setInterval(() => {
            if (this.isGameOver) {
                clearInterval(this.mainTimerInterval);
                return;
            }
            this.mainTimerLeft--;
            timerEl.innerText = `⏰ ${this.mainTimerLeft}`;
            if (this.mainTimerLeft <= 0) {
                clearInterval(this.mainTimerInterval);
                this.triggerGameOver('cpu'); // スコアアタック終了
            }
        }, 1000);
    }

    _showCountdown(onComplete) {
        const overlay = document.getElementById('countdown-overlay');
        const textEl  = document.getElementById('countdown-text');
        if (!overlay || !textEl) { onComplete(); return; }

        overlay.classList.remove('hidden');
        const steps = [
            { text: 'READY?', className: '',   delay: 1200 },
            { text: '3',      className: '',   delay: 800  },
            { text: '2',      className: '',   delay: 800  },
            { text: '1',      className: '',   delay: 800  },
            { text: 'START!', className: 'go', delay: 800  },
        ];

        let i = 0;
        const showNext = () => {
            if (i >= steps.length) {
                overlay.classList.add('hidden');
                onComplete();
                return;
            }
            const step = steps[i];
            textEl.className = 'countdown-text ' + step.className;
            textEl.innerText = step.text;
            void textEl.offsetWidth;
            
            if (step.text === 'START!') {
                sounds.playGo();
            } else if (step.text !== 'READY?') {
                sounds.playCountdown();
            }
            
            i++;
            setTimeout(showNext, step.delay);
        };
        showNext();
    }

    _initBattleEvents() {
        const onKeyDown = (e) => {
            if (this.isGameOver || !this.playerBoard) return;
            switch(e.code) {
                case 'ArrowLeft':
                case 'KeyA':       e.preventDefault(); this.playerBoard.isLeftPressed = true; break;
                case 'ArrowRight':
                case 'KeyD':       e.preventDefault(); this.playerBoard.isRightPressed = true; break;
                case 'ArrowUp':
                case 'KeyW':
                case 'KeyZ':
                case 'KeyX':       e.preventDefault(); this.playerBoard.rotate(); break;
                case 'ArrowDown':
                case 'KeyS':       e.preventDefault(); this.playerBoard.fastDrop(); break;
                case 'Space':
                    e.preventDefault(); 
                    if (document.activeElement.tagName !== 'BUTTON') this.playerBoard.useSkill(); 
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    e.preventDefault();
                    if (document.activeElement.tagName !== 'BUTTON') this.playerBoard.shakeBoard();
                    break;
            }
        };

        const onKeyUp = (e) => {
            if (this.isGameOver || !this.playerBoard) return;
            switch(e.code) {
                case 'ArrowLeft':
                case 'KeyA':       e.preventDefault(); this.playerBoard.isLeftPressed = false; break;
                case 'ArrowRight':
                case 'KeyD':       e.preventDefault(); this.playerBoard.isRightPressed = false; break;
            }
        };

        if (window._motiKeyDown) window.removeEventListener('keydown', window._motiKeyDown);
        if (window._motiKeyUp) window.removeEventListener('keyup', window._motiKeyUp);
        
        // Remove the old listener if it exists
        if (window._motiKey) window.removeEventListener('keydown', window._motiKey);

        window._motiKeyDown = onKeyDown;
        window._motiKeyUp = onKeyUp;
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        const bindPad = (id, actionDown, actionUp) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.onmousedown = (e) => { e.preventDefault(); actionDown(); };
            btn.ontouchstart = (e) => { e.preventDefault(); actionDown(); };
            if (actionUp) {
                btn.onmouseup = (e) => { e.preventDefault(); actionUp(); };
                btn.onmouseleave = (e) => { e.preventDefault(); actionUp(); };
                btn.ontouchend = (e) => { e.preventDefault(); actionUp(); };
            }
        };

        bindPad('pad-left',   
            () => { if(this.playerBoard) this.playerBoard.isLeftPressed = true; },
            () => { if(this.playerBoard) this.playerBoard.isLeftPressed = false; }
        );
        bindPad('pad-right',  
            () => { if(this.playerBoard) this.playerBoard.isRightPressed = true; },
            () => { if(this.playerBoard) this.playerBoard.isRightPressed = false; }
        );
        bindPad('pad-rotate', () => { if(this.playerBoard) this.playerBoard.rotate(); });
        bindPad('pad-down',   () => { if(this.playerBoard) this.playerBoard.fastDrop(); });

        const skillBtn = document.getElementById('player-skill-btn');
        if (skillBtn) skillBtn.onclick = () => { if (this.playerBoard) this.playerBoard.useSkill(); };

        const shakeBtn = document.getElementById('player-shake-btn');
        if (shakeBtn) shakeBtn.onclick = () => { if (this.playerBoard) this.playerBoard.shakeBoard(); };

        const playerCanvas = document.getElementById('player-canvas');
        if (playerCanvas) {
            playerCanvas.onmousedown = (e) => {
                e.preventDefault();
                if (this.playerBoard) this.playerBoard.rotate();
            };
            playerCanvas.ontouchstart = (e) => {
                e.preventDefault();
                if (this.playerBoard) this.playerBoard.rotate();
            };
        }

        const btnQuit = document.getElementById('btn-quit');
        if (btnQuit) {
            btnQuit.onclick = () => {
                if (confirm('バトルをやめてタイトルへ戻りますか？')) {
                    this.isGameOver = true;
                    clearInterval(this.mainTimerInterval);
                    this._backToTitle();
                }
            };
        }
    }
    
    _initResultScreen() {
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) restartBtn.onclick = () => {
            document.getElementById('result-overlay').classList.add('hidden');
            if (this.gameMode === 'online') {
                // オンラインの場合は再戦ボタンを隠すか、またはタイトルに戻らせるか。今回はもう一度を押したらキャラ選択へ戻る。
                this._backToSelect();
            } else {
                if (this.playerBoard) this._startGame(this.playerBoard.character);
            }
        };

        const backSelectBtn = document.getElementById('btn-back-select');
        if (backSelectBtn) backSelectBtn.onclick = () => {
            this._backToSelect();
        };

        const backTitleBtn = document.getElementById('btn-back-to-title');
        if (backTitleBtn) backTitleBtn.onclick = () => {
            this._backToTitle();
        };
    }
    
    _backToSelect() {
        document.getElementById('result-overlay').classList.add('hidden');
        if (this.playerBoard) { this.playerBoard.stop(); this.playerBoard = null; }
        if (this.cpuBoard)    { this.cpuBoard.stop();    this.cpuBoard    = null; }
        net.disconnect();
        voice.playBGM('assets/bgm/title.mp3');
        showScreen('screen-select');
    }
    
    _backToTitle() {
        document.getElementById('result-overlay').classList.add('hidden');
        if (this.playerBoard) { this.playerBoard.stop(); this.playerBoard = null; }
        if (this.cpuBoard)    { this.cpuBoard.stop();    this.cpuBoard    = null; }
        net.disconnect();
        voice.playBGM('assets/bgm/title.mp3');
        showScreen('screen-title');
    }

    triggerGameOver(loserId) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        
        // オンライン対戦時で「自分(player)が負けた」判定の場合、相手にゲームオーバーを通知する
        if (this.gameMode === 'online' && loserId === 'player') {
            net.send({ type: 'gameover' });
        }

        if (this.playerBoard) this.playerBoard.stop();
        if (this.cpuBoard)    this.cpuBoard.stop();

        voice.stopBGM();
        sounds.playGameOver();

        const playerWon = (loserId === 'cpu');
        const titleEl   = document.getElementById('result-title');
        if (titleEl) {
            if (playerWon) {
                titleEl.innerText = '🎉 YOU WIN!';
                titleEl.style.color = 'var(--accent-pink)';
            } else {
                if (this.gameMode === 'online') {
                    titleEl.innerText = '💀 ' + (this.oppName || 'あいて') + ' WIN!';
                } else {
                    titleEl.innerText = '💀 YOU LOSE...';
                }
                titleEl.style.color = '#888';
            }
        }
        
        const charName = this.playerBoard ? this.playerBoard.character.name : (this.myChar ? this.myChar.name : null);
        if (charName) {
            if (playerWon) {
                voice.playWinVoice(charName);
            } else {
                voice.playLoseVoice(charName);
            }
        }

        const ps = document.getElementById('result-player-score');
        const cs = document.getElementById('result-cpu-score');
        if (ps) ps.innerText = this.playerBoard?.score ?? 0;
        if (cs) cs.innerText = this.cpuBoard?.score    ?? 0;
        
        const restartBtn = document.getElementById('restart-btn');
        if (this.gameMode === 'online' && restartBtn) {
            restartBtn.innerText = 'もう一度探す';
        } else if (restartBtn) {
            restartBtn.innerText = 'もう一度！';
        }

        const overlay = document.getElementById('result-overlay');
        if (overlay) overlay.classList.remove('hidden');
    }
}

/* ---- 起動 ---- */
window.addEventListener('load', function() {
    preloadImages(function() {
        new MotiMotiPanicBattle();
    });
});
