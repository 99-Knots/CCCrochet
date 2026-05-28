import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Vertex, Edge, StitchTypes } from "../Stitches";

const EdgeTypeColors = {
    "insert": "red",
    "simInsert": "red",
    "prev": "blue",
    "slst": "yellow",
    "surround": "green",
    "support": "orange"
}

const sharedResources = {
    sphereGeo: new THREE.SphereGeometry(1, 8, 6),
    cylinderGeo: new THREE.CylinderGeometry(1, 1, 1)    
}

export class GraphScene {
    element: HTMLElement;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private controls: OrbitControls;
    private light: THREE.DirectionalLight;
    private _renderYarnColor?: THREE.ColorRepresentation | null;

    set renderYarnColor(val: THREE.ColorRepresentation | null) {
        this._renderYarnColor = val;
    }
    
    private nodeMeshMap = new Map<string, THREE.Mesh>();
    private renderer: GraphRenderer;
    sizeFactor: number;

    constructor(elem: HTMLElement, renderer: GraphRenderer) {
        this.sizeFactor = 8;
        this.element = elem;
        this.renderer = renderer;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);
        this.camera = new THREE.PerspectiveCamera(
            75,
            elem.clientWidth / elem.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 70, 70);
        this.controls = new OrbitControls(this.camera, this.element);


        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        this.light = new THREE.DirectionalLight(0xffffff, 1.0);
        this.light.position.set(10, 10, 10);
        this.scene.add(this.light);
    }

    modelGraph(graph: { nodes: Vertex[], edges: Edge[] }) {
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
        this.nodeMeshMap.clear();
    }

    
    private createNodes(nodes: Vertex[]) {
        const geometry = sharedResources.sphereGeo;

        for (const n of nodes) {
            if(n.type === StitchTypes.HL)
                continue;
            const material = this.renderer.getMaterial(this._renderYarnColor ?? (n.type == StitchTypes.HL ? "green" : n.type == StitchTypes.CH ? "yellow" : "white"));;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(n.x??0, -(n.y??0), n.z??0);
            mesh.scale.set(this.sizeFactor, this.sizeFactor, this.sizeFactor)
            this.scene.add(mesh);
            this.nodeMeshMap.set(n.id, mesh);
        }
    }

        private createEdges(edges: Edge[]) {
        const geometry = sharedResources.cylinderGeo;
        for (const e of edges) {
            if(!(e.type == "insert" || e.type == "prev" || e.type == "simInsert" || e.type == "slst"))
                continue;
            const a = this.nodeMeshMap.get(e.target.id);
            const b = this.nodeMeshMap.get(e.source.id);
            if (!a || !b) continue;
            const dist = a.position.distanceTo(b.position);

            const material = this.renderer.getMaterial(this._renderYarnColor ?? EdgeTypeColors[e.type]);
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

    render(renderer: THREE.WebGLRenderer) {
        this.controls.update();
        this.light.position.copy(this.camera.position);
        renderer.render(this.scene, this.camera);
    }
}




export class GraphRenderer {
    private renderer: THREE.WebGLRenderer;
    private container: HTMLElement;
    sizeFactor: number;
    scenes: GraphScene[] = [];
    private materialMap = new Map<THREE.ColorRepresentation, THREE.MeshStandardMaterial>();

    constructor(container: HTMLElement) {
        this.sizeFactor = 8;
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true});

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 0.5));
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setClearColor( 0xffffff, 1 );
        container.appendChild(this.renderer.domElement);
        this.container = container;

        this.renderer.setAnimationLoop( this.animate )

        window.addEventListener('resize', () => {
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 0.5));
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        });
    }

    addScene(element: HTMLElement) {
        const scene = new GraphScene(element, this);
        this.scenes.push(scene);
        return scene;
    }

    getMaterial(color: THREE.ColorRepresentation) {
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

        this.renderer.setScissorTest(false);
        this.renderer.clear();

        this.renderer.setScissorTest(true);

        const canvasHeight = this.container.clientHeight;
        const canvasWidth = this.container.clientWidth;

        for (const scene of this.scenes) {
            const rect = scene.element.getBoundingClientRect();

            // skip off screen elements
            if (rect.bottom < 0 || rect.top > canvasHeight || 
                rect.right < 0 || rect.left > canvasWidth) {
                continue;
            }

            const width = rect.right - rect.left;
            const height = rect.bottom - rect.top;
            const left = rect.left;
            const bottom = canvasHeight - rect.bottom; 

            this.renderer.setViewport(left, bottom, width, height);
            this.renderer.setScissor(left, bottom, width, height);

            scene.render(this.renderer);
        }
    };
}
