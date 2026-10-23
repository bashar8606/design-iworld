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
import { PerfProbe } from './PerfProbe.tsx'
import { Player, Staff } from './People.tsx'
import { BakedContactShadow, BlobShadows } from './Shadows.tsx'
import { quality } from './quality.ts'

export interface WorldProps {
  /** Real-time shadows; the device build uses a baked contact shadow instead. */
  shadows?: boolean
  maxDpr?: number
  /** Frame the whole layout instead of following the player (stress test). */
  overview?: boolean
  children?: React.ReactNode
}

export function World({
  shadows = quality.shadows,
  maxDpr = quality.maxDpr,
  overview = false,
  children,
}: WorldProps) {
  return (
    <Canvas
      shadows={shadows ? 'percentage' : false}
      dpr={[1, maxDpr]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <CameraRig follow={!overview} viewSize={overview ? 95 : undefined} />
      <PerfProbe />
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
        {!shadows && <BakedContactShadow />}
        {!shadows && <BlobShadows />}
        {children}
      </Suspense>
    </Canvas>
  )
}
