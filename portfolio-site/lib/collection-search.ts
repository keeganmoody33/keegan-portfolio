type SearchableRecord = {
  artist: string
  title: string
  year: number
  label: string
  catno: string
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function filterCollection<T extends SearchableRecord>(records: T[], query: string): T[] {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return records
  return records.filter((record) => {
    const text = normalize([record.artist, record.title, record.year > 0 ? record.year : '', record.label, record.catno].join(' '))
    return terms.every((term) => text.includes(term))
  })
}
