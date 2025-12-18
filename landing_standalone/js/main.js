// Configuración de la Escena Three.js
const container = document.getElementById('canvas-container');

// Escena
const scene = new THREE.Scene();
// Fog para dar profundidad (negro como el fondo)
scene.fog = new THREE.FogExp2(0x050505, 0.002);

// Cámara
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 200;

// Renderizador
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// --- CREACIÓN DE PARTÍCULAS ---
const geometry = new THREE.BufferGeometry();
const count = 2000;
const positions = new Float32Array(count * 3);
const colors = new Float32Array(count * 3);

const color1 = new THREE.Color(0x25D366); // WhatsApp Green
const color2 = new THREE.Color(0x00E5FF); // Cyan Accent

for (let i = 0; i < count; i++) {
    // Posición aleatoria
    positions[i * 3] = (Math.random() - 0.5) * 1000;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 1000;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 1000;

    // Color aleatorio entre los dos tonos
    const mixedColor = color1.clone().lerp(color2, Math.random());
    colors[i * 3] = mixedColor.r;
    colors[i * 3 + 1] = mixedColor.g;
    colors[i * 3 + 2] = mixedColor.b;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// Material de puntos
const material = new THREE.PointsMaterial({
    size: 3,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
});

// Mesh (Nube de puntos)
const particles = new THREE.Points(geometry, material);
scene.add(particles);

// --- ANIMACIÓN ---
let mouseX = 0;
let mouseY = 0;

// Interacción suave con el mouse
document.addEventListener('mousemove', (event) => {
    mouseX = event.clientX - window.innerWidth / 2;
    mouseY = event.clientY - window.innerHeight / 2;
});

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);

    // Rotación constante suave
    particles.rotation.x += 0.0005;
    particles.rotation.y += 0.0005;

    // Movimiento reactivo al mouse (parallax sutil)
    camera.position.x += (mouseX * 0.05 - camera.position.x) * 0.05;
    camera.position.y += (-mouseY * 0.05 - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
}

animate();
