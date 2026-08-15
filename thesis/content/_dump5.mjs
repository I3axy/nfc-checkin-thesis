import fs from 'node:fs'
import JSZip from 'jszip'
const zip = await JSZip.loadAsync(fs.readFileSync('C:/dolgok/nfc-checkin-thesis/sablon/zavrsni rad_sablon_HU_09_02_2023.docx'))
const s = await zip.file('word/settings.xml').async('string')
console.log('hossz:', s.length)
console.log('elemek:', [...s.matchAll(/<w:([a-zA-Z]+)[ \/>]/g)].map(m=>m[1]).filter((v,i,a)=>a.indexOf(v)===i).join(', '))
console.log('\ncompat pozíció:', s.indexOf('<w:compat'), ' rsids:', s.indexOf('<w:rsids'))
console.log(s.slice(0, 600))
