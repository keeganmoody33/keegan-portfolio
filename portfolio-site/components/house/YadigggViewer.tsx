'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { partByName } from '@/lib/yadiggg-parts'
import {
  CAMERA_PRESETS,
  formatPartLabel,
  type CameraPreset,
  type SleeveViewMode,
} from '@/lib/yadiggg-viewer'

const HOUSE_BG = 0x0a0a0a
const HOUSE_ORANGE = 0xe23d00
const HOUSE_PAD = 0x7f8085
const HOUSE_LCD = 0xafc875
const HOUSE_USB = 0x49b0d3
const HOUSE_AUDIO = 0xb8c95e
const HIDDEN_ALWAYS = new Set(['display_active', 'study_legend'])
const SECTION_HIDDEN = new Set(['shell_front', 'display_window'])
const CONTROL_NAMES = new Set(['control_up', 'control_select', 'control_down'])

type ControlsApi = {
  target: THREE.Vector3
  update: () => void
}

export type YadigggViewerProps = {
  src: string
  view: SleeveViewMode
  preset: CameraPreset
  presetTick: number
  reducedMotion: boolean
  focusRootId: string
  onPart: (label: string, note: string) => void
  onReady: () => void
  onError: () => void
}

function forEachMaterial(mesh: THREE.Mesh, fn: (material: THREE.MeshStandardMaterial) => void) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const material of materials) {
    if (material instanceof THREE.MeshStandardMaterial) fn(material)
  }
}

function tintForMesh(name: string): number | null {
  if (CONTROL_NAMES.has(name) || name === 'control_mechanism') return HOUSE_ORANGE
  if (name === 'usb_reservation') return HOUSE_USB
  if (name === 'jack_reservation') return HOUSE_AUDIO
  if (name.startsWith('display_')) return HOUSE_LCD
  if (name.startsWith('shell_') || name === 'display_window') return HOUSE_PAD
  return null
}

function applyView(root: THREE.Object3D, view: SleeveViewMode) {
  root.traverse((obj) => {
    if (obj.type !== 'Mesh') return
    const mesh = obj as THREE.Mesh
    const part = partByName(mesh.name)

    mesh.position.z = view === 'exploded' ? (part?.explodeMm ?? 0) * 0.001 : 0

    if (HIDDEN_ALWAYS.has(mesh.name)) {
      mesh.visible = false
      return
    }

    mesh.visible = part?.kind !== 'construction' || view === 'xray'
    if (view === 'section' && SECTION_HIDDEN.has(mesh.name)) mesh.visible = false

    forEachMaterial(mesh, (material) => {
      if (mesh.name.startsWith('shell_')) {
        material.transparent = true
        material.opacity = view === 'xray' ? 0.12 : 0.4
        material.depthWrite = false
      }
      if (mesh.name === 'display_window') {
        material.transparent = true
        material.opacity = 0.1
        material.depthWrite = false
      }
    })
  })
}

function prepareScene(source: THREE.Group): THREE.Group {
  const scene = source.clone(true)
  scene.traverse((obj) => {
    if (obj.type !== 'Mesh') return
    const mesh = obj as THREE.Mesh
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const clones = materials.map((material) => material.clone())
    mesh.material = clones.length === 1 ? clones[0]! : clones
    forEachMaterial(mesh, (material) => {
      const tint = tintForMesh(mesh.name)
      if (tint !== null) material.color.setHex(tint)
      if (CONTROL_NAMES.has(mesh.name)) {
        material.emissive.setHex(HOUSE_ORANGE)
        material.emissiveIntensity = 0.18
      }
    })
  })
  return scene
}

