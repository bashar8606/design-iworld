import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { getContent } from '../game/content.ts'
import type { Charger } from '../game/types.ts'
import { bayDef, itemPos } from '../game/world.ts'
import { useGame } from '../store/gameStore.ts'
import { cableMaterial, glowLime, glowTeal, propMaterial } from './materials.ts'
import { popScale } from './buildPop.ts'
import { useModelGeometry } from './models/useModelGeometry.ts'
import { cableGeometry } from './props/cableGeometry.ts'
import {
  PANEL_MODULE,
  batteryGeometry,
  batteryStrip,
  canopySegmentGeometry,
  carWashGeometry,
  chargerPostGeometry,
  panelCellTexture,
  panelFrameGeometry,
  panelModuleGeometry,
  panelRowMatrices,
  panelFrameMatrices,
} from './props/geometry.ts'

const useMap = () => getContent(useGame((s) => s.state.mapId)).map
const padPos = (map: ReturnType<typeof useMap>, id: string) => map.pads.find((p) => p.id === id)!

/** Squash-and-stretch for an item that was just built or upgraded. */
function applyPop(group: THREE.Group | null, id: string) {
  if (!group) return
  const k = popScale(id)
  group.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k))
}

// ---------------------------------------------------------------------------
// Solar panels: every module of every row in one instanced mesh.

const TIER_TINT = ['#FFFFFF', '#8E9BB5', '#C9F0FF']
const DUST = new THREE.Color('#D9C08E')
const MAX_PANEL_MODULES = 600

