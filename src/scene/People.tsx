import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { getContent } from '../game/content.ts'
import type { StaffKind } from '../game/types.ts'
import { bayDef } from '../game/world.ts'
import { tickAlpha, useGame } from '../store/gameStore.ts'
import { FACE_CAMERA } from './billboard.ts'
import { damp, lerp, lerpAngle } from './interp.ts'
import { glowTeal, propMaterial } from './materials.ts'
import { Worker } from './models/generated/index.ts'
import { robotGeometry } from './props/geometry.ts'

/** Multiplies every material under a group by a colour (vertex colours keep their shading). */
function useTint(ref: React.RefObject<THREE.Group | null>, tint: string | undefined) {
  useLayoutEffect(() => {
    if (!tint || !ref.current) return
    ref.current.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        const m = (mesh.material as THREE.MeshStandardMaterial).clone()
        m.color.set(tint)
        mesh.material = m
      }
    })
  })
}

export function Player() {
  const group = useRef<THREE.Group>(null)
  const moving = useGame((s) => s.state.player.moving)
  const heading = useRef(0)
  useFrame((_, dt) => {
    const { state, prev } = useGame.getState()
    const t = tickAlpha()
    const g = group.current
    if (!g) return
    g.position.set(
      lerp(prev.player.pos.x, state.player.pos.x, t),
      0,
      lerp(prev.player.pos.z, state.player.pos.z, t),
    )
    heading.current = lerpAngle(heading.current, state.player.heading, 1 - Math.exp(-14 * dt))
    g.rotation.y = heading.current + Math.PI
  })
  return (
    <>
      <group ref={group}>
        <Worker animation={moving ? 'Walk' : 'Idle'} castShadow />
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} material={glowTeal}>
          <ringGeometry args={[0.45, 0.55, 24]} />
        </mesh>
      </group>
      <PlugProgress />
    </>
  )
}

/** A filling ring over the charger the player is plugging in. */
function PlugProgress() {
  const ref = useRef<THREE.Mesh>(null)
  const mapId = useGame((s) => s.state.mapId)
  const map = getContent(mapId).map
  useFrame(() => {
    const { plug } = useGame.getState().state.player
    const mesh = ref.current
    if (!mesh) return
    mesh.visible = !!plug
    if (!plug) return
    const post = bayDef(map, plug.bayId).post
    mesh.position.set(post.x, 2.2, post.z)
    const f = Math.min(1, plug.progress / map.player.plugSeconds)
    mesh.scale.setScalar(0.3 + 0.7 * f)
  })
  return (
    <mesh ref={ref} quaternion={FACE_CAMERA} renderOrder={10}>
      <circleGeometry args={[0.35, 20]} />
      <meshBasicMaterial color="#A6E22E" toneMapped={false} depthTest={false} transparent />
    </mesh>
  )
}

const STAFF_TINT: Record<StaffKind, string | undefined> = {
  technician: undefined,
  cashier: '#FFD3A0',
  robot: undefined,
}

export function Staff() {
  const staff = useGame(useShallow((s) => s.state.staff.map((m) => `${m.id}:${m.kind}`)))
  return (
    <>
      {staff.map((k) => {
        const [id, kind] = k.split(':') as [string, StaffKind]
        return <StaffMember key={id} id={id} kind={kind} />
      })}
    </>
  )
}

function StaffMember({ id, kind }: { id: string; kind: StaffKind }) {
  const group = useRef<THREE.Group>(null)
  const [moving, setMoving] = useState(false)
  const heading = useRef(0)
  const robot = useMemo(() => (kind === 'robot' ? robotGeometry() : null), [kind])
  useTint(group, STAFF_TINT[kind])
  useFrame((_, dt) => {
    const { state, prev } = useGame.getState()
    const now = state.staff.find((m) => m.id === id)
    const before = prev.staff.find((m) => m.id === id) ?? now
    const g = group.current
    if (!now || !before || !g) return
    const t = tickAlpha()
    const x = lerp(before.pos.x, now.pos.x, t)
    const z = lerp(before.pos.z, now.pos.z, t)
    const dx = now.pos.x - before.pos.x
    const dz = now.pos.z - before.pos.z
    const isMoving = Math.hypot(dx, dz) > 1e-4
    if (isMoving)
      heading.current = lerpAngle(heading.current, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt))
    g.position.set(x, 0, z)
    g.rotation.y = heading.current + Math.PI
    if (robot)
      g.position.y = damp(
        g.position.y,
        isMoving ? 0.03 * Math.sin(performance.now() / 60) : 0,
        20,
        dt,
      )
    if (isMoving !== moving) setMoving(isMoving)
  })
  return (
    <group ref={group}>
      {robot ? (
        <mesh geometry={robot} material={propMaterial} castShadow rotation-y={Math.PI} />
      ) : (
        <Worker animation={moving ? 'Walk' : 'Idle'} />
      )}
    </group>
  )
}