function KeyboardOrbit({
  focusRootId,
  reducedMotion,
}: {
  focusRootId: string
  reducedMotion: boolean
}) {
  const { camera, controls } = useThree()
  const spherical = useMemo(() => new THREE.Spherical(), [])

  useEffect(() => {
    const step = reducedMotion ? 0.2 : 0.12
    const onKey = (event: KeyboardEvent) => {
      const root = document.getElementById(focusRootId)
      if (!root) return
      if (document.activeElement !== root && !root.contains(document.activeElement)) return
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) {
        return
      }
      event.preventDefault()
      const orbit = controls as ControlsApi | null
      const target = orbit?.target ?? new THREE.Vector3()
      spherical.setFromVector3(camera.position.clone().sub(target))
      if (event.key === 'ArrowLeft') spherical.theta -= step
      if (event.key === 'ArrowRight') spherical.theta += step
      if (event.key === 'ArrowUp') spherical.phi -= step
      if (event.key === 'ArrowDown') spherical.phi += step
      if (event.key === '+' || event.key === '=') spherical.radius *= 0.9
      if (event.key === '-') spherical.radius *= 1.1
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.05, Math.PI - 0.05)
      spherical.radius = THREE.MathUtils.clamp(spherical.radius, 0.14, 0.48)
      camera.position.copy(new THREE.Vector3().setFromSpherical(spherical).add(target))
      orbit?.update()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [camera, controls, focusRootId, reducedMotion, spherical])

  return null
}

function CameraPresetRig({
  preset,
  presetTick,
}: {
  preset: CameraPreset
  presetTick: number
}) {
  const { camera, controls } = useThree()

  useEffect(() => {
    const position = CAMERA_PRESETS[preset]
    camera.position.set(position[0], position[1], position[2])
    const orbit = controls as ControlsApi | null
    orbit?.target.set(0, 0, 0)
    orbit?.update()
  }, [camera, controls, preset, presetTick])

  return null
}

function StudyModel({
  src,
  view,
  onPart,
  onReady,
  onError,
}: {
  src: string
  view: SleeveViewMode
  onPart: (label: string, note: string) => void
  onReady: () => void
  onError: () => void
}) {
  const [scene, setScene] = useState<THREE.Group | null>(null)
  const pointer = useRef<[number, number] | null>(null)

  useEffect(() => {
    let cancelled = false
    const loader = new GLTFLoader()
    loader.load(
      src,
      (gltf) => {
        if (cancelled) return
        const prepared = prepareScene(gltf.scene)
        applyView(prepared, view)
        setScene(prepared)
        onReady()
      },
      undefined,
      () => {
        if (!cancelled) onError()
      }
    )
    return () => {
      cancelled = true
    }
    // Load once per src; view is applied in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, onError, onReady])

  useEffect(() => {
    if (scene) applyView(scene, view)
  }, [scene, view])

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    pointer.current = [event.clientX, event.clientY]
  }

  const onPointerUp = (event: ThreeEvent<PointerEvent>) => {
    const start = pointer.current
    pointer.current = null
    if (!start) return
    if (Math.hypot(event.clientX - start[0], event.clientY - start[1]) >= 6) return
    const mesh = event.object
    if (mesh.type !== 'Mesh') return
    const part = partByName(mesh.name)
    if (!part || !mesh.visible) return
    onPart(formatPartLabel(part.name), part.note)
  }

  if (!scene) return null

  return <primitive object={scene} onPointerDown={onPointerDown} onPointerUp={onPointerUp} />
}

export default function YadigggViewer({
  src,
  view,
  preset,
  presetTick,
  reducedMotion,
  focusRootId,
  onPart,
  onReady,
  onError,
}: YadigggViewerProps) {
  return (
    <Canvas
      className="absolute inset-0 h-full w-full touch-none"
      gl={{ antialias: true, alpha: false }}
      camera={{
        position: [...CAMERA_PRESETS.reset],
        fov: 31,
        near: 0.001,
        far: 5,
      }}
      dpr={[1, 2]}
      aria-hidden
    >
      <color attach="background" args={[HOUSE_BG]} />
      <ambientLight intensity={0.55} color="#ececec" />
      <directionalLight position={[-0.1, 0.2, 0.2]} intensity={1.6} color="#ffffff" />
      <directionalLight position={[0.2, 0.05, -0.15]} intensity={0.35} color="#afc875" />
      <StudyModel src={src} view={view} onPart={onPart} onReady={onReady} onError={onError} />
      <OrbitControls
        makeDefault
        enableDamping={!reducedMotion}
        enablePan={false}
        minDistance={0.14}
        maxDistance={0.48}
      />
      <CameraPresetRig preset={preset} presetTick={presetTick} />
      <KeyboardOrbit focusRootId={focusRootId} reducedMotion={reducedMotion} />
    </Canvas>
  )
}
