// Minimal dimension reader for the formats in public/brand (no dependencies).
export function imageSize(buf, ext) {
  if (ext === '.png') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  if (ext === '.svg') {
    const m = buf.toString('utf8').match(/viewBox="[\d.\s-]*?\s([\d.]+)\s([\d.]+)"/)
    return m ? { width: Number(m[1]), height: Number(m[2]) } : null
  }
  if (ext === '.ico') {
    // largest entry in the directory
    const count = buf.readUInt16LE(4)
    let best = 0
    for (let i = 0; i < count; i++) best = Math.max(best, buf[6 + i * 16] || 256)
    return { width: best, height: best }
  }
  return null
}
