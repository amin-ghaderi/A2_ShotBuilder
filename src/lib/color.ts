export function kelvinToHex(kelvin: number) {
  const temperature = clampChannel(kelvin, 1000, 40000) / 100
  let red: number
  let green: number
  let blue: number

  if (temperature <= 66) {
    red = 255
    green = 99.4708025861 * Math.log(temperature) - 161.1195681661
  } else {
    red = 329.698727446 * (temperature - 60) ** -0.1332047592
    green = 288.1221695283 * (temperature - 60) ** -0.0755148492
  }

  if (temperature >= 66) blue = 255
  else if (temperature <= 19) blue = 0
  else blue = 138.5177312231 * Math.log(temperature - 10) - 305.0447927307

  return rgbToHex(clampChannel(red, 0, 255), clampChannel(green, 0, 255), clampChannel(blue, 0, 255))
}

export function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim()
  const value = normalized.length === 3
    ? normalized.split('').map((channel) => channel + channel).join('')
    : normalized.padEnd(6, '0').slice(0, 6)
  const parsed = Number.parseInt(value, 16)
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  }
}

export function estimateKelvin(hex: string) {
  const { r, b } = hexToRgb(hex)
  const warmth = r - b
  return Math.round(clampChannel(5600 - warmth * 28, 2500, 9000))
}

export function temperatureClass(kelvin: number) {
  if (kelvin < 3500) return 'warm'
  if (kelvin < 4700) return 'slightly warm'
  if (kelvin < 6000) return 'neutral'
  if (kelvin < 7500) return 'slightly cool'
  return 'cool'
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

function toHex(channel: number) {
  return Math.round(channel).toString(16).padStart(2, '0')
}

function clampChannel(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
