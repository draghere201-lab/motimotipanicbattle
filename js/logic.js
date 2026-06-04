import { CONFIG } from './config.js';

export class GameLogic {
    constructor(world) {
        this.world = world;
    }

    /**
     * 連鎖（連結）をチェックし、消去すべきコマのリストを返す
     * 通常コマの消滅時に隣接するお邪魔コマも一緒に消滅させる
     */
    checkChains() {
        // お邪魔コマ（ojyama）と固定オブジェクト（壁や床）を除く通常コマ
        const bodies = this.world.bodies.filter(b => !b.isStatic && b.label !== 'ojyama');
        const checked = new Set();
        const groupsToRemove = [];

        // 1. 通常コマの同色連結チェック
        for (const body of bodies) {
            if (checked.has(body.id)) continue;

            const group = [];
            this.findConnected(body, group, checked);

            if (group.length >= CONFIG.GAME.MIN_CHAIN) {
                groupsToRemove.push(...group);
            }
        }

        // 2. 消滅予定の通常コマに接触しているお邪魔コマを巻き込んで消去
        if (groupsToRemove.length > 0) {
            const ojyamaBodies = this.world.bodies.filter(b => !b.isStatic && b.label === 'ojyama');
            const ojyamaToRemove = new Set();

            for (const body of groupsToRemove) {
                // 消滅予定のコマに接触している全ボディを取得
                const contacts = this.getTouchingBodies(body);
                for (const other of contacts) {
                    if (other.label === 'ojyama') {
                        ojyamaToRemove.add(other);
                    }
                }
            }
            groupsToRemove.push(...ojyamaToRemove);
        }

        return groupsToRemove;
    }

    /**
     * 再帰的に接触している同じ色のコマを探す
     */
    findConnected(body, group, checked) {
        checked.add(body.id);
        group.push(body);

        // Matter.js の現在の衝突リストから、このbodyに関係するものを探す
        // 注意: 実際には Matter.Query.collides や collisionStart イベントを利用する方が正確ですが、
        // ここでは簡易的に距離や現状の接触判定を利用します
        const contacts = this.getTouchingBodies(body);

        for (const other of contacts) {
            if (!checked.has(other.id) && other.label === body.label) {
                this.findConnected(other, group, checked);
            }
        }
    }

    getTouchingBodies(body) {
        const touching = [];
        const bodies = this.world.bodies.filter(b => !b.isStatic && b.id !== body.id);
        const ps = CONFIG.GAME.PUYO_SIZE;
        const r1 = body.circleRadius || ps;

        for (const other of bodies) {
            const dx = body.position.x - other.position.x;
            const dy = body.position.y - other.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const r2 = other.circleRadius || ps;
            const threshold = (r1 + r2) * 1.15; // 描画(getConnectedPairs)と同じ距離判定
            
            if (dist <= threshold) {
                touching.push(other);
            }
        }
        return touching;
    }

    /**
     * 特定の座標（中心）から半径 radius 内にあるコマを取得する（スキル等で使用）
     */
    getBodiesInRadius(x, y, radius) {
        const bodies = this.world.bodies.filter(b => !b.isStatic);
        const inside = [];

        for (const body of bodies) {
            const dx = body.position.x - x;
            const dy = body.position.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= radius) {
                inside.push(body);
            }
        }
        return inside;
    }
}
