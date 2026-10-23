import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { CameraRig } from './CameraRig.tsx'
import { Cars } from './Cars.tsx'
import { DayNight } from './DayNight.tsx'
import { Effects } from './Effects.tsx'
import { Batteries, Chargers, Facilities, SolarPanels } from './Equipment.tsx'
import { Ground } from './Ground.tsx'
import { Lighting } from './Lighting.tsx'
import { Pads } from './Pads.tsx'
import { Pickups } from './Pickups.tsx'
import { Player, Staff } from './People.tsx'

export interface WorldProps {
  /** Real-time shadows; the device build uses a baked contact shadow instead. */
  shadows?: boolean
  maxDpr?: number
  children?: React.ReactNode
}

export function World({ shadows = true, maxDpr = 2, children }: WorldProps) {
  return (
    <Canvas
      shadows={shadows ? 'percentage' : false}
      dpr={[1, maxDpr]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <CameraRig />
      <DayNight shadows={shadows} />
      <Suspense fallback={null}>
        <Lighting />
        <Ground />
        <SolarPanels />
        <Batteries />
        <Chargers />
        <Facilities />
        <Pads />
        <Pickups />
        <Cars />
        <Player />
        <Staff />
        <Effects />
        {children}
      </Suspense>
    </Canvas>
  )
}
