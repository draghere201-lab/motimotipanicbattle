export const CONFIG = {
    COLORS: {
        RED: { id: 'red', color: '#ff4d6d', stroke: '#ff003c', image: 'assets/puyo/red.png' },
        BLUE: { id: 'blue', color: '#00f5ff', stroke: '#00bfff', image: 'assets/puyo/cyan.png' },
        GREEN: { id: 'green', color: '#39ff14', stroke: '#00ff00', image: 'assets/puyo/green.png' },
        PURPLE: { id: 'purple', color: '#bd00ff', stroke: '#8000ff', image: 'assets/puyo/purple.png' },
        YELLOW: { id: 'yellow', color: '#ffe600', stroke: '#d4af37', image: 'assets/puyo/yellow.png' },
        OJYAMA: { id: 'ojyama', color: '#a0a0a0', stroke: '#606060', image: 'assets/puyo/ojyama.png' }
    },
    GAME: {
        WIDTH: 360,
        HEIGHT: 550,
        PUYO_SIZE: 20, // コマの基本半径 (直径40px)
        GRAVITY: 1.0,
        MIN_CHAIN: 5, // 消滅に必要な最低連結数
        DEADLINE: 100, // デッドラインの高さ
        SKILL_MAX: 100, // スキルゲージの最大値
        OJYAMA_SEND_THRESHOLD: 5 // この数以上一度に消すか、連鎖でお邪魔を送信
    },
    CHARACTERS: [
        { 
            id: 'elfin', 
            name: 'エルフィン', 
            skill: '魔弾の暴走', 
            description: 'フィールド上のランダムなコマを緑（green）のコマに変える！大量連鎖のチャンス！', 
            image: 'assets/char/エルフィン.png',
            color: '#39ff14',
            fieldColor: '#4fc3f7',   // フィールド枠色（水色）
            chainTime: 5000          // チェイン猶予 5秒
        },
        { 
            id: 'velita', 
            name: 'ベリータ', 
            skill: 'ディメンションバースト', 
            description: '数カ所を爆破し、その範囲内のコマを一斉に消去する！ピンチ脱出に最適！', 
            image: 'assets/char/ベリータ.png',
            color: '#bd00ff',
            fieldColor: '#ce93d8',   // フィールド枠色（紫）
            chainTime: 4000          // チェイン猶予 4秒
        }
    ]
};

// 通常落下してくるコマのリスト（お邪魔コマは除く）
export const COLOR_LIST = [
    CONFIG.COLORS.RED,
    CONFIG.COLORS.BLUE,
    CONFIG.COLORS.GREEN,
    CONFIG.COLORS.PURPLE,
    CONFIG.COLORS.YELLOW
];

