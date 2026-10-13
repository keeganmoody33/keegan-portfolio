'use client'

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Bounds, ContactShadows, OrbitControls, useBounds } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { partByName } from '@/lib/yadiggg-parts'
import { webglContextIsLost, webglContextIsUsable } from '@/lib/webgl'
import { bindStudyContextLoss, studyGlFromCreate, type StudyRendererLike } from '@/lib/yadiggg-gl'
import {
  CAMERA_PRESETS,
  YADIGGG_STAGE_INK,
  YADIGGG_STAGE_PAPER,
  formatPartLabel,
  shouldCaptureWheel,
  type CameraPreset,
  type SleeveViewMode,
} from '@/lib/yadiggg-viewer'

const HOUSE_ORANGE = 0xe23d00
const STAGE_PAPER = Number.parseInt(YADIGGG_STAGE_PAPER.slice(1), 16)
const STAGE_INK = Number.parseInt(YADIGGG_STAGE_INK.slice(1), 16)
const HOUSE_USB = 0x49b0d3
const HOUSE_AUDIO = 0xb8c95e
const HOUSE_PAD = 0x7f8085
const HIDDEN_ALWAYS = new Set(['display_active'])
const SECTION_HIDDEN = new Set(['shell_front', 'display_window', 'study_legend'])
const CONTROL_MESHES = new Set([
  'control_up',
  'control_select',
  'control_down',
  'control_mechanism',
])

type ControlsApi = {
  target: THREE.Vector3
  enabled: boolean
  update: () => void
}

export type YadigggViewerProps = {
  src: string
  view: SleeveViewMode
  preset: CameraPreset
  presetTick: number
  reducedMotion: boolean
  focusRootId: string
  onPart: (label: string, note: string, source: 'hover' | 'select') => void
  onPartLeave: () => void
  onReady: () => void
  onError: () => void
}

class StudyErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: () => void }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error) {
    console.error('YadigggViewer caught:', error)
    this.props.onError()
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
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

function inkEdge(mesh: THREE.Mesh): THREE.LineSegments {
  const existing = mesh.userData.inkEdge as THREE.LineSegments | undefined
  if (existing) return existing
  const line = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 28),
    new THREE.LineBasicMaterial({
      color: STAGE_INK,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
    })
  )
  line.renderOrder = 4
  line.visible = false
  mesh.add(line)
  mesh.userData.inkEdge = line
  return line
}

