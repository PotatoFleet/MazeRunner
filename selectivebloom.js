// import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
// import {OrbitControls} from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls";

// import { EffectComposer } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/EffectComposer.js';
// import { RenderPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/RenderPass.js';
// import { ShaderPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/ShaderPass.js';
// import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// import { ImprovedNoise } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/math/ImprovedNoise.js';
// let noise = new ImprovedNoise();

// let scene = new THREE.Scene();
// let camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 1000);
// camera.position.set(0, 0, 10);
// let renderer = new THREE.WebGLRenderer();
// renderer.setSize(innerWidth, innerHeight);
// renderer.toneMapping = THREE.ReinhardToneMapping;
// document.body.appendChild(renderer.domElement);
// window.addEventListener("resize", () => {
//   camera.aspect = innerWidth / innerHeight;
//   camera.updateProjectionMatrix();
//   renderer.setSize(innerWidth, innerHeight)
// })

// let controls = new OrbitControls(camera, renderer.domElement);

// let light = new THREE.DirectionalLight(0xffffff, 1.5);
// light.position.setScalar(1);
// scene.add(light, new THREE.AmbientLight(0xffffff, 0.5));

// let MAX_COUNT = 10000;

// let globalUniforms = {
//   bloom: {value: 0}
// }

// let g = new THREE.BoxGeometry(0.1, 0.1, 0.1);
// let m = new THREE.MeshLambertMaterial({
//   onBeforeCompile: shader => {
//     shader.uniforms.bloom = globalUniforms.bloom;
//     shader.vertexShader = `
//       attribute float shine;
//       varying float vShine;
//       ${shader.vertexShader}
//     `.replace(
//       `#include <color_vertex>`,
//       `#include <color_vertex>
//         vShine = shine;
//       `
//     );
//     //console.log(shader.vertexShader);
//     shader.fragmentShader = `
//       uniform float bloom;
//       varying float vShine;
//       ${shader.fragmentShader}
//     `.replace(
//       `#include <dithering_fragment>`,
//       `#include <dithering_fragment>

//         gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0), bloom);
//         gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(vec3(1), vColor, bloom), vShine);

//       `
//     );
//     console.log(shader.fragmentShader);
//   }
// });
// let o = new THREE.InstancedMesh(g, m, MAX_COUNT);

// let dummy = new THREE.Object3D();
// let rvec = new THREE.Vector3();
// let col = new THREE.Color();
// for(let i = 0; i < MAX_COUNT; i++){
//   dummy.position.randomDirection();
//   let mult = 0.75;
//   let n = noise.noise(dummy.position.x * mult, dummy.position.y * mult, dummy.position.z * mult);
//   dummy.position.setLength(3 + Math.abs(n) * 2);
//   dummy.rotation.setFromVector3(rvec.random().subScalar(0.5).multiplyScalar(Math.PI * 2));
//   dummy.updateMatrix();
//   o.setMatrixAt(i, dummy.matrix);
//   o.setColorAt(i, col.set(Math.random() > 0.5 ? 0xff3232 : 0x00ffff));
// }

// g.setAttribute("shine", new THREE.InstancedBufferAttribute(new Float32Array(new Array(MAX_COUNT).fill(0).map(m => {return Math.random() < 0.025 ? 1 : 0})), 1));

// scene.add(o);

// // BLOOM
// const params = {
//   exposure: 1,
//   bloomStrength: 5,
//   bloomThreshold: 0,
//   bloomRadius: 0.5
// };

// const renderScene = new RenderPass( scene, camera );

// const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
// bloomPass.threshold = params.bloomThreshold;
// bloomPass.strength = params.bloomStrength;
// bloomPass.radius = params.bloomRadius;

// const bloomComposer = new EffectComposer( renderer );
// bloomComposer.renderToScreen = false;
// bloomComposer.addPass( renderScene );
// bloomComposer.addPass( bloomPass );

// const finalPass = new ShaderPass(
//   new THREE.ShaderMaterial( {
//     uniforms: {
//       baseTexture: { value: null },
//       bloomTexture: { value: bloomComposer.renderTarget2.texture }
//     },
//     vertexShader: document.getElementById( 'vertexshader' ).textContent,
//     fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
//     defines: {}
//   } ), 'baseTexture'
// );
// finalPass.needsSwap = true;

// const finalComposer = new EffectComposer( renderer );
// finalComposer.addPass( renderScene );
// finalComposer.addPass( finalPass );

// setInterval(() => {
//   let shine = g.attributes.shine;
//   for(let i = 0; i < MAX_COUNT; i++){
//     shine.setX(i, Math.random() < 0.025 ? 1 : 0);
//   }
//   shine.needsUpdate = true;
// }, 1500);

// renderer.setAnimationLoop(() => {
//   o.rotation.y += 0.001;
//   globalUniforms.bloom.value = 1;
//   bloomComposer.render();
//   globalUniforms.bloom.value = 0;
//   finalComposer.render();
//   //renderer.render(scene, camera);
// });
