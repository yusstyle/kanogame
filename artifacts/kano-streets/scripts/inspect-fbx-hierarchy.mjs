import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const fbxPath = path.resolve('public/assets/characters/BreathingIdle.fbx');
const buf = fs.readFileSync(fbxPath);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new FBXLoader();
const obj = loader.parse(ab, '');

console.log('FBX Children:');
obj.traverse((child) => {
  if (child.name.includes('Hips') || child.name.includes('Armature') || child.name.includes('Root') || child.parent === obj) {
    console.log(`  Node: "${child.name}", type: ${child.type}`);
    console.log(`    pos:`, child.position);
    console.log(`    rot (Euler):`, child.rotation);
    console.log(`    quaternion:`, child.quaternion);
    console.log(`    scale:`, child.scale);
  }
});

console.log('\nFBX Animations:');
for (const anim of obj.animations) {
  console.log(`  Clip "${anim.name}", duration: ${anim.duration}`);
  for (const track of anim.tracks.slice(0, 8)) {
    console.log(`    Track: "${track.name}", values sample:`, Array.from(track.values.slice(0, 4)));
  }
}