export function SolarPanels() {
  const map = useMap()
  const key = useGame(useShallow((s) => s.state.panels.map((p) => `${p.id}:${p.tier}`)))
  const modules = useRef<THREE.InstancedMesh>(null)
  const frames = useRef<THREE.InstancedMesh>(null)
  const posts = useRef<THREE.InstancedMesh>(null)
  const postGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.09, 0.11, 1, 8).translate(0, 0.5, 0),
    [],
  )
  const moduleGeometry = useMemo(() => panelModuleGeometry(), [])
  const frameGeometry = useMemo(() => panelFrameGeometry(), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ map: panelCellTexture(), roughness: 0.28, metalness: 0.35 }),
    [],
  )
  const rows = useMemo(
    () =>
      key.map((k) => {
        const [id, tier] = k.split(':')
        const pad = padPos(map, id!)
        const at = itemPos(pad)
        return { id: id!, tier: Number(tier), x: at.x, z: at.z, y: pad.buildY ?? 0 }
      }),
    [key, map],
  )

  useLayoutEffect(() => {
    let i = 0
    let f = 0
    for (const row of rows) {
      for (const m of panelRowMatrices(row.x, row.z, row.y)) modules.current!.setMatrixAt(i++, m)
      for (const m of panelFrameMatrices(row.x, row.z, row.y)) frames.current!.setMatrixAt(f++, m)
    }
    // Raised rows (carports, roof decks) stand on posts down to the ground.
    let p = 0
    const m = new THREE.Matrix4()
    for (const row of rows) {
      if (row.y <= 0) continue
      for (const [dx, dz] of [
        [-3.7, -0.6],
        [3.7, -0.6],
        [-3.7, 0.6],
        [3.7, 0.6],
      ] as const) {
        m.makeScale(1, row.y + 0.75, 1).setPosition(row.x + dx, 0, row.z + dz)
        posts.current!.setMatrixAt(p++, m)
      }
    }
    posts.current!.count = p
    posts.current!.instanceMatrix.needsUpdate = true
    posts.current!.computeBoundingSphere()
    modules.current!.count = i
    frames.current!.count = f
    modules.current!.instanceMatrix.needsUpdate = true
    frames.current!.instanceMatrix.needsUpdate = true
    modules.current!.computeBoundingSphere()
    frames.current!.computeBoundingSphere()
  }, [rows])

  // Dust tint, tier tint and sun-tracking tilt.
  const color = useMemo(() => new THREE.Color(), [])
  const last = useRef(0)
  useFrame((_, dt) => {
    last.current += dt
    if (last.current < 0.2) return
    last.current = 0
    const { state } = useGame.getState()
    let i = 0
    const mesh = modules.current!
    for (const row of rows) {
      const panel = state.panels.find((p) => p.id === row.id)
      color.set(TIER_TINT[row.tier] ?? '#FFFFFF').lerp(DUST, (panel?.dust ?? 0) * 0.7)
      const tracking = row.tier >= 2
      const tilt = tracking ? 0.15 + 0.5 * (1 - state.sun) : undefined
      const mats = tracking ? panelRowMatrices(row.x, row.z, row.y, tilt) : null
      for (let k = 0; k < PANEL_MODULE.perRow; k++) {
        mesh.setColorAt(i, color)
        if (mats) mesh.setMatrixAt(i, mats[k]!)
        i++
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh
        ref={modules}
        args={[moduleGeometry, material, MAX_PANEL_MODULES]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={frames}
        args={[frameGeometry, propMaterial, MAX_PANEL_MODULES]}
        castShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={posts}
        args={[postGeometry, undefined, 160]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color="#9AA3AB" />
      </instancedMesh>
    </>
  )
}

// ---------------------------------------------------------------------------
// Batteries with a light strip that shows the stored charge.

export function Batteries() {
  const map = useMap()
  const batteries = useGame(useShallow((s) => s.state.batteries.map((b) => `${b.id}:${b.tier}`)))
  return (
    <>
      {batteries.map((k) => {
        const [id, tier] = k.split(':')
        const pad = padPos(map, id!)
        return (
          <BatteryUnit
            key={id}
            id={id!}
            tier={Number(tier)}
            x={pad.pos.x}
            z={pad.pos.z}
            y={pad.y ?? 0}
          />
        )
      })}
    </>
  )
}

function BatteryUnit({
  id,
  tier,
  x,
  z,
  y,
}: {
  id: string
  tier: number
  x: number
  z: number
  y: number
}) {
  const geometry = useMemo(() => batteryGeometry(tier), [tier])
  const strip = batteryStrip(tier)
  const ref = useRef<THREE.Mesh>(null)
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    applyPop(group.current, id)
    const { energy } = useGame.getState().state
    const fill = energy.capacity > 0 ? energy.stored / energy.capacity : 0
    if (ref.current) {
      ref.current.scale.x = Math.max(0.02, fill)
      ref.current.position.x = strip.pos[0] - (strip.length * (1 - fill)) / 2
    }
  })
  // Rotated so the long side faces the camera.
  return (
    <group ref={group} position={[x, y, z]} rotation-y={tier === 0 ? 0 : Math.PI / 2}>
      <mesh geometry={geometry} material={propMaterial} castShadow receiveShadow />
      <mesh
        ref={ref}
        position={[strip.pos[0], strip.pos[1], strip.pos[2] + 0.02]}
        material={glowLime}
      >
        <boxGeometry args={[strip.length, 0.12, 0.04]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Chargers, the canopy above them and the cables to charging cars.

export function Chargers() {
  const map = useMap()
  const chargers = useGame(
    useShallow((s) =>
      s.state.chargers.map((c) => `${c.id}:${c.bayId}:${c.tier}:${c.upgradingUntil > 0 ? 1 : 0}`),
    ),
  )
  const canopy = useRef<THREE.InstancedMesh>(null)
  const canopyGeometry = useMemo(() => canopySegmentGeometry(), [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    chargers.forEach((k, i) => {
      const bay = bayDef(map, k.split(':')[1]!)
      m.makeTranslation(bay.post.x - 0.2, 0, bay.post.z)
      canopy.current!.setMatrixAt(i, m)
    })
    canopy.current!.count = chargers.length
    canopy.current!.instanceMatrix.needsUpdate = true
    canopy.current!.computeBoundingSphere()
  }, [chargers, map])
  return (
    <>
      {chargers.map((k) => {
        const [id, bayId, tier, upgrading] = k.split(':')
        return (
          <ChargerUnit
            key={id}
            id={id!}
            bayId={bayId!}
            tier={Number(tier)}
            upgrading={upgrading === '1'}
          />
        )
      })}
      <instancedMesh
        ref={canopy}
        args={[canopyGeometry, propMaterial, 12]}
        castShadow
        frustumCulled={false}
      />
    </>
  )
}

function ChargerUnit({
  id,
  bayId,
  tier,
  upgrading,
}: {
  id: string
  bayId: string
  tier: number
  upgrading: boolean
}) {
  const map = useMap()
  const bay = bayDef(map, bayId)
  const post = useMemo(() => (tier < 2 ? chargerPostGeometry(tier) : null), [tier])
  return (
    <group>
      <group position={[bay.post.x, 0, bay.post.z]}>
        {post ? (
          <mesh geometry={post} material={propMaterial} castShadow />
        ) : (
          <FastChargerModel tier={tier} />
        )}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} material={glowTeal}>
          <ringGeometry args={[0.55, 0.68, 20]} />
        </mesh>
        {upgrading && <UpgradeMarker />}
      </group>
      <ChargingCable chargerId={id} bayId={bayId} />
    </group>
  )
}

function FastChargerModel({ tier }: { tier: number }) {
  const { geometry, material } = useModelGeometry('fast_charger')
  const tinted = useMemo(() => {
    if (tier < 3) return material
    const m = (material as THREE.MeshStandardMaterial).clone()
    m.color.set('#C9F0FF')
    return m
  }, [material, tier])
  return <mesh geometry={geometry} material={tinted} castShadow scale={tier >= 3 ? 1.15 : 1} />
}

function UpgradeMarker() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 2
  })
  return (
    <mesh ref={ref} position={[0, 2.6, 0]}>
      <torusGeometry args={[0.35, 0.08, 6, 12]} />
      <meshStandardMaterial color="#F29E4C" emissive="#F29E4C" emissiveIntensity={0.6} />
    </mesh>
  )
}

function ChargingCable({ chargerId, bayId }: { chargerId: string; bayId: string }) {
  const map = useMap()
  const charging = useGame((s) => {
    const c = s.state.chargers.find((x: Charger) => x.id === chargerId)
    const car = s.state.cars.find((x) => x.id === c?.carId)
    return car?.phase === 'charging'
  })
  const geometry = useMemo(() => {
    const bay = bayDef(map, bayId)
    return cableGeometry(
      { x: bay.post.x - 0.25, y: 1.0, z: bay.post.z },
      { x: bay.car.x + 1.1, y: 0.85, z: bay.car.z - 0.85 },
      0.55,
    )
  }, [map, bayId])
  return charging ? <mesh geometry={geometry} material={cableMaterial} castShadow /> : null
}

// ---------------------------------------------------------------------------
// Café and car wash

export function Facilities() {
  const map = useMap()
  const { cafe, carWash } = useGame(useShallow((s) => s.state.facilities))
  const cafePad = map.pads.find((p) => p.kind === 'cafe')
  const washPad = map.pads.find((p) => p.kind === 'carWash')
  const washGeometry = useMemo(() => carWashGeometry(), [])
  return (
    <>
      {cafe && cafePad && <CafeModel x={cafePad.pos.x} z={cafePad.pos.z} />}
      {carWash && washPad && (
        <mesh
          geometry={washGeometry}
          material={propMaterial}
          position={[washPad.pos.x, 0, washPad.pos.z]}
          castShadow
          receiveShadow
        />
      )}
    </>
  )
}

function CafeModel({ x, z }: { x: number; z: number }) {
  const { geometry, material } = useModelGeometry('cafe')
  // The serving window faces -X in the model; turn it toward the camera.
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[x, 0, z]}
      rotation-y={Math.PI / 2}
      castShadow
      receiveShadow
    />
  )
}
