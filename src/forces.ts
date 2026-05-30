import { Edge, Vertex, Support, Hole } from "./Stitches"


export function forceCollinearSupport(edges: Edge[]) {
    let supportLinks: { support: Support; v1: Vertex; v2: Vertex; diff: number }[] = [];

    function force(alpha: number) {

        for (const { support, v1, v2, diff } of supportLinks) {

            // direct comparison with undefined because coordinates could be 0
            if (support.x === undefined || support.y === undefined || 
                v1.x === undefined || v1.y === undefined || 
                v2.x === undefined || v2.y === undefined
            ) 
                continue;

            const targetX = v1.x * (1 - diff) + v2.x * diff;
            const targetY = v1.y * (1 - diff) + v2.y * diff;
            const targetZ = (v1.z !== undefined && v2.z !== undefined) ? v1.z * (1 - diff) + v2.z * diff : undefined;

            const dx = support.x - targetX;
            const dy = support.y - targetY;
            const dz = (targetZ !== undefined && support.z !== undefined) ? support.z - targetZ : 0;

            const k = 0.5 * alpha;

            // apply force on support to base vertices instead
            v1.vx = (v1.vx || 0) + dx * (1 - diff) * k;
            v1.vy = (v1.vy || 0) + dy * (1 - diff) * k;
            if (v1.vz !== undefined) 
                v1.vz += dz * (1 - diff) * k;

            v2.vx = (v2.vx || 0) + dx * diff * k;
            v2.vy = (v2.vy || 0) + dy * diff * k;
            if (v2.vz !== undefined) 
                v2.vz += dz * diff * k;


            // hard constraint for degenerate triangles
            support.x = targetX;
            support.y = targetY;
            if (targetZ !== undefined) 
                support.z = targetZ;

            support.vx = 0;
            support.vy = 0;
            if (support.vz !== undefined) 
                support.vz = 0;
        }
    }


    force.initialize = function (nodes: Vertex[]) {
        supportLinks = [];

        const supports = nodes.filter(n => n instanceof Support) as Support[];

        for (const sp of supports) {
            const spEdges = edges.filter(e => e.source == sp && e.type == "support");

            if (spEdges.length == 2) {  // assumed that we only ever create support vertices with two base vertices
                supportLinks.push({
                    support: sp,
                    v1: spEdges[0].target,
                    v2: spEdges[1].target,
                    diff: sp.interpolationDiff ?? 0.5,
                });
            }
        }
    };

    return force;
}




export function forceAngularOrder(prevMap: Map<Vertex, Vertex>, nextMap: Map<Vertex, Vertex>, strength: number = 0.3) {

    // list of vertices in prev-next order per layer
    let layerVertices = new Map<number, Vertex[]>();

    function computeCentroid(verts: Vertex[]) {
        let cx = 0;
        let cy = 0;
        let count = 0;
        for (const v of verts) {
            if (v.x !== undefined && v.y !== undefined) {
                cx += v.x; 
                cy += v.y; 
                count++;
            }
        }
        return count > 0 ? { cx: cx / count, cy: cy / count } : { cx: 0, cy: 0 };
    }

    // Normalise an angle to [-PI, PI]
    function normaliseAngle(a: number): number {
        while (a > Math.PI)  a -= 2 * Math.PI;
        while (a < -Math.PI) a += 2 * Math.PI;
        return a;
    }

    force.initialize = function(nodes: Vertex[]) {
        layerVertices = new Map();
        for (const v of nodes) {
            if (v instanceof Hole || v instanceof Support) continue;
            const list = layerVertices.get(v.layer) ?? [];
            list.push(v);
            layerVertices.set(v.layer, list);
        }
    };

    function force(alpha: number) {
        const centroids = new Map<number, {cx: number, cy: number}>();

        for (const [v, next] of nextMap) {
            if (v instanceof Hole || v instanceof Support) continue;
            const prev = prevMap.get(v);
            if (!prev || !next) continue;  // row-end stitches, skip
            if (v.x === undefined || v.y === undefined) continue;
            if (prev.x === undefined || prev.y === undefined) continue;
            if (next.x === undefined || next.y === undefined) continue;

            if (!centroids.has(v.layer)) {
                const layerVerts = layerVertices.get(v.layer) ?? [];
                centroids.set(v.layer, computeCentroid(layerVerts));
            }
            const { cx, cy } = centroids.get(v.layer)!;

            const anglePrev = Math.atan2(prev.y - cy, prev.x - cx);
            const angleNext = Math.atan2(next.y - cy, next.x - cx);
            const angleSelf = Math.atan2(v.y - cy, v.x - cx);

            let neighbourSpan = normaliseAngle(angleNext - anglePrev);
            let currentSpan = normaliseAngle(angleSelf - anglePrev);

            // If the neighbours have crossed, push middle slightly towards positive to help untangle
            if (neighbourSpan < 0.01) neighbourSpan = 0.01;

            const targetAngle = normaliseAngle(anglePrev + neighbourSpan * 0.5);

            // if not already in-between the neighbours push towards their middle
            if (currentSpan < 0 || currentSpan > neighbourSpan) {
                const r = Math.sqrt((v.x - cx) ** 2 + (v.y - cy) ** 2) || 1;
                const targetX = cx + r * Math.cos(targetAngle);
                const targetY = cy + r * Math.sin(targetAngle);

                v.vx = (v.vx ?? 0) + (targetX - v.x) * strength * alpha;
                v.vy = (v.vy ?? 0) + (targetY - v.y) * strength * alpha;

            }
        }
    }

    return force;
}