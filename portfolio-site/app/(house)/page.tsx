import Crate from '@/components/house/Crate'
import HouseFooter from '@/components/house/HouseFooter'
import HouseShell from '@/components/house/HouseShell'
import TitleCard from '@/components/house/TitleCard'
import { houseOrganizationJsonLd, JsonLd } from '@/lib/jsonld'

export default function HouseHome() {
  return (
    <HouseShell>
      <JsonLd data={houseOrganizationJsonLd()} />
      <TitleCard />
      <div className="mx-6 my-8 border-t border-[var(--house-line)] sm:mx-10" />
      <Crate />
      <HouseFooter />
    </HouseShell>
  )
}
