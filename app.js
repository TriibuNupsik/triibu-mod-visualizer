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
camera.position.set(0, 110, 20);
controls.target.set(0, 80, 0);
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
    if (blockType && blockType !== 'minecraft:air' && blockType !== 'minecraft:grass') {
      setBlock(x, y, z, blockType);
    }
  });

  blocks.forEach(({ x, y, z, blockType }) => {
    if (blockType && blockType !== 'minecraft:air' && blockType !== 'minecraft:grass') {
      addVisibleBlockFaces(x, y, z, blockType);
    }
  });
}

// Modified loadVisibleChunks to use input
function loadVisibleChunks(x = 0, z = 0, yStart = 60, yEnd = 120, renderDistance = 16) {
  const chunkSize = 16;

  // Calculate the min/max world coordinates to cover a (renderDistance*2)x(renderDistance*2) area centered on x,z
  const minX = x - renderDistance;
  const maxX = x + renderDistance - 1;
  const minZ = z - renderDistance;
  const maxZ = z + renderDistance - 1;

  // Find the chunk range that covers the block range
  const startChunkX = Math.floor(minX / chunkSize);
  const endChunkX = Math.floor(maxX / chunkSize);
  const startChunkZ = Math.floor(minZ / chunkSize);
  const endChunkZ = Math.floor(maxZ / chunkSize);

  for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX++) {
    for (let chunkZ = startChunkZ; chunkZ <= endChunkZ; chunkZ++) {
      const worldX = chunkX * chunkSize+1;
      const worldZ = chunkZ * chunkSize+1;
      loadSlab(worldX, yStart, worldZ, worldX + chunkSize+1, yEnd, worldZ + chunkSize+1);
    }
  }
}

// Add event listener for the button
document.getElementById('loadBtn').addEventListener('click', () => {
  // Clear all block meshes from the scene
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const obj = scene.children[i];
    if (obj.isMesh) {
      scene.remove(obj);
    }
  }
  // Clear worldData
  for (const key in worldData) {
    delete worldData[key];
  }

  const x = parseInt(document.getElementById('posX').value, 10);
  const z = parseInt(document.getElementById('posZ').value, 10);
  const yStartInput = document.getElementById('posYStart');
  const yEndInput = document.getElementById('posYEnd');
  const renderDistanceInput = document.getElementById('renderDistance');
  const yStart = yStartInput ? parseInt(yStartInput.value, 10) : 60;
  const yEnd = yEndInput ? parseInt(yEndInput.value, 10) : 120;
  const renderDistance = renderDistanceInput ? parseInt(renderDistanceInput.value, 10) : 16;
  loadVisibleChunks(
    x,
    z,
    isNaN(yStart) ? 60 : yStart,
    isNaN(yEnd) ? 120 : yEnd,
    isNaN(renderDistance) ? 16 : renderDistance
  );
});

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

loadVisibleChunks(0,0,60,120,16); // Load initial chunks
animate();
