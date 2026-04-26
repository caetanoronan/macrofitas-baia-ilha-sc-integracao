const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(rootDir, 'Buzon', 'Lista_completa_macroalgas.txt');

const outTargets = [
  path.join(rootDir, 'repo_github_pages_macrofitas', 'data'),
  path.join(rootDir, 'integracao_2005_2012', 'publicacao_clone_layout', 'data'),
];

const EXPECTED = {
  Chlorophyta: 26,
  Phaeophyceae: 20,
  Rhodophyta: 60,
  TOTAL: 107,
};

const GROUP_MAP = {
  Chlorophyta: 'Chlorophyta',
  Phaeophyceae: 'Phaeophyceae',
  Rhodophyta: 'Rhodophyta',
};

function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function canonicalizeTaxon(raw) {
  let value = normalizeSpaces(raw)
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\.$/, '')
    .replace(/\+2$/, '')
    .trim();

  if (!value) return value;

  const replacements = [
    [/\bBlindingia\b/gi, 'Blidingia'],
    [/\bAghardhiella\b/gi, 'Agardhiella'],
    [/\bAglaothamniom\b/gi, 'Aglaothamnion'],
    [/\bfelliponei\b/gi, 'felipponei'],
    [/\bBryothamniom\b/gi, 'Bryothamnion'],
    [/\btenerrimun\b/gi, 'tenerrimum'],
    [/\bdominguensis\b/gi, 'domingensis'],
    [/\bpseudopamata\b/gi, 'pseudopalmata'],
    [/\bmembrenacea\b/gi, 'membranacea'],
    [/\bflabelata\b/gi, 'flabellata'],
    [/\bcuneifólia\b/gi, 'cuneifolia'],
    [/\bcodicola\b/gi, 'codicola'],
    [/\bEnteromorpha\b/gi, 'Ulva'],
  ];

  for (const [pattern, target] of replacements) {
    value = value.replace(pattern, target);
  }

  value = stripAccents(value);

  // Normaliza abreviações "sp."
  value = value.replace(/\bsp\.$/i, 'sp.');
  value = value.replace(/\bsp$/i, 'sp.');

  // Ajuste de capitalização básico (gênero capitalizado + epítetos minúsculos)
  const m = value.match(/^([A-Za-z-]+)\s+(.+)$/);
  if (m) {
    const genus = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    const rest = m[2]
      .split(' ')
      .map((tok) => (tok.toLowerCase() === 'sp.' ? 'sp.' : tok.toLowerCase()))
      .join(' ');
    value = `${genus} ${rest}`.trim();
  }

  return normalizeSpaces(value);
}

function parseGroupLine(line) {
  const idx = line.indexOf(',');
  if (idx < 0) return null;
  const groupRaw = line.slice(0, idx);
  const listRaw = line.slice(idx + 1).trim();

  let group = null;
  if (/^Chlorophyta\b/i.test(groupRaw)) group = GROUP_MAP.Chlorophyta;
  if (/^Phaeophyceae\b/i.test(groupRaw)) group = GROUP_MAP.Phaeophyceae;
  if (/^Rhodophyta\b/i.test(groupRaw)) group = GROUP_MAP.Rhodophyta;
  if (!group) return null;

  const content = listRaw.replace(/^"/, '').replace(/"$/, '');
  const items = content.split(',').map((v) => normalizeSpaces(v)).filter(Boolean);

  return { group, items };
}

function expandAbbrev(token, genusByInitial, lastGenus) {
  const abbrev = token.match(/^([A-Z])\.\s*(.+)$/);
  if (!abbrev) return token;
  const initial = abbrev[1];
  const epithet = abbrev[2];
  let genus = lastGenus && lastGenus.startsWith(initial)
    ? lastGenus
    : (genusByInitial.get(initial) || null);

  // Compatibilidade com sinonímia histórica: Enteromorpha -> Ulva.
  if (!genus && initial === 'E' && genusByInitial.get('U')) {
    genus = genusByInitial.get('U');
  }
  if (!genus && initial === 'E') {
    genus = 'Ulva';
  }

  if (!genus) return token;
  return `${genus} ${epithet}`;
}

