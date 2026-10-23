import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { getContent } from '../game/content.ts'
import type { PadDef, Vec2 } from '../game/types.ts'
import { openPads } from '../game/world.ts'
import { useGame } from '../store/gameStore.ts'
import { formatCash } from '../ui/format.ts'
import { PAD_ICONS } from '../ui/icons.ts'
import { CAMERA_AZIMUTH_DEG } from './constants.ts'

/** Build pads the player can pay into: an outline with an icon, the price left and a fill bar. */
export function Pads() {
  const mapId = useGame((s) => s.state.mapId)
  const content = getContent(mapId)
  const ids = useGame(useShallow((s) => openPads(s.state, content).map((p) => p.id)))
  return (
    <>
      {ids.map((id) => (
        <Pad key={id} pad={content.map.pads.find((p) => p.id === id)!} />
      ))}
    </>
  )
}

const SIZE = 256
/** Flat on the ground, turned so the label reads upright from the camera. */
const PAD_ROTATION = new THREE.Euler(-Math.PI / 2, (CAMERA_AZIMUTH_DEG * Math.PI) / 180, 0, 'YXZ')

interface PadLook {
  icon: string
  price: number
  /** Dashed outline colour. */
  accent: string
}

function drawPad(ctx: CanvasRenderingContext2D, pad: PadLook, paid: number) {
  const left = pad.price - paid
  const fill = pad.price > 0 ? paid / pad.price : 1
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  roundRect(ctx, 10, 10, SIZE - 20, SIZE - 20, 34)
  ctx.fill()
  ctx.setLineDash([18, 12])
  ctx.lineWidth = 8
  ctx.strokeStyle = pad.accent
  roundRect(ctx, 10, 10, SIZE - 20, SIZE - 20, 34)
  ctx.stroke()
  ctx.setLineDash([])
  // Fill bar along the bottom.
  ctx.fillStyle = 'rgba(30,53,87,0.15)'
  roundRect(ctx, 34, 196, SIZE - 68, 26, 13)
  ctx.fill()
  ctx.fillStyle = '#A6E22E'
  roundRect(ctx, 34, 196, Math.max(26, (SIZE - 68) * fill), 26, 13)
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '84px system-ui, "Apple Color Emoji", sans-serif'
  ctx.fillText(pad.icon, SIZE / 2, 86)
  ctx.fillStyle = '#1E3557'
  ctx.font = 'bold 44px system-ui, -apple-system, sans-serif'
  ctx.fillText(formatCash(Math.ceil(left)), SIZE / 2, 160)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function Pad({ pad }: { pad: PadDef }) {
  const paid = useGame((s) => Math.floor(s.state.pads[pad.id]?.paid ?? 0))
  return (
    <PadMarker
      pos={pad.pos}
      y={pad.y}
      icon={PAD_ICONS[pad.kind]}
      price={pad.price}
      paid={paid}
      accent={pad.kind === 'land' ? '#F29E4C' : '#19B5A5'}
      size={pad.kind === 'land' ? 2.4 : 2.1}
    />
  )
}

/** A pad on the ground: icon, the price left and a fill bar (also used by the quarry). */
export function PadMarker({
  pos,
  y = 0,
  icon,
  price,
  paid,
  accent,
  size = 2.1,
}: PadLook & { pos: Vec2; y?: number; paid: number; size?: number }) {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return { canvas, texture }
  }, [])
  useEffect(() => {
    drawPad(canvas.getContext('2d')!, { icon, price, accent }, paid)
    texture.needsUpdate = true
  }, [canvas, texture, icon, price, accent, paid])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={[pos.x, y + 0.03, pos.z]} rotation={PAD_ROTATION} renderOrder={2}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
