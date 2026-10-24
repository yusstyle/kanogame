import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const charactersDir = path.resolve('public/assets/characters');

function getBones(skeleton) {
  return Array.isArray(skeleton) ? skeleton : skeleton.bones;
}

function getBoneByName(name, bones) {
  for (let i = 0; i < bones.length; i++) {
    if (name === bones[i].name) return bones[i];
  }
  return null;
}

function retargetClip(clip, newName, validJointNames, options = {}) {
  const positionMultiplier = options.positionMultiplier ?? 0.01;
  const positionOffset = options.positionOffset ?? 0;
  const removeHipsForwardAnimation = options.removeHipsForwardAnimation ?? false;
  const ignoreBones = new Set(options.ignoreBones ?? []);

  const tracks = [];
  const validJointSet = new Set(validJointNames);

  for (const track of clip.tracks) {
    // FBX track names are usually "mixamorig:Hips.quaternion" or "Hips.quaternion" or "mixamorig_Hips.quaternion"
    const dotIdx = track.name.lastIndexOf('.');
    let boneName = track.name.substring(0, dotIdx);
    const prop = track.name.substring(dotIdx + 1);

    // Strip namespaces like "mixamorig:" or "mixamorig" or "mixamorig_"
    boneName = boneName.replace(/^mixamorig[:_]?/i, '');
    boneName = boneName.replace(/^Armature[:_]?/i, '');
    boneName = boneName.replace(/^Reference[:_]?/i, '');

    if (!validJointSet.has(boneName)) {
      continue;
    }
    if (ignoreBones.has(boneName)) {
      continue;
    }

    if (track instanceof THREE.VectorKeyframeTrack && prop === 'position' && boneName === 'Hips') {
      const times = new Float32Array(track.times);
      const values = new Float32Array(track.values.length);
      for (let i = 0; i < track.values.length; i++) {
        let v = track.values[i] * positionMultiplier;
        // In Mixamo/FBX, Z is forward or Y is forward depending on coordinate system
        // Let's check removeHipsForwardAnimation
        if (removeHipsForwardAnimation && i % 3 === 2) {
          // Keep root in place along Z for in-place locomotion
          v = 0;
        }
        if (positionOffset !== 0 && i % 3 === 1) {
          v += positionOffset;
        }
        values[i] = v;
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${boneName}.${prop}`, times, values));
    } else if (track instanceof THREE.QuaternionKeyframeTrack && prop === 'quaternion') {
      const times = new Float32Array(track.times);
      const values = new Float32Array(track.values);
      tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.${prop}`, times, values));
    }
  }

  return new THREE.AnimationClip(newName, clip.duration, tracks);
}

async function main() {
  // Read Black_M_1_Casual.glb to get exact joint names
  const glbBuf = fs.readFileSync(path.join(charactersDir, 'Black_M_1_Casual.glb'));
  const jsonChunkLen = glbBuf.readUInt32LE(12);
  const gltf = JSON.parse(glbBuf.toString('utf8', 20, 20 + jsonChunkLen));
  const jointIndices = gltf.skins[0].joints;
  const jointNames = jointIndices.map(idx => gltf.nodes[idx].name);
  console.log(`Found ${jointNames.length} joints in Black_M_1_Casual.glb`);
  console.log('Joints sample:', jointNames.slice(0, 15));

  const fbxLoader = new FBXLoader();

  const animationDefs = [
    {
      file: 'BreathingIdle.fbx',
      clipName: 'idle',
      options: { positionMultiplier: 0.01, positionOffset: 0 }
    },
    {
      file: 'Walking.fbx',
      clipName: 'walk',
      options: { positionMultiplier: 0.01, positionOffset: 0, removeHipsForwardAnimation: true }
    },
    {
      file: 'SittingIdle_man.fbx',
      clipName: 'drive',
      options: { positionMultiplier: 0.01, positionOffset: 0 }
    }
  ];

  const exportedClips = {};

  for (const def of animationDefs) {
    const fbxPath = path.join(charactersDir, def.file);
    const fbxBuf = fs.readFileSync(fbxPath);
    const ab = fbxBuf.buffer.slice(fbxBuf.byteOffset, fbxBuf.byteOffset + fbxBuf.byteLength);
    const obj = fbxLoader.parse(ab, '');
    if (!obj.animations || obj.animations.length === 0) {
      console.warn(`No animations in ${def.file}`);
      continue;
    }
    const sourceClip = obj.animations[0];
    console.log(`Loaded ${def.file}: duration=${sourceClip.duration.toFixed(2)}s, tracks=${sourceClip.tracks.length}`);
    const retargeted = retargetClip(sourceClip, def.clipName, jointNames, def.options);
    console.log(`Retargeted to "${def.clipName}": tracks=${retargeted.tracks.length}`);
    exportedClips[def.clipName] = THREE.AnimationClip.toJSON(retargeted);
  }

  // Also synthesize a "run" clip from walk with 1.6x speed
  if (exportedClips.walk) {
    const walkParsed = THREE.AnimationClip.parse(exportedClips.walk);
    const runTracks = walkParsed.tracks.map(t => {
      const times = new Float32Array(t.times.length);
      for (let i = 0; i < t.times.length; i++) {
        times[i] = t.times[i] / 1.6;
      }
      return t.clone().setInterpolation(THREE.InterpolateLinear);
    });
    // Adjust duration
    const runClip = new THREE.AnimationClip('run', walkParsed.duration / 1.6, runTracks);
    exportedClips.run = THREE.AnimationClip.toJSON(runClip);
    console.log(`Synthesized "run" clip: duration=${runClip.duration.toFixed(2)}s, tracks=${runClip.tracks.length}`);
  }

  const outPath = path.join(charactersDir, 'humanoid_animations.json');
  fs.writeFileSync(outPath, JSON.stringify(exportedClips));
  console.log(`Saved compiled animations to ${outPath} (${fs.statSync(outPath).size} bytes)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
