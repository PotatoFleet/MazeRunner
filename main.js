/*
    TODO:
    1. Fix movement bug
    2. Clean up code (and write comments)
*/

"use strict";

import "./style.css";
import stoneTextureURL from "./stone_block.jpg";

import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import { ClearPass } from "three/examples/jsm/postprocessing/ClearPass.js";

import MazeGenerator from "./maze_generator";

const finishedEl = document.getElementById("finished");
const fpsEl = document.querySelector(".fps");
const timeEl = document.querySelector(".time");
const fireworksEl = document.getElementById("fireworks");

const bloomScene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  100,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

const controls = new PointerLockControls(camera, renderer.domElement);

// Keep generating a new maze until starting position is valid
let maze;
do maze = MazeGenerator.GenerateMaze(20, 20);
while (maze[0].indexOf(3) < 2 || maze[0].indexOf(3) > 18);

const WALL_WIDTH = 1;
const WALL_DEPTH = 1;
const WALL_HEIGHT = 3;

const PLAYER_WIDTH = 0.3;
const PLAYER_DEPTH = 0.3;

const PLAYER_SPEED = 0.075;

let walls = [];
let tiles = [];
let bloomTiles = [];
let times = [];
let keys = {};
let secondDone = true;
let endTile;
let wallIndex = 0;
let tileIndex = 0;
let startTime = 0;
let timeTaken = 0;
let running = false;

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

// more realistic shadows
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.domElement.classList.add("threejs");

// sky color
bloomScene.background = new THREE.Color(0x7788ff);

const scene = new THREE.Scene();

const clearPass = new ClearPass();

const renderPass1 = new RenderPass(bloomScene, camera);
renderPass1.clear = false;
const renderPass2 = new RenderPass(scene, camera);
renderPass2.clear = false;

const outputPass = new ShaderPass(CopyShader);
outputPass.renderToScreen = true;

// used for bloom effect on tiles
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.2,
  10,
  0
);

const composer = new EffectComposer(renderer);
composer.addPass(clearPass);
composer.addPass(renderPass1);
composer.addPass(bloomPass);
composer.addPass(renderPass2);
composer.addPass(outputPass);

// loads wall texture
const wallTexture = new THREE.TextureLoader().load(stoneTextureURL);
wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.repeat.set(1, 2);

// instanced mesh for walls and tiles for high performance

const wallMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(WALL_WIDTH, WALL_HEIGHT, WALL_DEPTH),
  new THREE.MeshPhongMaterial({
    map: wallTexture,
  }),
  numberOfWalls()
);

const tileMesh = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(WALL_WIDTH, WALL_DEPTH),
  new THREE.MeshPhongMaterial({ color: 0xbcaaaa }),
  numberOfTiles()
);

// enablge shadows for walls and tiles
wallMesh.castShadow = true;
wallMesh.receiveShadow = true;
tileMesh.receiveShadow = true;

// lighting
const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
sunLight.position.set(0, 60, 30);
sunLight.target.position.set(0, 0, 0);
sunLight.castShadow = true;
sunLight.shadow.camera.top = 100;
sunLight.shadow.camera.bottom = -150;
sunLight.shadow.camera.left = -50;
sunLight.shadow.camera.right = 50;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);

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

function numberOfWalls() {
  let count = 2;
  for (let i = 0; i < maze.length; i++) {
    for (let j = 0; j < maze[i].length; j++) {
      if (maze[i][j] === 1) count++;
    }
  }
  return count;
}

function numberOfTiles() {
  let count = 0;
  for (let i = 0; i < maze.length; i++) {
    for (let j = 0; j < maze[i].length; j++) {
      if (typeof maze[i][j] === "object") count++;
    }
  }
  return count;
}

function init() {
  document.body.appendChild(renderer.domElement);
  document.querySelector(".threejs").addEventListener("click", () => {
    controls.lock();
  });
  scene.add(wallMesh);
  scene.add(tileMesh);
  scene.add(sunLight);
  scene.add(sunLight.target);
  scene.add(ambientLight);

  // maze generation
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
        }
        createFloorTile(x, z, clr);
      }
    }
  }
}

function createWall(x, z) {
  let matrix = new THREE.Matrix4();
  matrix.makeTranslation(x, 0, z);
  wallMesh.setMatrixAt(wallIndex++, matrix);
  walls.push({ x: x, z: z });
}

function createFloorTile(x, z, clr) {
  const tile = { x: x, z: z };
  tiles.push(tile);

  // adds to tile mesh if normal tile
  // adds to bloom scene if starting or ending tile
  if (clr === 0xbcaaaa) {
    const translation = new THREE.Matrix4().makeTranslation(x, -1.5, z);
    const rotation = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

    tileMesh.setMatrixAt(tileIndex++, translation.multiply(rotation));
  } else {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(WALL_WIDTH, WALL_DEPTH),
      new THREE.MeshBasicMaterial({ color: clr })
    );

    mesh.rotateX(-Math.PI / 2);
    mesh.position.set(x, -1.5, z);
    bloomScene.add(mesh);

    // storing end tile for future use
    if (clr === 0xff0000) endTile = tile;
  }
}

