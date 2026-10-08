function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i]
    for (let bit = 0; bit < 8; bit += 1) {
      const lowest = crc & 1
      crc >>>= 1
      if (lowest) crc ^= 0xedb88320
    }
  }
  return crc ^ 0xffffffff
}

function u16(value: number) {
  const bytes = new Uint8Array(2)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, value, true)
  return bytes
}

function u32(value: number) {
  const bytes = new Uint8Array(4)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, value, true)
  return bytes
}

function concat(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  chunks.forEach((chunk) => {
    out.set(chunk, offset)
    offset += chunk.length
  })
  return out
}

export type ZipEntry = { path: string; data: Uint8Array }

/** Uncompressed ZIP (STORE). Valid for ComfyUI-side unpacking and Vercel browser download. */
export function buildZip(entries: ZipEntry[]) {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  entries.forEach((entry) => {
    const name = encoder.encode(entry.path.replace(/\\/g, '/'))
    const crc = crc32(entry.data)
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      name,
      entry.data,
    ])
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  })
  const center = concat(centrals)
  const end = concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(center.length), u32(offset), u16(0)])
  return new Blob([concat([...locals, center, end])], { type: 'application/zip' })
}

export function textBytes(value: string) {
  return new TextEncoder().encode(value)
}

export function dataUrlToBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(',')
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}
