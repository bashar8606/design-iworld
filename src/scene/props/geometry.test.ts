import { describe, expect, it } from 'vitest'
import assets from '../../content/assets.json'
import {
  PANEL_MODULE,
  batteryGeometry,
  canopySegmentGeometry,
  carWashGeometry,
  chargerPostGeometry,
  duneGeometry,
  panelFrameGeometry,
  panelModuleGeometry,
  robotGeometry,
  triangleCount,
} from './geometry.ts'
import { cableGeometry } from './cableGeometry.ts'

const limits = assets.props as Record<string, { triangleLimit: number }>

describe('code-built props stay inside their triangle limits', () => {
  const cases: [string, number][] = [
    [
      'panelRow',
      (triangleCount(panelModuleGeometry()) + triangleCount(panelFrameGeometry())) *
        PANEL_MODULE.perRow,
    ],
    ['battery', Math.max(triangleCount(batteryGeometry(0)), triangleCount(batteryGeometry(1)))],
    ['charger7', triangleCount(chargerPostGeometry(0))],
    ['charger22', triangleCount(chargerPostGeometry(1))],
    ['canopy', triangleCount(canopySegmentGeometry())],
    ['carWash', triangleCount(carWashGeometry())],
    ['dune', triangleCount(duneGeometry())],
    ['robot', triangleCount(robotGeometry())],
    ['cable', triangleCount(cableGeometry({ x: 0, y: 1, z: 0 }, { x: 2, y: 0.8, z: 0 }))],
  ]
  it.each(cases)('%s (%i triangles)', (name, tris) => {
    const limit = limits[name]?.triangleLimit
    expect(limit, `${name} needs an entry in src/content/assets.json`).toBeDefined()
    expect(tris).toBeLessThanOrEqual(limit!)
  })
})