function setHighlight(mesh: THREE.Mesh, on: boolean, kind: 'hover' | 'select' = 'hover') {
  const edge = inkEdge(mesh)
  edge.visible = on
  const edgeMaterial = edge.material as THREE.LineBasicMaterial
  edgeMaterial.opacity = kind === 'select' ? 1 : 0.88
  forEachMaterial(mesh, (material) => {
    rememberEmissive(material)
    if (on) {
      material.emissive.setHex(HOUSE_ORANGE)
      material.emissiveIntensity = Math.max(
        material.userData.baseEmissiveIntensity as number,
        kind === 'select' ? 1.08 : 0.88
      )
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
        material.opacity = view === 'xray' ? 0.12 : 0.34
        material.depthWrite = false
        material.roughness = view === 'xray' ? 0.12 : 0.16
        material.metalness = 0.04
        material.envMapIntensity = view === 'xray' ? 1.8 : 1.7
      }
      if (mesh.name === 'display_window') {
        material.transparent = true
        material.opacity = 0.08
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
      if (CONTROL_MESHES.has(mesh.name)) {
        paintControl(material)
      } else if (mesh.name === 'display_module') {
        material.color.setHex(HOUSE_PAD)
        material.roughness = 0.42
        material.metalness = 0.12
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
    const ctx = gl.getContext()
    if (!webglContextIsUsable(ctx) || webglContextIsLost(ctx)) return null
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const rendered = pmrem.fromScene(room, 0.04)
    room.dispose()
    pmrem.dispose()
    return rendered.texture
  }, [gl])

  useEffect(() => () => texture?.dispose(), [texture])

  if (!texture) return null
  return <primitive object={texture} attach="environment" />
}

function InkContactShadow({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <ContactShadows
      position={[0, -0.058, 0]}
      opacity={0.58}
      scale={0.22}
      blur={2.1}
      far={0.16}
      frames={1}
      color="#000"
    />
  )
}

function createStudyRenderer(props: THREE.WebGLRendererParameters): THREE.WebGLRenderer {
  const canvas = props.canvas
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('webgl probe failed')
  }
  // Do not call getContext on this canvas before WebGLRenderer — the first
  // attribute set wins, and hasWebGL() used to lock in alpha:false.
  const renderer = new THREE.WebGLRenderer({
    ...props,
    canvas,
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
  })
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.02
  const ctx = renderer.getContext()
  if (!webglContextIsUsable(ctx) || webglContextIsLost(ctx)) {
    renderer.dispose()
    throw new Error('webgl getExtension unavailable')
  }
  return renderer
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
  view,
  onPart,
  onPartLeave,
  onReady,
  onError,
}: {
  src: string
  view: SleeveViewMode
  onPart: (label: string, note: string, source: 'hover' | 'select') => void
  onPartLeave: () => void
  onReady: () => void
  onError: () => void
}) {
  const { gl } = useThree()
  const bounds = useBounds()
  const [r1, setR1] = useState<THREE.Group | null>(null)
  const pointer = useRef<[number, number] | null>(null)
  const hovered = useRef<THREE.Mesh | null>(null)
  const selected = useRef<THREE.Mesh | null>(null)
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
        const prepared = prepareScene(gltf.scene)
        applyView(prepared, view)
        setR1(prepared)
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
    // Load once per src; view applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, onError, onReady])

  useEffect(() => {
    if (r1) applyView(r1, view)
  }, [r1, view])

  useEffect(() => {
    if (!r1) return
    bounds.refresh().clip().fit()
  }, [bounds, r1])

  const clearHover = () => {
    if (!hovered.current) return
    if (hovered.current !== selected.current) setHighlight(hovered.current, false)
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
    const part = partByName(mesh.name)
    if (!part) return false
    if (source === 'hover') {
      if (hovered.current !== mesh) {
        if (hovered.current && hovered.current !== selected.current) {
          setHighlight(hovered.current, false)
        }
        hovered.current = mesh
        setHighlight(mesh, true, mesh === selected.current ? 'select' : 'hover')
      }
    } else {
      if (selected.current && selected.current !== mesh) setHighlight(selected.current, false)
      selected.current = mesh
      hovered.current = mesh
      setHighlight(mesh, true, 'select')
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

  return (
    <group onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerMove={onPointerMove}>
      <primitive object={r1} visible={view !== 'compare'} />
    </group>
  )
}

function GatedOrbit({
  view,
  reducedMotion,
  focusRootId,
}: {
  view: SleeveViewMode
  reducedMotion: boolean
  focusRootId: string
}) {
  const { camera, gl, controls } = useThree()
  const orbitOn = view !== 'compare'

  useEffect(() => {
    const node = gl.domElement
    const stageFocused = () => {
      const root = document.getElementById(focusRootId)
      if (!root) return false
      const active = document.activeElement
      return active === root || root.contains(active)
    }

    const onPointerDown = () => {
      document.getElementById(focusRootId)?.focus({ preventScroll: true })
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) event.stopImmediatePropagation()
    }

    const onWheel = (event: WheelEvent) => {
      if (!orbitOn) return
      event.stopImmediatePropagation()
      if (!shouldCaptureWheel(stageFocused(), event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      const orbit = controls as ControlsApi | null
      const target = orbit?.target ?? new THREE.Vector3()
      const offset = camera.position.clone().sub(target)
      const factor = event.deltaY > 0 ? 1.08 : 0.92
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, 0.14, 0.48))
      camera.position.copy(target).add(offset)
      orbit?.update()
    }

    node.addEventListener('pointerdown', onPointerDown)
    node.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    node.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => {
      node.removeEventListener('pointerdown', onPointerDown)
      node.removeEventListener('touchstart', onTouchStart, true)
      node.removeEventListener('wheel', onWheel, true)
    }
  }, [camera, controls, focusRootId, gl, orbitOn])

  return (
    <OrbitControls
      makeDefault
      enableDamping={!reducedMotion && orbitOn}
      dampingFactor={0.05}
      enablePan={false}
      enableRotate={orbitOn}
      enableZoom={orbitOn}
      enabled={orbitOn}
      minDistance={0.14}
      maxDistance={0.48}
      touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
    />
  )
}

function ContextLossGuard({ onLost }: { onLost: () => void }) {
  const { gl } = useThree()
  const onLostRef = useRef(onLost)
  useEffect(() => {
    onLostRef.current = onLost
  }, [onLost])
  useEffect(() => bindStudyContextLoss(gl.domElement, () => onLostRef.current()), [gl])
  return null
}

function YadigggCanvas({
  src,
  view,
  preset,
  presetTick,
  reducedMotion,
  focusRootId,
  onPart,
  onPartLeave,
  onReady,
  onError,
}: YadigggViewerProps) {
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const glFactory = useCallback((props: THREE.WebGLRendererParameters) => {
    return studyGlFromCreate(
      () => createStudyRenderer(props) as unknown as StudyRendererLike,
      () => onErrorRef.current(),
      props.canvas instanceof HTMLCanvasElement ? props.canvas : null
    ) as unknown as THREE.WebGLRenderer
  }, [])

  return (
    <Canvas
      className="absolute inset-0 h-full w-full bg-transparent cursor-grab !touch-pan-y active:cursor-grabbing"
      gl={glFactory}
      onCreated={(state) => {
        try {
          state.gl.setClearColor(0x000000, 0)
          const ctx = state.gl.getContext()
          if (!webglContextIsUsable(ctx) || webglContextIsLost(ctx)) onErrorRef.current()
        } catch {
          onErrorRef.current()
        }
      }}
      camera={{
        position: [...CAMERA_PRESETS.reset],
        fov: 31,
        near: 0.001,
        far: 5,
      }}
      dpr={[1, 2]}
      aria-hidden
    >
      <ContextLossGuard onLost={() => onErrorRef.current()} />
      <RoomEnv />
      <hemisphereLight args={[0xffffff, STAGE_PAPER, 1.2]} />
      <directionalLight position={[-0.12, 0.22, 0.24]} intensity={1.85} color="#ffffff" />
      <directionalLight position={[0.22, 0.08, -0.16]} intensity={0.28} color="#e23d00" />
      <directionalLight position={[0.18, 0.2, -0.22]} intensity={0.55} color="#ffffff" />
      <directionalLight position={[0, 0.32, 0.05]} intensity={0.4} color="#ffffff" />
      <Bounds fit clip margin={1.28} maxDuration={0}>
        <StudyModel
          src={src}
          view={view}
          onPart={onPart}
          onPartLeave={onPartLeave}
          onReady={onReady}
          onError={onError}
        />
        <DeviceLcd view={view} />
      </Bounds>
      <InkContactShadow visible={view !== 'exploded' && view !== 'compare'} />
      <GatedOrbit view={view} reducedMotion={reducedMotion} focusRootId={focusRootId} />
      <CameraPresetRig preset={preset} presetTick={presetTick} reducedMotion={reducedMotion} />
      <KeyboardOrbit focusRootId={focusRootId} reducedMotion={reducedMotion} />
    </Canvas>
  )
}

export default function YadigggViewer(props: YadigggViewerProps) {
  return (
    <StudyErrorBoundary onError={props.onError}>
      <YadigggCanvas {...props} />
    </StudyErrorBoundary>
  )
}
