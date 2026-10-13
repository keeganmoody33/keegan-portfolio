'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  isCandidateAControl,
  partByName,
} from '@/lib/yadiggg-parts'
import {
  CAMERA_PRESETS,
  formatPartLabel,
  type CameraPreset,
  type ControlCandidate,
  type SleeveViewMode,
} from '@/lib/yadiggg-viewer'

const HOUSE_BG = 0x0a0a0a
const HOUSE_ORANGE = 0xe23d00
const HOUSE_USB = 0x49b0d3
const HOUSE_AUDIO = 0xb8c95e
const HIDDEN_ALWAYS = new Set(['display_active'])
const SECTION_HIDDEN = new Set(['shell_front', 'display_window', 'study_legend'])
const CONTROL_MESHES = new Set([
  'control_up',
  'control_select',
  'control_down',
  'control_mechanism',
  'control_capture',
])

type ControlsApi = {
  target: THREE.Vector3
  enabled: boolean
  update: () => void
}

export type YadigggViewerProps = {
  src: string
  candidateSrc: string
  view: SleeveViewMode
  candidate: ControlCandidate
  preset: CameraPreset
  presetTick: number
  reducedMotion: boolean
  focusRootId: string
  onPart: (label: string, note: string, source: 'hover' | 'select') => void
  onPartLeave: () => void
  onReady: () => void
  onError: () => void
}

function forEachMaterial(mesh: THREE.Mesh, fn: (material: THREE.MeshStandardMaterial) => void) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const material of materials) {
    if (material instanceof THREE.MeshStandardMaterial) fn(material)
  }
}

function rememberEmissive(material: THREE.MeshStandardMaterial) {
  if (!material.userData.baseEmissive) {
    material.userData.baseEmissive = material.emissive.clone()
    material.userData.baseEmissiveIntensity = material.emissiveIntensity
  }
}

function setHighlight(mesh: THREE.Mesh, on: boolean) {
  forEachMaterial(mesh, (material) => {
    rememberEmissive(material)
    if (on) {
      material.emissive.setHex(HOUSE_ORANGE)
      material.emissiveIntensity = Math.max(material.userData.baseEmissiveIntensity as number, 0.42)
    } else {
      material.emissive.copy(material.userData.baseEmissive as THREE.Color)
      material.emissiveIntensity = material.userData.baseEmissiveIntensity as number
    }
  })
}

function paintControl(material: THREE.MeshStandardMaterial) {
  material.color.setHex(HOUSE_ORANGE)
  material.emissive.setHex(HOUSE_ORANGE)
  material.emissiveIntensity = 0.28
  material.roughness = 0.32
  material.metalness = 0.08
}

function applyView(root: THREE.Object3D, view: SleeveViewMode, candidate: ControlCandidate) {
  root.traverse((obj) => {
    if (obj.type !== 'Mesh') return
    const mesh = obj as THREE.Mesh
    const part = partByName(mesh.name, candidate)

    mesh.position.z = view === 'exploded' ? (part?.explodeMm ?? 0) * 0.001 : 0

    if (HIDDEN_ALWAYS.has(mesh.name)) {
      mesh.visible = false
      return
    }

    mesh.visible = part?.kind !== 'construction' || view === 'xray'
    if (view === 'section' && SECTION_HIDDEN.has(mesh.name)) mesh.visible = false
    if (isCandidateAControl(mesh.name)) mesh.visible = candidate === 'A' && mesh.visible

    forEachMaterial(mesh, (material) => {
      if (mesh.name.startsWith('shell_')) {
        material.transparent = true
        material.opacity = view === 'xray' ? 0.12 : 0.4
        material.depthWrite = false
        material.roughness = view === 'xray' ? 0.18 : 0.28
        material.envMapIntensity = view === 'xray' ? 1.35 : 1.05
      }
      if (mesh.name === 'display_window') {
        material.transparent = true
        material.opacity = 0.1
        material.depthWrite = false
      }
    })
  })
}

function prepareScene(source: THREE.Group, asControls: boolean): THREE.Group {
  const scene = source.clone(true)
  scene.traverse((obj) => {
    if (obj.type !== 'Mesh') return
    const mesh = obj as THREE.Mesh
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const clones = materials.map((material) => material.clone())
    mesh.material = clones.length === 1 ? clones[0]! : clones
    forEachMaterial(mesh, (material) => {
      if (asControls || CONTROL_MESHES.has(mesh.name)) {
        paintControl(material)
      } else if (mesh.name === 'usb_reservation') {
        material.color.setHex(HOUSE_USB)
      } else if (mesh.name === 'jack_reservation') {
        material.color.setHex(HOUSE_AUDIO)
      }
      rememberEmissive(material)
    })
  })
  return scene
}