// helper function
function tileAt(x, z) {
  for (const tile of tiles) {
    if (
      x > tile.x - 0.5 &&
      x < tile.x + 0.5 &&
      z > tile.z - 0.5 &&
      z < tile.z + 0.5
    ) {
      return tile;
    }
  }
  return null;
}

// helper function
function getAdjacentTiles(tile) {
  let res = [null, null, null, null];
  for (const t of tiles) {
    if (t.x === tile.x && t.z === tile.z + WALL_DEPTH) {
      res[0] = t;
    } else if (t.x === tile.x && t.z === tile.z - WALL_DEPTH) {
      res[1] = t;
    } else if (t.x === tile.x + WALL_WIDTH && t.z === tile.z) {
      res[2] = t;
    } else if (t.x === tile.x - WALL_WIDTH && t.z === tile.z) {
      res[3] = t;
    }
  }
  return res;
}

// distance function for a*
function manhattanDistance(a, b) {
  return Math.abs(a.z - b.z) + Math.abs(a.x - b.x);
}

function key(x) {
  return `${x.x} ${x.z}`;
}

async function pathFind() {
  /* 
  A* SEARCH ALGORITHM (AI Part)

  Guarantees shortest path from start node to end node

  Here, highlights the shortest path (through bloom tiles) from the current position the ending position
  */

  let open = [];
  let closed = [];
  let parent = {};

  let currTile;

  let startTile = tileAt(
    controls.getObject().position.x,
    controls.getObject().position.z
  );

  open.push(startTile);

  while (open.length > 0) {
    let leastFX = Infinity;
    currTile = null;

    for (const tile of open) {
      let gX = manhattanDistance(startTile, tile);
      let hX = manhattanDistance(endTile, tile);
      let fX = gX + hX;
      if (
        fX < leastFX ||
        (fX === leastFX && gX > manhattanDistance(startTile, currTile))
      ) {
        leastFX = fX;
        currTile = tile;
      }
    }

    if (currTile === endTile) break;

    for (const tile of getAdjacentTiles(currTile)) {
      if (!tile) continue;

      if (open.includes(tile)) {
        if (
          manhattanDistance(startTile, tile) <=
          manhattanDistance(startTile, currTile) + 1
        )
          continue;
      } else if (closed.includes(tile)) {
        if (
          manhattanDistance(startTile, tile) <=
          manhattanDistance(startTile, currTile) + 1
        )
          continue;
        closed = closed.filter((t) => t !== tile);
        open.push(tile);
      } else {
        open.push(tile);
      }
      parent[key(tile)] = currTile;
    }

    open = open.filter((tile) => tile !== currTile);
    closed.push(currTile);
  }

  let route = [];

  while (true) {
    currTile = parent[key(currTile)];
    if (currTile === startTile) break;
    route.push(currTile);
  }

  route.push(
    tileAt(controls.getObject().position.x, controls.getObject().position.z)
  );

  for (const tile of bloomTiles) bloomScene.remove(tile);

  bloomTiles = [];

  for (const tile of route.reverse()) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(WALL_WIDTH, WALL_DEPTH),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    mesh.rotateX(-Math.PI / 2);
    mesh.position.set(tile.x, -1.49, tile.z);
    bloomScene.add(mesh);
    bloomTiles.push(mesh);
    await sleep(400);
  }
}

// render function
function animate() {
  handlePlayer();
  composer.render();
  if (!running) return;
  requestAnimationFrame(function () {
    // keeps track of fps

    const now = performance.now();
    while (times.length > 0 && times[0] <= now - 1000) times.shift();
    times.push(now);

    // updates necessary fields every second
    if (secondDone) {
      timeTaken = parseInt((new Date().getTime() - startTime) / 1000);

      fpsEl.textContent = "FPS: " + times.length;
      timeEl.textContent = "Time Taken: " + timeTaken;

      secondDone = false;

      setTimeout(() => (secondDone = true), 1000);
    }

    animate();
  });
}

// collision function
function collided(x1, z1, x2, z2) {
  return (
    x1 >= x2 - PLAYER_WIDTH &&
    x1 <= x2 + WALL_WIDTH + PLAYER_WIDTH &&
    z1 >= z2 - PLAYER_DEPTH &&
    z1 <= z2 + WALL_DEPTH + PLAYER_DEPTH
  );
}

// player movement handling

