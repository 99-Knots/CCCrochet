import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";


interface Node {
    name: string;
    pos: [number, number, number]
}

interface Edge {
    tail: string;
    head: string;
    color: string;
}


export class GraphRenderer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private container: HTMLElement;
    private light: THREE.DirectionalLight;
    sizeFactor: number;

    private nodeMap = new Map<string, THREE.Mesh>();

    constructor(container: HTMLElement) {
        this.sizeFactor = 0.4;
        this.container = container;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 50);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.camera.position.z = 7;

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
            const material = new THREE.MeshStandardMaterial();
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.set(n.pos[0], n.pos[1], n.pos[2]);
            this.scene.add(mesh);
            this.nodeMap.set(n.name, mesh);
        }
    }

    private createEdges(edges: Edge[]) {
        const geometry = new THREE.CylinderGeometry(this.sizeFactor, this.sizeFactor, 1);
        for (const e of edges) {
            const a = this.nodeMap.get(e.tail);
            const b = this.nodeMap.get(e.head);
            if (!a || !b) continue;
            const dist = a.position.distanceTo(b.position);

            const material = new THREE.MeshStandardMaterial();
            material.color.set(e.color);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.set(1, dist, 1);

            const midpoint = new THREE.Vector3().addVectors(a.position, b.position).divideScalar(2);
            mesh.position.copy(midpoint);
        
            const direction = new THREE.Vector3().subVectors(b.position, a.position).normalize();
            const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            mesh.quaternion.copy(quaternion);
            this.scene.add(mesh);
        }
    }

    private animate = () => {
        requestAnimationFrame(this.animate);
        this.controls.update();
        this.light.position.copy(this.camera.position);
        this.renderer.render(this.scene, this.camera);
    };
}