function paintFactsLcd(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#afc875'
  ctx.fillRect(0, 0, 400, 240)
  ctx.fillStyle = '#0a0a0a'
  ctx.font = '800 13px Doto, monospace'
  ctx.fillText('YADIGGG / R1', 14, 22)
  ctx.fillRect(12, 30, 376, 2)
  ctx.font = '800 26px Doto, monospace'
  ctx.fillText('MADE FOR THE DIG', 14, 68)
  ctx.font = '800 14px Doto, monospace'
  ctx.fillText('105 × 60 × 15 mm  smoke-clear', 14, 100)
  ctx.fillText('2.7" memory LCD', 14, 124)
  ctx.fillText('one orange side button', 14, 148)
  ctx.fillText('USB-C  ·  3.5 mm', 14, 172)
}

function DeviceLcd({ view }: { view: SleeveViewMode }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 240
    paintFactsLcd(canvas)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.magFilter = THREE.NearestFilter
    map.userData.canvas = canvas
    return map
  }, [])

  useEffect(() => {
    let cancelled = false
    const canvas = texture.userData.canvas as HTMLCanvasElement
    const redraw = () => {
      if (cancelled) return
      paintFactsLcd(canvas)
      texture.needsUpdate = true
    }
    void document.fonts.load('800 26px Doto').then(redraw)
    document.fonts.addEventListener('loadingdone', redraw)
    return () => {
      cancelled = true
      document.fonts.removeEventListener('loadingdone', redraw)
    }
  }, [texture])

  if (view === 'compare') return null
  const z = 0.005876 + (view === 'exploded' ? 0.015 : 0)
  return (
    <mesh position={[0, 0.024, z]} visible={view !== 'section'}>
      <planeGeometry args={[0.0588, 0.03528]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

function RoomEnv() {
  const { gl } = useThree()
  const texture = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const rendered = pmrem.fromScene(room, 0.04)
    room.dispose()
    pmrem.dispose()
    return rendered.texture
  }, [gl])

  useEffect(() => () => texture.dispose(), [texture])

  return <primitive object={texture} attach="environment" />
}

