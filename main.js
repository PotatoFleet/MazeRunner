"use strict";

import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import { ClearPass } from "three/examples/jsm/postprocessing/ClearPass.js";

const finishedEl = document.getElementById("finished");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  90,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

const controls = new PointerLockControls(camera, renderer.domElement);

const maze = [
  [1, 3, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 0, 1, 0, 1, 1],
  [1, 0, 1, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 1],
  [1, 1, 2, 1, 1, 1, 1],
];

const WALL_WIDTH = 1;
const WALL_DEPTH = 1;
const WALL_HEIGHT = 2;

const PLAYER_WIDTH = 0.2;
const PLAYER_DEPTH = 0.2;

const PLAYER_SPEED = 0.075;

let walls = [];
let tiles = [];
let keys = {};
let endPos = {};

scene.background = new THREE.Color(0x7788ff);

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 10, 0);
light.target.position.set(0, 0, 10);
scene.add(light);
scene.add(light.target);

const bloomScene = new THREE.Scene();

const clearPass = new ClearPass();

const renderPass1 = new RenderPass(scene, camera);
renderPass1.clear = false;
const renderPass2 = new RenderPass(bloomScene, camera);
renderPass2.clear = false;

const outputPass = new ShaderPass(CopyShader);
outputPass.renderToScreen = true;

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.25,
  3.5,
  0
);

const composer = new EffectComposer(renderer);
composer.addPass(clearPass);
composer.addPass(renderPass1);
composer.addPass(bloomPass);
composer.addPass(renderPass2);
composer.addPass(outputPass);

Array.prototype.equals = function (arr) {
  return (
    this.length === arr.length && this.every((val, idx) => val === arr[idx])
  );
};

Array.prototype.includes = function (x) {
  for (const el of this) {
    if (Array.isArray(el) && Array.isArray(x) && el.equals(x)) {
      return true;
    } else if (el === x) return true;
  }
  return false;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function init() {
  initMaze();
}

function createWall(x, z) {
  const geometry = new THREE.BoxGeometry(WALL_WIDTH, WALL_HEIGHT, WALL_DEPTH);

  const material = new THREE.MeshBasicMaterial({ color: 0x555555 });

  const wall = new THREE.Mesh(geometry, material);

  wall.position.x = x;
  wall.position.z = z;

  walls.push(wall);

  bloomScene.add(wall);
}

function createFloorTile(x, z, clr, i, j) {
  const geometry = new THREE.PlaneGeometry(WALL_WIDTH, WALL_DEPTH);
  const material = new THREE.MeshBasicMaterial({ color: clr });
  const plane = new THREE.Mesh(geometry, material);

  plane.rotation.x = -Math.PI / 2;
  plane.position.x = x;
  plane.position.y -= 1;
  plane.position.z = z;

  tiles.push({
    tile: plane,
    row: i + 1,
    col: j,
  });

  if (clr !== 0xbcaaaa) scene.add(plane);
  else bloomScene.add(plane);
}

function initMaze() {
  for (let i = maze.length - 1; i >= 0; i--) {
    for (let j = 0; j < maze[i].length; j++) {
      const x = (j - Math.floor(maze[0].length / 2)) * WALL_WIDTH;
      const z = (-i - 2) * WALL_DEPTH;
      if (maze[i][j] === 1) {
        createWall(x, z);
      } else {
        let clr = 0xbcaaaa;
        if (maze[i][j] === 3) {
          clr = 0x0000ff;
          createWall(x, z + WALL_DEPTH);
          controls.getObject().position.x = x;
          controls.getObject().position.y = 0.5;
          controls.getObject().position.z = z;
        } else if (maze[i][j] === 2) {
          clr = 0xff0000;
          createWall(x, z - WALL_DEPTH);
          endPos.x = x;
          endPos.z = z;
        }
        createFloorTile(x, z, clr, i, j);
      }
    }
  }
}

function posToMazePos(pos) {
  return [Math.ceil(pos.x + 2.5), maze.length - Math.ceil(pos.z + 6.5)];
}

function tileAt(i, j) {
  for (const tile of tiles) {
    if (tile.col === i && tile.row === j) {
      return tile;
    }
  }
  return null;
}

function getAdjacentPos(i, j) {
  return [
    [i + 1, j],
    [i - 1, j],
    [i, j + 1],
    [i, j - 1],
  ];
}

function manhattanDistance(a, b) {
  return Math.abs(a[1] - b[1]) + Math.abs(a[0] - b[0]);
}

function key(x) {
  return `${x[0]} ${x[1]}`;
}

async function pathFind() {
  /* 
  A* SEARCH ALGORITHM (AI Part)
  */

  let open = [];
  let closed = [];
  let parent = {};

  let currPos;
  let startPos = posToMazePos(controls.getObject().position);
  let end = posToMazePos(endPos);

  open.push(startPos);

  while (open.length > 0) {
    let leastFX = Infinity;
    currPos = null;

    for (const pos of open) {
      let gX = manhattanDistance(startPos, pos);
      let hX = manhattanDistance(end, pos);
      let fX = gX + hX;
      if (
        fX < leastFX ||
        (fX === leastFX && gX > manhattanDistance(startPos, currPos))
      ) {
        leastFX = fX;
        currPos = pos;
      }
    }

    if (currPos.equals(end)) break;

    for (const pos of getAdjacentPos(...currPos)) {
      if (!maze[pos[1] - 1] || maze[pos[1] - 1][pos[0]] === 1) continue;
      if (open.includes(pos)) {
        if (
          manhattanDistance(startPos, pos) <=
          manhattanDistance(startPos, currPos) + 1
        )
          continue;
      } else if (closed.includes(pos)) {
        if (
          manhattanDistance(startPos, pos) <=
          manhattanDistance(startPos, currPos) + 1
        )
          continue;
        closed = closed.filter((position) => !position.equals(pos));
        open.push(pos);
      } else {
        open.push(pos);
      }
      parent[key(pos)] = currPos;
    }

    open = open.filter((pos) => !pos.equals(currPos));
    closed.push(currPos);
  }

  let route = [];

  while (true) {
    currPos = parent[key(currPos)];
    if (currPos === startPos) break;
    route.push(currPos);
  }

  route.push(posToMazePos(controls.getObject().position));

  for (const pos of route.reverse()) {
    const tile = tileAt(...pos).tile;
    if (tile.parent === scene) continue;
    tile.material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
    });
    bloomScene.remove(tile);
    scene.add(tile);
    await sleep(400);
  }
}

