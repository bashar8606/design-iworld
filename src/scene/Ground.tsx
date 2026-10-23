const LOT_SIZE = 30
const ROAD_WIDTH = 3
const ROAD_X = -6

export function Ground() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[LOT_SIZE, LOT_SIZE]} />
        <meshStandardMaterial color="#e9d3a1" />
      </mesh>

      {/* Straight road along one side of the lot. */}
      <mesh rotation-x={-Math.PI / 2} position={[ROAD_X, 0.01, 0]} receiveShadow>
        <planeGeometry args={[ROAD_WIDTH, LOT_SIZE]} />
        <meshStandardMaterial color="#4a4e57" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[ROAD_X, 0.02, 0]}>
        <planeGeometry args={[0.12, LOT_SIZE]} />
        <meshStandardMaterial color="#f4f1e8" />
      </mesh>
    </group>
  )
}
