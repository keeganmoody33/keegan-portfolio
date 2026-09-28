import Crate from '@/components/house/Crate'
import HouseFooter from '@/components/house/HouseFooter'
import HouseShell from '@/components/house/HouseShell'
import TitleCard from '@/components/house/TitleCard'
import { parseLogoMarkVariant } from '@/components/house/LogoMark'
import { houseOrganizationJsonLd, JsonLd } from '@/lib/jsonld'

/**
 * Optional `?mark=` is a review capture hook (line | p1 | p2 | p3 | pastel).
 * Default is `line`. Not a public picker.
 */
export default async function HouseHome({
  searchParams,
}: {
  searchParams: Promise<{ mark?: string | string[] }>
}) {
  const params = await searchParams
  const raw = Array.isArray(params.mark) ? params.mark[0] : params.mark
  const markVariant = parseLogoMarkVariant(raw)

  return (
    <HouseShell>
      <JsonLd data={houseOrganizationJsonLd()} />
      <TitleCard markVariant={markVariant} />
      <div className="mx-6 my-8 border-t border-[var(--house-line)] sm:mx-10" />
      <Crate />
      <HouseFooter />
    </HouseShell>
  )
}
