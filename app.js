import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene, Camera, Renderer
const container = document.getElementById('container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 10, 0);
controls.update();

// Lighting
scene.add(new THREE.AmbientLight(0x909090));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(50, 50, 50);
scene.add(directionalLight);

// Helper object to manage block data
const worldData = {};
function setBlock(x, y, z, blockType) {
  const key = `${x},${y},${z}`;
  worldData[key] = blockType;
}
function getBlock(x, y, z) {
  const key = `${x},${y},${z}`;
  return worldData[key] || null;
}

// Dynamic block colors
const blockColors = {};
function getRandomColor(blockType) {
  if (!blockColors[blockType]) {
    blockColors[blockType] = Math.random() * 0xffffff; // Random color for each block type
  }
  return blockColors[blockType];
}

// Function to add 3D blocks
function addBlock(x, y, z, blockType) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: getRandomColor(blockType),
    flatShading: true,
  });
  const block = new THREE.Mesh(geometry, material);
  block.position.set(x, y, z);
  scene.add(block);
}

// Function to create visible geometry for blocks
function addVisibleBlockFaces(x, y, z, blockType) {
    const directions = [
      { // left
          dir: [-1, 0, 0],
          corners: [
            [0, 1, 0],
            [0, 0, 0],
            [0, 1, 1],
            [0, 0, 1],
          ],
        },
        { // right
          dir: [1, 0, 0],
          corners: [
            [1, 1, 1],
            [1, 0, 1],
            [1, 1, 0],
            [1, 0, 0],
          ],
        },
        { // bottom
          dir: [0, -1, 0],
          corners: [
            [1, 0, 1],
            [0, 0, 1],
            [1, 0, 0],
            [0, 0, 0],
          ],
        },
        { // top
          dir: [0, 1, 0],
          corners: [
            [0, 1, 1],
            [1, 1, 1],
            [0, 1, 0],
            [1, 1, 0],
          ],
        },
        { // back
          dir: [0, 0, -1],
          corners: [
            [1, 0, 0],
            [0, 0, 0],
            [1, 1, 0],
            [0, 1, 0],
          ],
        },
        { // front
          dir: [0, 0, 1],
          corners: [
            [0, 0, 1],
            [1, 0, 1],
            [0, 1, 1],
            [1, 1, 1],
          ],
        },
    ];
  
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const indices = [];
  
    // Loop through each direction and check if a face is needed
    for (const { dir, corners } of directions) {
      const neighbor = getBlock(x + dir[0], y + dir[1], z + dir[2]);
      if (!neighbor || neighbor === 'minecraft:air') { // Check if no neighbor or neighbor is air
        const normal = dir;
        const startIndex = positions.length / 3; // To track indices for faces
  
        // Add the 4 corners to form the face
        for (const corner of corners) {
          positions.push(corner[0] + x, corner[1] + y, corner[2] + z);
          normals.push(...normal);
        }
  
        // Define the two triangles of the square face
        indices.push(startIndex, startIndex + 1, startIndex + 2);
        indices.push(startIndex + 2, startIndex + 1, startIndex + 3);
      }
    }
  
    if (positions.length > 0) {
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setIndex(indices);
  
      // Use MeshStandardMaterial to allow shading and lighting
      const material = new THREE.MeshStandardMaterial({
        color: getRandomColor(blockType),
        flatShading: true,
      });
  
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    }
}


// Load blocks and generate visible faces
async function loadSlab(xStart, yStart, zStart, xEnd, yEnd, zEnd) {
  const response = await fetch(
    `http://localhost:8080/world/slab?xStart=${xStart}&yStart=${yStart}&zStart=${zStart}&xEnd=${xEnd}&yEnd=${yEnd}&zEnd=${zEnd}`
  );
  const text = await response.text();

  const blocks = text.split('\n').map(line => {
    const [x, y, z, blockType] = line.split(',');
    return { x: parseInt(x), y: parseInt(y), z: parseInt(z), blockType };
  });

  blocks.forEach(({ x, y, z, blockType }) => {
    if (blockType && blockType !== 'minecraft:air') {
      setBlock(x, y, z, blockType);
    }
  });

  blocks.forEach(({ x, y, z, blockType }) => {
    if (blockType && blockType !== 'minecraft:air') {
      addVisibleBlockFaces(x, y, z, blockType);
    }
  });
}

// Dynamically load chunks within a range
function loadVisibleChunks(camera) {
  const range = 8;
  const chunkSize = 16;
  const camPos = camera.position;

  const startX = Math.floor(camPos.x / chunkSize) * chunkSize - range;
  const startZ = Math.floor(camPos.z / chunkSize) * chunkSize - range;
  const endX = startX + 2 * range;
  const endZ = startZ + 2 * range;

  for (let x = startX; x < endX; x += chunkSize) {
    for (let z = startZ; z < endZ; z += chunkSize) {
      loadSlab(x, -64, z, x + chunkSize, 100, z + chunkSize);
    }
  }
}

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

loadVisibleChunks(camera); // Load initial chunks
animate();
