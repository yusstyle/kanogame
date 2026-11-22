import * as THREE from "three";

const SHARED_ACROSS_WORLDS = "sharedAcrossWorlds";

export function markWorldResourceShared<T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(resource: T): T {
  resource.userData[SHARED_ACROSS_WORLDS] = true;
  return resource;
}

export function collectMaterialResources(material: THREE.Material, resources: Set<object>): void {
  resources.add(material);
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) resources.add(value);
  }
}

export function collectObjectResources(root: THREE.Object3D, resources: Set<object>): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    resources.add(object.geometry);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) collectMaterialResources(material, resources);
  });
}

export function disposeWorldResources(root: THREE.Object3D, protectedResources: Set<object>): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const instancedMeshes = new Set<THREE.InstancedMesh>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.InstancedMesh) instancedMeshes.add(object);
    if (!protectedResources.has(object.geometry) && !object.geometry.userData[SHARED_ACROSS_WORLDS]) {
      geometries.add(object.geometry);
    }
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of objectMaterials) {
      if (protectedResources.has(material) || material.userData[SHARED_ACROSS_WORLDS]) {
        collectMaterialResources(material, protectedResources);
      } else {
        materials.add(material);
      }
    }
  });

  const textures = new Set<THREE.Texture>();
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture && !protectedResources.has(value) && !value.userData[SHARED_ACROSS_WORLDS]) {
        textures.add(value);
      }
    }
  }

  for (const mesh of instancedMeshes) {
    const morphTexture = mesh.morphTexture;
    if (!morphTexture || (!protectedResources.has(morphTexture) && !morphTexture.userData[SHARED_ACROSS_WORLDS])) {
      mesh.dispose();
    }
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
}
