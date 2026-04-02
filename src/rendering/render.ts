import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";


interface Node {
    name: string,
    _gvid: number,
    pos: [number, number, number]
}

interface Edge {
    tail: number,
    head: number,
    color: string,
    width: number,
}


export class GraphRenderer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private container: HTMLElement;
    private light: THREE.DirectionalLight;
    sizeFactor: number;
    renderYarnColor?: THREE.ColorRepresentation | null;

    private nodeMap = new Map<number, THREE.Mesh>();
    private materialMap = new Map<THREE.ColorRepresentation, THREE.MeshStandardMaterial>();

    constructor(container: HTMLElement) {
        this.sizeFactor = 0.1;
        this.container = container;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 7, 7);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.container.appendChild(this.renderer.domElement);


        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        this.light = new THREE.DirectionalLight(0xffffff, 0.8);
        this.light.position.set(10, 10, 10);
        this.scene.add(this.light);

        this.renderer.setAnimationLoop( this.animate )
    }

    renderGraph(graph: { nodes: Node[], edges: Edge[] }) {
        this.clearScene();
        console.log(graph);
        this.createNodes(graph.nodes);
        this.createEdges(graph.edges);
    }

    private clearScene() {
        for (const obj of this.scene.children.slice()) {
            if (!(obj instanceof THREE.Light)) {
                this.scene.remove(obj);
            }
        }
        this.nodeMap.clear();
    }

    private createNodes(nodes: Node[]) {
        const geometry = new THREE.SphereGeometry(this.sizeFactor);

        for (const n of nodes) {
            const material = this.getMaterial(this.renderYarnColor ?? "white");;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(n.pos[0], n.pos[1], n.pos[2]);
            this.scene.add(mesh);
            this.nodeMap.set(n._gvid, mesh);
            if(n._gvid == 46)
                console.log(n)
        }
    }

    private createEdges(edges: Edge[]) {
        const geometry = new THREE.CylinderGeometry(this.sizeFactor, this.sizeFactor, 1);
        for (const e of edges) {
            const a = this.nodeMap.get(e.tail);
            const b = this.nodeMap.get(e.head);
            if (!a || !b) continue;
            const dist = a.position.distanceTo(b.position);

            const material = this.getMaterial(this.renderYarnColor ?? e.color);
            const mesh = new THREE.Mesh(geometry, material);

            // resize
            mesh.scale.set(e.width, dist, e.width);
            a.scale.max(new THREE.Vector3(e.width, e.width, e.width));
            b.scale.max(new THREE.Vector3(e.width, e.width, e.width));

            const midpoint = new THREE.Vector3().addVectors(a.position, b.position).divideScalar(2);
            mesh.position.copy(midpoint);
        
            const direction = new THREE.Vector3().subVectors(b.position, a.position).normalize();
            const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            mesh.quaternion.copy(quaternion);
            this.scene.add(mesh);
        }
    }

    private getMaterial(color: THREE.ColorRepresentation) {
        var mapMat = this.materialMap.get(color)
        if(mapMat)
            return mapMat;
        else {
            var material = new THREE.MeshStandardMaterial({color: color});
            this.materialMap.set(color, material);
            return material;
        }
    }

    private animate = () => {
        requestAnimationFrame(this.animate);
        this.controls.update();
        this.light.position.copy(this.camera.position);
        this.renderer.render(this.scene, this.camera);
    };
}