/* 
  Known Bug 🐛: If you look up and face certain directions while moving, you may go the opposite direction
  Due to finding this bug in the last minute, I wasn't able to fix it in time.
  A better approach would have been to use quaternions.
*/
function handlePlayer() {
  if (keys["w"] || keys["s"] || keys["a"] || keys["d"]) {
    let rotation = controls.getObject().rotation.z;
    let { x, z } = controls.getObject().position;

    let dx = 0;
    let dz = 0;

    if (keys["w"]) {
      dx -= Math.sin(rotation) * PLAYER_SPEED;
      dz -= Math.cos(rotation) * PLAYER_SPEED;
    }

    if (keys["s"]) {
      dx += Math.sin(rotation) * PLAYER_SPEED;
      dz += Math.cos(rotation) * PLAYER_SPEED;
    }

    if (keys["a"]) {
      dx -= Math.sin(rotation + Math.PI / 2) * PLAYER_SPEED;
      dz -= Math.cos(rotation + Math.PI / 2) * PLAYER_SPEED;
    }

    if (keys["d"]) {
      dx += Math.sin(rotation + Math.PI / 2) * PLAYER_SPEED;
      dz += Math.cos(rotation + Math.PI / 2) * PLAYER_SPEED;
    }

    let allowX = true;
    let allowZ = true;

    for (const wall of walls) {
      const wallx = wall.x - 0.5;
      const wallz = wall.z - 0.5;

      x += dx;
      if (collided(x, z, wallx, wallz)) allowX = false;
      x -= dx;

      z += dz;
      if (collided(x, z, wallx, wallz)) allowZ = false;
      z -= dz;
    }

    if (allowX) controls.getObject().position.x += dx;
    if (allowZ) controls.getObject().position.z += dz;

    const end = { x: endTile.x, z: endTile.z - WALL_DEPTH };
    if (
      x > end.x - 0.2 &&
      x < end.x - 0.2 + WALL_WIDTH &&
      z > end.z + 0.2 &&
      z < end.z + 0.2 + WALL_DEPTH
    ) {
      finished();
      running = false;
    }
  }
}

function finished() {
  // displaying transition to finished screen
  finishedEl.classList.remove("hidden");
  finishedEl.textContent = timeTaken + " Seconds Taken";

  document.getElementById("ai-info").classList.add("hidden");

  fpsEl.classList.add("hidden");
  timeEl.classList.add("hidden");

  document.querySelector(".threejs").classList.add("slide-down");
  finishedEl.classList.add("slide-down");
  fireworksEl.classList.add("slide-down");

  controls.unlock();

  drawFireworks(25);
}

// firework functions for the end of the game
function initFirework(
  x,
  y,
  count,
  clr,
  delay = 0,
  lifespan = 125,
  speed = 1.5
) {
  let shards = [];
  for (let i = 0; i < count; i++) {
    let angle = (360 / count) * i;

    // storing trajectories
    shards.push([
      x,
      y,
      speed * Math.cos((angle / 180) * Math.PI),
      speed * Math.sin((angle / 180) * Math.PI),
      lifespan,
      lifespan,
      clr,
      delay,
    ]);
  }
  return shards;
}

function randomColor() {
  let availableColors = ["red", "blue", "green", "yellow", "pink"];
  return availableColors[Math.floor(Math.random() * availableColors.length)];
}

function drawFireworks(fireworkCount = 5) {
  fireworksEl.width = document.body.clientWidth;
  fireworksEl.height = document.body.clientHeight;
  const ctx = fireworksEl.getContext("2d");
  let shards = [];
  for (let i = 0; i < fireworkCount; i++)
    shards.push(
      ...initFirework(
        Math.floor(Math.random() * fireworksEl.width),
        Math.floor(Math.random() * fireworksEl.height),
        10,
        randomColor(),
        Math.floor(Math.random() * 7),
        100 + Math.floor(Math.random() * 100),
        1.75
      )
    );
  fireworkAnimate(ctx, shards);
}

function fireworkAnimate(ctx, shards) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const shard of shards) {
    if (shard[7] > 0) {
      shard[7] -= 0.05;
      continue;
    }
    ctx.fillStyle = shard[6];
    ctx.globalAlpha = shard[4] / shard[5];
    ctx.fillRect(shard[0], shard[1], 10, 10);
    ctx.globalAlpha = 1.0;
    shard[0] += shard[2];
    shard[1] += shard[3];
    if (!--shard[4]) shards = shards.filter((el) => el != shard);
  }
  requestAnimationFrame(() => fireworkAnimate(ctx, shards));
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

playBtn.addEventListener("click", () => {
  running = true;

  startTime = new Date().getTime();

  playBtn.classList.remove("scale");
  playBtn.classList.add("hidden");

  // start game

  init();

  controls.lock();

  animate();
});