function taxonKey(name) {
  return stripAccents(name).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function classifyStatus(taxonCurado) {
  if (/\bsp\.$/i.test(taxonCurado)) {
    return { status: 'revisar', motivo: 'epiteto_indeterminado' };
  }
  return { status: 'aprovado', motivo: '' };
}

function toCsv(rows, headers) {
  const escape = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

function main() {
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const lines = raw.split(/\r?\n/).map((l) => normalizeSpaces(l)).filter(Boolean);

  const rows = [];
  let rowId = 1;

  for (const line of lines) {
    const parsed = parseGroupLine(line);
    if (!parsed) continue;

    const genusByInitial = new Map();
    let lastGenus = '';

    for (const tokenRaw of parsed.items) {
      const cleaned = canonicalizeTaxon(tokenRaw);
      if (!cleaned) continue;
      if (/^\+?\d+$/.test(cleaned)) continue;

      const expanded = expandAbbrev(cleaned, genusByInitial, lastGenus);
      const canonical = canonicalizeTaxon(expanded);

      const full = canonical.match(/^([A-Za-z-]+)\s+(.+)$/);
      if (full) {
        lastGenus = full[1];
        genusByInitial.set(full[1].charAt(0), full[1]);
      }

      const { status, motivo } = classifyStatus(canonical);
      rows.push({
        id: rowId++,
        grupo_bouzon_2005: parsed.group,
        taxon_original: tokenRaw,
        taxon_curado: canonical,
        chave_taxonomica: taxonKey(canonical),
        status_curadoria: status,
        motivo_pendencia: motivo,
        incluir_publicacao: 'sim',
      });
    }
  }

  // Deduplicação por grupo + chave
  const dedupMap = new Map();
  for (const r of rows) {
    const k = `${r.grupo_bouzon_2005}__${r.chave_taxonomica}`;
    if (!dedupMap.has(k)) dedupMap.set(k, r);
  }
  const dedupRows = [...dedupMap.values()]
    .sort((a, b) => (a.grupo_bouzon_2005 + a.taxon_curado).localeCompare(b.grupo_bouzon_2005 + b.taxon_curado, 'pt-BR'));

  for (let i = 0; i < dedupRows.length; i += 1) {
    dedupRows[i].id = i + 1;
  }

  // Contagens por filo
  const countBy = { Chlorophyta: 0, Phaeophyceae: 0, Rhodophyta: 0, Nao_informado: 0 };
  for (const r of dedupRows) {
    if (countBy[r.grupo_bouzon_2005] == null) countBy[r.grupo_bouzon_2005] = 0;
    countBy[r.grupo_bouzon_2005] += 1;
  }

  const totalSemPlaceholder = dedupRows.length;

  // Fecha total textual (107) com placeholder rastreável, quando necessário
  if (totalSemPlaceholder < EXPECTED.TOTAL) {
    dedupRows.push({
      id: dedupRows.length + 1,
      grupo_bouzon_2005: 'Nao_informado',
      taxon_original: 'Taxon nao recuperado integralmente no OCR/Tabela 1',
      taxon_curado: 'Taxon indeterminado 107',
      chave_taxonomica: 'taxonindeterminado107',
      status_curadoria: 'revisar',
      motivo_pendencia: 'pendencia_ocr_fechamento_total_107',
      incluir_publicacao: 'sim',
    });
    countBy.Nao_informado += 1;
  }

  const totalFinal = dedupRows.length;

  const validacao = {
    fonte: sourcePath,
    esperado: EXPECTED,
    obtido: {
      Chlorophyta: countBy.Chlorophyta || 0,
      Phaeophyceae: countBy.Phaeophyceae || 0,
      Rhodophyta: countBy.Rhodophyta || 0,
      Nao_informado: countBy.Nao_informado || 0,
      TOTAL: totalFinal,
      TOTAL_SEM_PLACEHOLDER: totalSemPlaceholder,
    },
    diferencas: {
      Chlorophyta: (countBy.Chlorophyta || 0) - EXPECTED.Chlorophyta,
      Phaeophyceae: (countBy.Phaeophyceae || 0) - EXPECTED.Phaeophyceae,
      Rhodophyta: (countBy.Rhodophyta || 0) - EXPECTED.Rhodophyta,
      TOTAL: totalFinal - EXPECTED.TOTAL,
    },
  };

  const csvHeaders = [
    'id',
    'grupo_bouzon_2005',
    'taxon_original',
    'taxon_curado',
    'chave_taxonomica',
    'status_curadoria',
    'motivo_pendencia',
    'incluir_publicacao',
  ];
  const csv = toCsv(dedupRows, csvHeaders);

  for (const outDir of outTargets) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'bouzon_2005_curadoria_publicacao.csv'), csv, 'utf8');
    fs.writeFileSync(
      path.join(outDir, 'bouzon_2005_validacao_por_filo.json'),
      JSON.stringify(validacao, null, 2) + '\n',
      'utf8'
    );
  }

  process.stdout.write(
    [
      'Curadoria Bouzon 2005 gerada com sucesso.',
      `- Chlorophyta: ${countBy.Chlorophyta || 0}`,
      `- Phaeophyceae: ${countBy.Phaeophyceae || 0}`,
      `- Rhodophyta: ${countBy.Rhodophyta || 0}`,
      `- Nao_informado: ${countBy.Nao_informado || 0}`,
      `- Total final: ${totalFinal}`,
      `- Total sem placeholder: ${totalSemPlaceholder}`,
    ].join('\n') + '\n'
  );
}

main();
