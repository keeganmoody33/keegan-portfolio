'use client'

import { useEffect, useRef } from 'react'
import {
  ShaderMount, ShaderFitOptions, getShaderColorFromString,
  liquidMetalFragmentShader, heatmapFragmentShader,
  toProcessedLiquidMetal, toProcessedHeatmap,
} from '@paper-design/shaders'
import type { ShaderMountUniforms } from '@paper-design/shaders'
import styles from './logo-motion.module.css'
import { LOGO_PRESETS, type LogoPreset } from './logo-presets'

export type LogoMaterial = 'silver' | 'heat'
const textures = new Map<LogoMaterial, Promise<Blob>>()

function textureFor(material: LogoMaterial) {
  let texture = textures.get(material)
  if (!texture) {
    texture = material === 'silver'
      ? toProcessedLiquidMetal('/brand/logo-white.svg').then(result => result.pngBlob)
      : toProcessedHeatmap('/brand/logo.svg').then(result => result.blob)
    textures.set(material, texture)
    void texture.catch(() => textures.delete(material))
  }
  return texture
}

export default function LogoShaderCanvas({ preset, background, scale, speed, playing, onStatus }: {
  preset: LogoPreset
  background: string
  scale: number
  speed: number
  playing: boolean
  onStatus: (status: 'ready' | 'unavailable') => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const shader = useRef<ShaderMount | null>(null)
  const current = useRef({ playing, speed, background, scale })
  const treatment = LOGO_PRESETS[preset]
  const material: LogoMaterial = treatment.family === 'metal' ? 'silver' : 'heat'

  useEffect(() => {
    current.current = { playing, speed, background, scale }
    shader.current?.setSpeed(playing ? speed : 0)
    shader.current?.setUniforms({ u_scale: scale, u_colorBack: getShaderColorFromString(background) })
  }, [playing, speed, background, scale])

  useEffect(() => {
    const element = host.current
    if (!element) return
    let cancelled = false
    let objectUrl: string | undefined
    const dispose = () => { shader.current?.dispose(); shader.current = null }
    const fail = () => {
      dispose()
      element.replaceChildren()
      if (!cancelled) onStatus('unavailable')
    }
    const contextLost = (event: Event) => { event.preventDefault(); fail() }
    element.addEventListener('webglcontextlost', contextLost, true)

    void (async () => {
      try {
        const blob = await textureFor(material)
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        const image = new window.Image()
        image.src = objectUrl
        await image.decode()
        if (cancelled) return
        const common: ShaderMountUniforms = {
          u_image: image, u_fit: ShaderFitOptions.contain, u_scale: current.current.scale,
          u_rotation: 0, u_originX: 0.5, u_originY: 0.5,
          u_offsetX: 0, u_offsetY: 0, u_worldWidth: 0, u_worldHeight: 0,
          u_colorBack: getShaderColorFromString(current.current.background),
        }
        const uniforms = treatment.family === 'metal' ? {
          ...common, u_isImage: true, u_shape: 0,
          u_colorTint: getShaderColorFromString(treatment.tint),
          u_repetition: treatment.repetition, u_softness: treatment.softness, u_shiftRed: treatment.shift, u_shiftBlue: -treatment.shift,
          u_distortion: treatment.distortion, u_contour: treatment.contour, u_angle: treatment.angle,
        } : {
          ...common, u_contour: treatment.contour, u_angle: treatment.angle, u_noise: 0.025,
          u_innerGlow: treatment.innerGlow, u_outerGlow: treatment.outerGlow,
          u_colors: treatment.colors.map(getShaderColorFromString),
          u_colorsCount: treatment.colors.length,
        }
        shader.current = new ShaderMount(element,
          material === 'silver' ? liquidMetalFragmentShader : heatmapFragmentShader,
          uniforms, { alpha: false, antialias: false },
          current.current.playing ? current.current.speed : 0,
          8000, 1.5, 700000, ['u_image'])
        onStatus('ready')
      } catch {
        if (!cancelled) fail()
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
      }
    })()
    return () => {
      cancelled = true
      element.removeEventListener('webglcontextlost', contextLost, true)
      dispose()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [material, treatment, onStatus])

  return <div ref={host} className={styles.canvas} aria-hidden="true" />
}
