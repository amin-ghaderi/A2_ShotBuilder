import { REF2VA_LIMITS } from '@/motion/types'

export type ChunkBound = { start: number; end: number; duration: number }

/**
 * Port of Muse MiniMax Director's documented chunking rule (MIT):
 * split a requested duration into chunkDuration pieces; the last chunk absorbs
 * the remainder; a trailing remainder shorter than ~4s folds into the previous
 * chunk. Used only to plan later Master Workflow branches — V1 still exports
 * one official Ref2VA graph per selected shot.
 */
export function planChunks(durationSeconds: number, chunkDuration = REF2VA_LIMITS.defaultChunk): ChunkBound[] {
  const total = Math.max(0.5, durationSeconds)
  const size = Math.max(0.5, chunkDuration)
  const bounds: Array<[number, number]> = []
  let cursor = 0
  const count = Math.max(1, Math.ceil(total / size))
  for (let i = 0; i < count; i += 1) {
    const end = i === count - 1 ? total : Math.min(total, cursor + size)
    bounds.push([cursor, end])
    cursor = end
  }
  while (bounds.length > 1 && bounds[bounds.length - 1][1] - bounds[bounds.length - 1][0] < REF2VA_LIMITS.minReliableChunk) {
    bounds[bounds.length - 2][1] = bounds[bounds.length - 1][1]
    bounds.pop()
  }
  return bounds.map(([start, end]) => ({ start, end, duration: end - start }))
}

export function segmentsOverlappingChunks<T extends { start: number; end: number }>(
  segments: T[],
  chunks: ChunkBound[],
) {
  return chunks.map((chunk) =>
    segments.filter((segment) => segment.start < chunk.end && segment.end > chunk.start),
  )
}
