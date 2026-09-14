export interface Vec2 {
  x: number
  y: number
}

export function vec2(x: number, y: number): Vec2 {
  return { x, y }
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100
}
