import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const charactersDir = path.resolve('public/assets/characters');

function retargetClip(clip, newName, validJointNames, options = {}) {
  const positionMultiplier = options.positionMultiplier ?? 0.01;
  const inPlace = options.inPlace ?? false;

  const tracks = [];
  const validJointSet = new Set(validJointNames);

  // FBX Mixamo models have a "Reference" node rotated by -90 deg around X.
  // When retargeting to glTF (which does not have the Reference parent node),
  // we must transform Hips position and quaternion by this parent rotation.
  const refQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

  for (const track of clip.tracks) {
    const dotIdx = track.name.lastIndexOf('.');
    let boneName = track.name.substring(0, dotIdx);
    const prop = track.name.substring(dotIdx + 1);

    // Strip namespaces
    boneName = boneName.replace(/^mixamorig[:_]?/i, '');
    boneName = boneName.replace(/^Armature[:_]?/i, '');
    boneName = boneName.replace(/^Reference[:_]?/i, '');

    if (!validJointSet.has(boneName)) {
      continue;
    }

    if (boneName === 'Hips' && prop === 'position' && track instanceof THREE.VectorKeyframeTrack) {
      const times = new Float32Array(track.times);
      const values = new Float32Array(track.values.length);
      const v = new THREE.Vector3();
      for (let i = 0; i < track.values.length; i += 3) {
        v.set(track.values[i], track.values[i + 1], track.values[i + 2]).multiplyScalar(positionMultiplier);
        v.applyQuaternion(refQuat);

        values[i] = v.x;
        values[i + 1] = v.y;
        values[i + 2] = inPlace ? 0 : v.z;
      }
      tracks.push(new THREE.VectorKeyframeTrack(`Hips.position`, times, values));
    } else if (boneName === 'Hips' && prop === 'quaternion' && track instanceof THREE.QuaternionKeyframeTrack) {
      const times = new Float32Array(track.times);
      const values = new Float32Array(track.values.length);
      const q = new THREE.Quaternion();
      for (let i = 0; i < track.values.length; i += 4) {
        q.set(track.values[i], track.values[i + 1], track.values[i + 2], track.values[i + 3]);
        q.premultiply(refQuat);
        values[i] = q.x;
        values[i + 1] = q.y;
        values[i + 2] = q.z;
        values[i + 3] = q.w;
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`Hips.quaternion`, times, values));
    } else if (prop === 'quaternion' && track instanceof THREE.QuaternionKeyframeTrack) {
      tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.${prop}`, track.times, track.values));
    }
  }

  return new THREE.AnimationClip(newName, clip.duration, tracks);
}

async function main() {
  const glbBuf = fs.readFileSync(path.join(charactersDir, 'Black_M_1_Casual.glb'));
  const jsonChunkLen = glbBuf.readUInt32LE(12);
  const gltf = JSON.parse(glbBuf.toString('utf8', 20, 20 + jsonChunkLen));
  const jointIndices = gltf.skins[0].joints;
  const jointNames = jointIndices.map(idx => gltf.nodes[idx].name);
  console.log(`Found ${jointNames.length} joints in Black_M_1_Casual.glb`);

  const fbxLoader = new FBXLoader();

  const animationDefs = [
    {
      file: 'BreathingIdle.fbx',
      clipName: 'idle',
      options: { positionMultiplier: 0.01, inPlace: true }
    },
    {
      file: 'Walking.fbx',
      clipName: 'walk',
      options: { positionMultiplier: 0.01, inPlace: true }
    },
    {
      file: 'SittingIdle_man.fbx',
      clipName: 'drive',
      options: { positionMultiplier: 0.01, inPlace: true }
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
    const retargeted = retargetClip(sourceClip, def.clipName, jointNames, def.options);
    console.log(`Retargeted "${def.file}" -> "${def.clipName}": duration=${retargeted.duration.toFixed(2)}s, tracks=${retargeted.tracks.length}`);
    exportedClips[def.clipName] = THREE.AnimationClip.toJSON(retargeted);
  }

  // Synthesize "run" clip by speeding up walk
  if (exportedClips.walk) {
    const walkParsed = THREE.AnimationClip.parse(exportedClips.walk);
    const speedRatio = 1.6;
    const runTracks = walkParsed.tracks.map(t => {
      const times = new Float32Array(t.times.length);
      for (let i = 0; i < t.times.length; i++) {
        times[i] = t.times[i] / speedRatio;
      }
      return t.clone().setInterpolation(THREE.InterpolateLinear);
    });
    const runClip = new THREE.AnimationClip('run', walkParsed.duration / speedRatio, runTracks);
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