function GroundBlob({ visible }: { visible: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const gradient = ctx.createRadialGradient(64, 64, 1, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(236, 236, 236, 0.22)')
    gradient.addColorStop(0.45, 'rgba(226, 61, 0, 0.08)')
    gradient.addColorStop(1, 'rgba(10, 10, 10, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [])

  if (!texture) return null
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.056, 0]} visible={visible}>
      <planeGeometry args={[0.15, 0.075]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
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
  reducedMotion,
}: {
  preset: CameraPreset
  presetTick: number
  reducedMotion: boolean
}) {
  const { camera, controls } = useThree()
  const goal = useMemo(() => new THREE.Vector3(), [])
  const origin = useMemo(() => new THREE.Vector3(), [])
  const animating = useRef(false)

  useEffect(() => {
    const position = CAMERA_PRESETS[preset]
    goal.set(position[0], position[1], position[2])
    animating.current = true
    if (reducedMotion) {
      camera.position.copy(goal)
      const orbit = controls as ControlsApi | null
      orbit?.target.copy(origin)
      orbit?.update()
      animating.current = false
    }
  }, [camera, controls, goal, origin, preset, presetTick, reducedMotion])

  useFrame((_, delta) => {
    if (!animating.current) return
    const orbit = controls as ControlsApi | null
    const alpha = 1 - Math.exp(-delta * 7)
    camera.position.lerp(goal, alpha)
    orbit?.target.lerp(origin, alpha)
    orbit?.update()
    if (camera.position.distanceTo(goal) < 0.001) {
      camera.position.copy(goal)
      orbit?.target.copy(origin)
      orbit?.update()
      animating.current = false
    }
  })

  return null
}

function StudyModel({
  src,
  candidateSrc,
  view,
  candidate,
  onPart,
  onPartLeave,
  onReady,
  onError,
}: {
  src: string
  candidateSrc: string
  view: SleeveViewMode
  candidate: ControlCandidate
  onPart: (label: string, note: string, source: 'hover' | 'select') => void
  onPartLeave: () => void
  onReady: () => void
  onError: () => void
}) {
  const { gl } = useThree()
  const [r1, setR1] = useState<THREE.Group | null>(null)
  const [candidateB, setCandidateB] = useState<THREE.Group | null>(null)
  const pointer = useRef<[number, number] | null>(null)
  const hovered = useRef<THREE.Mesh | null>(null)
  const onPartLeaveRef = useRef(onPartLeave)

  useEffect(() => {
    onPartLeaveRef.current = onPartLeave
  }, [onPartLeave])

  useEffect(() => {
    let cancelled = false
    const loader = new GLTFLoader()

    loader.load(
      src,
      (gltf) => {
        if (cancelled) return
        const prepared = prepareScene(gltf.scene, false)
        applyView(prepared, view, candidate)
        setR1(prepared)
        onReady()
      },
      undefined,
      () => {
        if (!cancelled) onError()
      }
    )
    loader.load(
      candidateSrc,
      (gltf) => {
        if (cancelled) return
        const prepared = prepareScene(gltf.scene, true)
        setCandidateB(prepared)
      }
    )

    return () => {
      cancelled = true
    }
    // Load once per src; view/candidate applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, candidateSrc, onError, onReady])

  useEffect(() => {
    if (r1) applyView(r1, view, candidate)
  }, [r1, view, candidate])

  const clearHover = () => {
    if (!hovered.current) return
    setHighlight(hovered.current, false)
    hovered.current = null
    onPartLeaveRef.current()
  }

  useEffect(() => {
    const node = gl.domElement
    node.addEventListener('pointerleave', clearHover)
    return () => node.removeEventListener('pointerleave', clearHover)
  }, [gl])

  const inspect = (object: THREE.Object3D, source: 'hover' | 'select') => {
    if (object.type !== 'Mesh') return false
    const mesh = object as THREE.Mesh
    if (!mesh.visible) return false
    const part = partByName(mesh.name, candidate)
    if (!part) return false
    if (source === 'hover') {
      if (hovered.current !== mesh) {
        if (hovered.current) setHighlight(hovered.current, false)
        hovered.current = mesh
        setHighlight(mesh, true)
      }
    }
    onPart(formatPartLabel(part.name), part.note, source)
    return true
  }

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    pointer.current = [event.clientX, event.clientY]
  }

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (view === 'compare') return
    if (event.object.type !== 'Mesh') return
    if (!inspect(event.object, 'hover')) clearHover()
  }

  const onPointerUp = (event: ThreeEvent<PointerEvent>) => {
    const start = pointer.current
    pointer.current = null
    if (!start) return
    if (Math.hypot(event.clientX - start[0], event.clientY - start[1]) >= 6) return
    inspect(event.object, 'select')
  }

  if (!r1) return null

  const showR1 = view !== 'compare'
  const showB = view !== 'compare' && candidate === 'B' && candidateB !== null

  return (
    <group onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerMove={onPointerMove}>
      <primitive object={r1} visible={showR1} />
      {candidateB ? <primitive object={candidateB} visible={showB} /> : null}
    </group>
  )
}

export default function YadigggViewer({
  src,
  candidateSrc,
  view,
  candidate,
  preset,
  presetTick,
  reducedMotion,
  focusRootId,
  onPart,
  onPartLeave,
  onReady,
  onError,
}: YadigggViewerProps) {
  return (
    <Canvas
      className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
      gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
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
      <RoomEnv />
      <hemisphereLight args={[0xffffff, 0x555555, 0.8]} />
      <directionalLight position={[-0.1, 0.2, 0.2]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[0.22, 0.05, -0.14]} intensity={0.28} color="#e23d00" />
      <StudyModel
        src={src}
        candidateSrc={candidateSrc}
        view={view}
        candidate={candidate}
        onPart={onPart}
        onPartLeave={onPartLeave}
        onReady={onReady}
        onError={onError}
      />
      <DeviceLcd view={view} />
      <GroundBlob visible={view !== 'exploded' && view !== 'compare'} />
      <OrbitControls
        makeDefault
        enableDamping={!reducedMotion}
        dampingFactor={0.05}
        enablePan={false}
        enabled={view !== 'compare'}
        minDistance={0.14}
        maxDistance={0.48}
      />
      <CameraPresetRig preset={preset} presetTick={presetTick} reducedMotion={reducedMotion} />
      <KeyboardOrbit focusRootId={focusRootId} reducedMotion={reducedMotion} />
    </Canvas>
  )
}
