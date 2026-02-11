/**
 * Spline Runtime type declarations.
 *
 * @splinetool/react-spline component types for embedding
 * Spline 3D scenes in React applications.
 *
 * @see https://www.npmjs.com/package/@splinetool/react-spline
 */

declare module '@splinetool/react-spline' {
  import { ComponentProps, RefObject } from 'react'

  export interface SplineEvent {
    target: {
      name: string
      id?: string
    }
  }

  export interface SplineProps extends ComponentProps<'div'> {
    /** Spline scene URL (e.g., https://prod.spline.design/xxxxx/scene.splinecode) */
    scene: string
    /** Callback fired when the Spline scene has loaded */
    onLoad?: (spline: SplineRef) => void
    /** Callback fired when a Spline event is triggered */
    onSplineEvent?: (event: SplineEvent) => void
    /** Ref to access the Spline API */
    ref?: RefObject<SplineRef | null>
  }

  export interface SplineRef {
    /** Find an object in the scene by name or ID */
    findObjectByName: (name: string) => SplineObject | null
    findObjectById: (id: string) => SplineObject | null
    /** Emit an event to the Spline scene */
    emitEvent: (eventName: string, target?: string) => void
    /** Set a variable in the Spline scene */
    setVariable: (name: string, value: unknown) => void
    /** Get a variable from the Spline scene */
    getVariable: (name: string) => unknown
    /** Start/stop the animation */
    play: () => void
    stop: () => void
    pause: () => void
  }

  export interface SplineObject {
    /** Object name in the Spline scene */
    name: string
    /** Object ID in the Spline scene */
    id: string
    /** Set object visibility */
    visible: boolean
    /** Set object position */
    position: { x: number; y: number; z: number }
    /** Set object rotation */
    rotation: { x: number; y: number; z: number }
    /** Set object scale */
    scale: { x: number; y: number; z: number }
  }

  /** Spline React component */
  export default function Spline(props: SplineProps): JSX.Element
}
