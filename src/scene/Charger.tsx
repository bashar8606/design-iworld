interface ChargerProps {
  position: [number, number, number]
}

/** Placeholder until the charger model lands in Phase 1. */
export function Charger({ position }: ChargerProps) {
  return (
    <mesh position={[position[0], position[1] + 0.7, position[2]]} castShadow>
      <boxGeometry args={[0.6, 1.4, 0.4]} />
      <meshStandardMaterial color="#2bb3a3" />
    </mesh>
  )
}
