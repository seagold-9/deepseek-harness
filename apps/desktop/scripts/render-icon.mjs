/** Render the monochrome DSH mark into a Windows-friendly PNG. */

import { mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(desktopRoot, '..', 'web', 'public', 'favicon.svg')
const output = join(desktopRoot, 'build', 'icon.png')
const tile = Buffer.from('<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect x="32" y="32" width="448" height="448" rx="92" fill="#111"/></svg>')
const logo = await sharp(source, { density: 384 }).resize(310, 310).negate({ alpha: false }).png().toBuffer()

await mkdir(dirname(output), { recursive: true })
await sharp(tile).composite([{ input: logo, left: 101, top: 101 }]).png().toFile(output)
