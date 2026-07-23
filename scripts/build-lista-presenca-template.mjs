// Gera o template docxtemplater da Lista de Presença a partir do
// Template_Lista_Presenca.docx original (mantém logo, layout, bordas e fonte Aptos).
//
// Transformações:
//   - Linha de valores do cabeçalho -> placeholders {assunto} {turma} {local} {data} {periodo} {horario}
//   - 15 linhas de participantes -> 1 linha-loop {#participantes} ... {/participantes}
//     com {numero} e {nome} (Chegada/Email/Assinatura/Telefone ficam em branco p/ preenchimento manual)
//
// Uso: node scripts/build-lista-presenca-template.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PizZip from 'pizzip'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const SRC = path.join(root, 'Template_Lista_Presenca.docx')
const OUT_DIR = path.join(root, 'src', 'lib', 'lista-presenca')
const OUT = path.join(OUT_DIR, 'template.docx')

/** Índice do `<w:tr` que engloba a posição `pos`, e o `</w:tr>` que o fecha. */
function enclosingTr(xml, pos) {
  const start = xml.lastIndexOf('<w:tr ', pos)
  const closeTag = '</w:tr>'
  const end = xml.indexOf(closeTag, pos) + closeTag.length
  return { start, end }
}

/** Texto concatenado dos `<w:t>` de um bloco XML. */
function textOf(block) {
  let t = ''
  const re = /<w:t[ >][^>]*?>?([^<]*)<\/w:t>|<w:t>([^<]*)<\/w:t>/g
  // regex simples: apanha conteúdo de <w:t ...>...</w:t>
  const re2 = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g
  let m
  while ((m = re2.exec(block))) t += m[1]
  return t
}

/** rPr do primeiro run de um parágrafo (para preservar formatação). */
function firstRunRPr(paragraph) {
  const rStart = paragraph.indexOf('<w:r>')
  const rStartAlt = paragraph.indexOf('<w:r ')
  const idx = [rStart, rStartAlt].filter((i) => i >= 0).sort((a, b) => a - b)[0]
  if (idx == null) return ''
  const after = paragraph.slice(idx)
  const m = after.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)
  return m ? m[0] : ''
}

/** Substitui todos os runs de um parágrafo por um único run com `text` (preserva pPr e rPr). */
function setParagraphText(paragraph, text) {
  const pPrEnd = paragraph.indexOf('</w:pPr>')
  const headEnd = pPrEnd >= 0 ? pPrEnd + '</w:pPr>'.length : paragraph.indexOf('>') + 1
  const head = paragraph.slice(0, headEnd)
  const tail = '</w:p>'
  const rPr = firstRunRPr(paragraph)
  const run = text === ''
    ? ''
    : `<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r>`
  return `${head}${run}${tail}`
}

/** Define o texto do 1º parágrafo de uma célula `<w:tc>` (preserva pPr/rPr). */
function setCellText(cell, text) {
  const pStart = cell.search(/<w:p[ >]/)
  if (pStart < 0) return cell
  const pEnd = cell.indexOf('</w:p>', pStart) + '</w:p>'.length
  const para = cell.slice(pStart, pEnd)
  return cell.slice(0, pStart) + setParagraphText(para, text) + cell.slice(pEnd)
}

/** Reescreve uma linha `<w:tr>` por índice de célula, via decide(i, texto) -> novoTexto|null (null = mantém). */
function rewriteCells(row, decide) {
  let out = ''
  let cursor = 0
  let i = 0
  let m
  const re = /<w:tc>/g
  while ((m = re.exec(row))) {
    const start = m.index
    const end = row.indexOf('</w:tc>', start) + '</w:tc>'.length
    out += row.slice(cursor, start)
    const cell = row.slice(start, end)
    const replacement = decide(i, textOf(cell).trim())
    out += replacement == null ? cell : setCellText(cell, replacement)
    cursor = end
    re.lastIndex = end
    i++
  }
  out += row.slice(cursor)
  return out
}

function main() {
  const buf = fs.readFileSync(SRC)
  const zip = new PizZip(buf)
  let xml = zip.file('word/document.xml').asText()

  // ---- 1) Cabeçalho: linha de valores (Excel / A / Transbrás / data / Diurno / horário) ----
  const excelPos = xml.indexOf('<w:t>Excel</w:t>')
  if (excelPos < 0) throw new Error('Não encontrei a célula de exemplo "Excel" no cabeçalho.')
  const valueRow = enclosingTr(xml, excelPos)
  const HEADER_FIELDS = ['{assunto}', '{turma}', '{local}', '{data}', '{periodo}', '{horario}']
  const newValueRow = rewriteCells(
    xml.slice(valueRow.start, valueRow.end),
    (i) => HEADER_FIELDS[i] ?? null,
  )
  xml = xml.slice(0, valueRow.start) + newValueRow + xml.slice(valueRow.end)

  // ---- 2) Participantes: colapsar 15 linhas numa linha-loop ----
  const firstNamePos = xml.indexOf('Antónia Clara de Lima Constantino Neto')
  if (firstNamePos < 0) throw new Error('Não encontrei a 1ª linha de participante (Antónia...).')
  const row01 = enclosingTr(xml, firstNamePos)
  const last = xml.indexOf('<w:t>15</w:t>')
  if (last < 0) throw new Error('Não encontrei a linha 15.')
  const row15 = enclosingTr(xml, last)

  // Transforma a linha 01 na linha-loop, por índice de célula:
  //   0 Nº -> {#participantes}{numero} | 1 Nome -> {nome} | 2 Chegada (mantém ":")
  //   3 Email -> vazio | 4 Assinatura (mantém vazio) | 5 Telefone -> {/participantes}
  const loopRow = rewriteCells(xml.slice(row01.start, row01.end), (i) => {
    if (i === 0) return '{#participantes}{numero}'
    if (i === 1) return '{nome}'
    if (i === 3) return '' // remove email de exemplo
    if (i === 5) return '{/participantes}'
    return null // Chegada e Assinatura ficam como estão
  })

  xml = xml.slice(0, row01.start) + loopRow + xml.slice(row15.end)

  zip.file('word/document.xml', xml)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(OUT, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }))
  console.log('Template gerado em', path.relative(root, OUT))
}

main()
