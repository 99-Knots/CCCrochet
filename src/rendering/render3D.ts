import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Vertex, Edge, StitchTypes, StitchType } from "../Stitches";

const EdgeTypeColors = {
    "insert": "red",
    "prev": "blue",
    "slst": "yellow",
    "surround": "green"
}


export class GraphRenderer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private container: HTMLElement;
    private light: THREE.DirectionalLight;
    sizeFactor: number;
    private _renderYarnColor?: THREE.ColorRepresentation | null;

    set renderYarnColor(val: THREE.ColorRepresentation | null) {
        this._renderYarnColor = val;
    }

    private nodeMap = new Map<string, THREE.Mesh>();
    private materialMap = new Map<THREE.ColorRepresentation, THREE.MeshStandardMaterial>();

    constructor(container: HTMLElement) {
        this.sizeFactor = 8;
        this.container = container;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 70, 70);
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

    renderGraph(graph: { nodes: Vertex[], edges: Edge[] }) {
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

    private createNodes(nodes: Vertex[]) {
        const geometry = new THREE.SphereGeometry(this.sizeFactor);

        for (const n of nodes) {
            const material = this.getMaterial(this._renderYarnColor ?? (n.type == StitchTypes.HL ? "green" : n.type == StitchTypes.CH ? "yellow" : "white"));;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(n.x??0, -(n.y??0), n.z??0);
            //mesh.scale.set(this.sizeFactor, this.sizeFactor, this.sizeFactor)
            this.scene.add(mesh);
            this.nodeMap.set(n.id, mesh);
        }
    }

    private createEdges(edges: Edge[]) {
        const geometry = new THREE.CylinderGeometry(1, 1, 1);
        for (const e of edges) {
            //if(!(e.type == "insert" || e.type == "prev"))
            //    continue;
            const a = this.nodeMap.get(e.target.id);
            const b = this.nodeMap.get(e.source.id);
            if (!a || !b) continue;
            const dist = a.position.distanceTo(b.position);

            const material = this.getMaterial(this._renderYarnColor ?? EdgeTypeColors[e.type]);
            const mesh = new THREE.Mesh(geometry, material);

            // resize
            mesh.scale.set(this.sizeFactor, dist, this.sizeFactor);
            //a.scale.max(new THREE.Vector3(4, 4, 4));
            //b.scale.max(new THREE.Vector3(4, 4, 4));

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
        this.controls.update();
        this.light.position.copy(this.camera.position);
        this.renderer.render(this.scene, this.camera);
    };
}
