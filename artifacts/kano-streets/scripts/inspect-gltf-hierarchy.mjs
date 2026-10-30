import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

globalThis.self = globalThis;
globalThis.createImageBitmap = () => Promise.resolve({});

const buf = fs.readFileSync('public/assets/characters/Black_M_1_Casual.glb');
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  console.log('GLTF Scene children:');
  gltf.scene.traverse((child) => {
    if (child.parent === gltf.scene || child.name === 'Armature' || child.name === 'Hips' || child.name.includes('Reference') || child.isBone) {
      if (child.parent === gltf.scene || child.name === 'Hips') {
        console.log(`  Node: "${child.name}", type: ${child.type}`);
        console.log(`    parent: "${child.parent?.name}"`);
        console.log(`    pos:`, child.position);
        console.log(`    rot (Euler):`, child.rotation);
        console.log(`    quaternion:`, child.quaternion);
      }
    }
  });
});
