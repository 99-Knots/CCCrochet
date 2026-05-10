import { Edge, Vertex, Support } from "./Stitches"


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