function animate() {
  requestAnimationFrame(animate);
  composer.render();
  handlePlayer();
}

function handlePlayer() {
  if (keys["w"] || keys["s"] || keys["a"] || keys["d"]) {
    let rotation = controls.getObject().rotation.z;
    let dx1 = Math.sin(rotation) * PLAYER_SPEED;
    let dz1 = Math.cos(rotation) * PLAYER_SPEED;
    let dx2 = Math.sin(rotation + Math.PI / 2) * PLAYER_SPEED;
    let dz2 = Math.cos(rotation + Math.PI / 2) * PLAYER_SPEED;
    let originalX = controls.getObject().position.x;
    let originalZ = controls.getObject().position.z;
    if (keys["w"]) {
      controls.getObject().position.x -= dx1;
      controls.getObject().position.z -= dz1;
      const { x, z } = controls.getObject().position;
      for (const wall of walls) {
        const wallx = wall.position.x - 0.5;
        const wallz = wall.position.z - 0.5;
        const zCheck =
          z >= wallz - PLAYER_DEPTH && z <= wallz + WALL_DEPTH + PLAYER_DEPTH;
        const xCheck =
          x >= wallx - PLAYER_WIDTH && x <= wallx + WALL_WIDTH + PLAYER_WIDTH;
        if (zCheck && xCheck) {
          if (
            zCheck &&
            originalX >= wallx - PLAYER_WIDTH &&
            originalX <= wallx + WALL_WIDTH + PLAYER_WIDTH
          ) {
            controls.getObject().position.z += dz1;
          }
          if (
            originalZ >= wallz - PLAYER_DEPTH &&
            originalZ <= wallz + WALL_DEPTH + PLAYER_DEPTH &&
            xCheck
          ) {
            controls.getObject().position.x += dx1;
          }
        }
      }
    }
    if (keys["s"]) {
      controls.getObject().position.x += dx1;
      controls.getObject().position.z += dz1;
      const { x, z } = controls.getObject().position;
      for (const wall of walls) {
        const wallx = wall.position.x - 0.5;
        const wallz = wall.position.z - 0.5;
        const zCheck =
          z >= wallz - PLAYER_DEPTH && z <= wallz + WALL_DEPTH + PLAYER_DEPTH;
        const xCheck =
          x >= wallx - PLAYER_WIDTH && x <= wallx + WALL_WIDTH + PLAYER_WIDTH;
        if (zCheck && xCheck) {
          if (
            zCheck &&
            originalX >= wallx - PLAYER_WIDTH &&
            originalX <= wallx + WALL_WIDTH + PLAYER_WIDTH
          ) {
            controls.getObject().position.z -= dz1;
          }
          if (
            originalZ >= wallz - PLAYER_DEPTH &&
            originalZ <= wallz + WALL_DEPTH + PLAYER_DEPTH &&
            xCheck
          ) {
            controls.getObject().position.x -= dx1;
          }
        }
      }
    }
    if (keys["a"]) {
      controls.getObject().position.x -= dx2;
      controls.getObject().position.z -= dz2;
      const { x, z } = controls.getObject().position;
      for (const wall of walls) {
        const wallx = wall.position.x - 0.5;
        const wallz = wall.position.z - 0.5;
        const zCheck =
          z >= wallz - PLAYER_DEPTH && z <= wallz + WALL_DEPTH + PLAYER_DEPTH;
        const xCheck =
          x >= wallx - PLAYER_WIDTH && x <= wallx + WALL_WIDTH + PLAYER_WIDTH;
        if (zCheck && xCheck) {
          if (
            zCheck &&
            originalX >= wallx - PLAYER_WIDTH &&
            originalX <= wallx + WALL_WIDTH + PLAYER_WIDTH
          ) {
            controls.getObject().position.z += dz2;
          }
          if (
            originalZ >= wallz - PLAYER_DEPTH &&
            originalZ <= wallz + WALL_DEPTH + PLAYER_DEPTH &&
            xCheck
          ) {
            controls.getObject().position.x += dx2;
          }
        }
      }
    }
    if (keys["d"]) {
      controls.getObject().position.x += dx2;
      controls.getObject().position.z += dz2;
      const { x, z } = controls.getObject().position;
      for (const wall of walls) {
        const wallx = wall.position.x - 0.5;
        const wallz = wall.position.z - 0.5;
        const zCheck =
          z >= wallz - PLAYER_DEPTH && z <= wallz + WALL_DEPTH + PLAYER_DEPTH;
        const xCheck =
          x >= wallx - PLAYER_WIDTH && x <= wallx + WALL_WIDTH + PLAYER_WIDTH;
        if (zCheck && xCheck) {
          if (
            zCheck &&
            originalX >= wallx - PLAYER_WIDTH &&
            originalX <= wallx + WALL_WIDTH + PLAYER_WIDTH
          ) {
            controls.getObject().position.z -= dz2;
          }
          if (
            originalZ >= wallz - PLAYER_DEPTH &&
            originalZ <= wallz + WALL_DEPTH + PLAYER_DEPTH &&
            xCheck
          ) {
            controls.getObject().position.x -= dx2;
          }
        }
      }
    }
    const end = { x: endPos.x, z: endPos.z - WALL_DEPTH };
    if (
      originalX > end.x - 0.5 &&
      originalX < end.x - 0.5 + WALL_WIDTH &&
      originalZ > end.z + 0.5 &&
      originalZ < end.z + 0.5 + WALL_DEPTH
    ) {
      finished();
    }
  }
}

function finished() {
  finishedEl.classList.remove("hidden");
}

document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "p") {
    pathFind();
    return;
  }
  keys[e.key.toLowerCase()] = true;
});

document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const playBtn = document.getElementById("play-heading");

document.addEventListener("click", () => {
  controls.lock();
  playBtn.classList.remove("scale");
  playBtn.classList.add("hidden");
});

init();
animate();
