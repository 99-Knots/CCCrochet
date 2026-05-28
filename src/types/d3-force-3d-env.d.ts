declare module 'd3-force-3d' {
    type d3 = typeof import('d3-force');

    export interface SimulationNodeDatum3D extends d3.SimulationNodeDatum {
        z?: number;
        vz?: number;
        fz?: number;
    }

    export interface SimulationLinkDatum3D<N extends SimulationNodeDatum3D = SimulationNodeDatum3D> extends d3.SimulationLinkDatum<N> {}

    export function forceSimulation<N extends SimulationNodeDatum3D = SimulationNodeDatum3D>(
        nodes?: N[], 
        numDimensions?: 2 | 3
    ): d3.Simulation<N, undefined>;

    export function forceCenter<N extends SimulationNodeDatum3D = SimulationNodeDatum3D>(x?: number, y?: number, z?: number): d3.ForceCenter<N>;
    export function forceCollide<N extends SimulationNodeDatum3D = SimulationNodeDatum3D>(radius?: number | ((node: N, i: number, nodes: N[]) => number)): d3.ForceCollide<N>;
    export function forceManyBody<N extends SimulationNodeDatum3D = SimulationNodeDatum3D>(): d3.ForceManyBody<N>;
    export function forceLink<N extends SimulationNodeDatum3D = SimulationNodeDatum3D, L extends d3.SimulationLinkDatum<N> = d3.SimulationLinkDatum<N>>(links?: L[]): d3.ForceLink<N, L>;
    export function forceRadial<N extends SimulationNodeDatum3D = SimulationNodeDatum3D>(radius: number | ((node: N, i: number, nodes: N[]) => number), x?: number, y?: number, z?: number): d3.ForceRadial<N>;

    export function forceX<N extends SimulationNodeDatum3D = SimulationNodeDatum3D>(x?: number): d3.ForceX<N>;
    export function forceY<N extends SimulationNodeDatum3D = SimulationNodeDatum3D>(y?: number): d3.ForceY<N>;
    export function forceZ<N extends SimulationNodeDatum3D = SimulationNodeDatum3D>(z?: number): d3.ForceZ<N>; 

    export interface ForceRadial<N extends SimulationNodeDatum3D> extends d3.ForceRadial<N> {
        z(z: number | ((node: N, i: number, nodes: N[]) => number)): this;
    }
    export interface ForceZ<N extends SimulationNodeDatum3D> extends d3.ForceX<N> {}
}