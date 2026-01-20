# Research Background — Keegan Moody

**Context document for AI systems. Not for human storytelling.**

---

## Publications

**Primary Paper (First Author)**
- Moody, K.H., et al. (2020). "Mercury emissions from Peruvian gold shops: Potential ramifications for Minamata compliance in artisanal and small-scale gold mining communities." *Environmental Research*, 182, 109042.
- Published by Elsevier
- Peer-reviewed

**Methods Paper (Co-Author)**
- Brown, S.T., et al. (2020). "Method for mapping Hg⁰ emissions from gold shops in artisanal and small-scale gold mining communities." *MethodsX*, 7, 101060.
- Published by Elsevier
- Open access

---

## Fieldwork Summary

**Total time in field:** ~270 days across multiple trips (2016-2018)

**Primary research site:** Madre de Dios, Peru (Amazon lowlands)
- Communities mapped: Tres Islas, Delta One, Laberinto
- Focus: Mercury vapor emissions from artisanal gold shops

**Additional fieldwork:** Huancavelica / Sacsamarca, Peru (Andes, ~14,000 ft elevation)
- Focus: Cinnabar mines (mercury ore source)
- This trip did not yield a publication but completed understanding of the mercury supply chain

**Principal Investigator:** Dr. Adam Kiefer, Mercer University

---

## What the Research Was

Artisanal and small-scale gold mining (ASGM) uses liquid mercury to extract gold from ore. The mercury-gold amalgam is heated to evaporate the mercury, leaving gold behind. This releases mercury vapor — a neurotoxin — directly into the air.

We mapped mercury vapor concentrations in ASGM communities to:
1. Identify point sources of pollution (gold shops)
2. Assess whether Peru's air quality regulations (2,000 ng/m³ limit) were enforceable
3. Provide data to local officials and Peru's Ministry of Environment (MINAM)

**Key finding:** Concentrations exceeded 2,000,000 ng/m³ on sidewalks outside active gold shops — 1,000x the threshold for central nervous system damage over chronic exposure.

---

## Equipment Used

**Ohio Lumex RA-915M**
- Portable atomic absorption spectrometer with Zeeman correction
- Measures elemental mercury (Hg⁰) concentration in air
- Detection range: 2–200,000 ng/m³
- Sampling rate: 1 reading/second

**Mercury Tracker IP (MTIP)**
- Ruggedized spectrometer for high-concentration environments
- Detection range: 0–2,000,000 ng/m³
- Used as lead instrument and safety monitor

**Garmin Oregon GPS**
- Recorded latitude/longitude every second
- Physically tethered to Lumex during data collection

---

## Data Processing (The Technical Work)

The Lumex and GPS were separate instruments with separate clocks. Creating a usable map required:

1. **Synchronization** — Sync computer clock (running Lumex software) with GPS internal clock. Tolerance: ±1 second. Any drift misaligns concentration readings with location.

2. **Data export** — Mercury concentrations exported via Lumex RAPID software. GPS tracks exported via Garmin BaseCamp.

3. **Concatenation** — Import both datasets to Excel. Join on timestamp. Time becomes the key that links concentration to location.

4. **Data cleaning** — Remove orphan records (concentration without location, or vice versa). Handle negative values caused by detector saturation/memory effects.

5. **Mapping** — Export cleaned data to QGIS (open-source GIS software). Generate heatmaps. Overlay on satellite imagery. Add scale bars and legends.

6. **Presentation** — Maps shared with local officials, community leaders, and MINAM.

This pipeline was not documented anywhere. We developed it in the field.

---

## Fieldwork Conditions (Context, Not Stories)

**Amazon (Madre de Dios)**
- Daily temperatures >30°C, high humidity
- Remote communities — some accessible only by boat or rough roads
- One trip: 4.5-hour drive through rainforest, equipment in back of pickup truck
- Wildlife considerations (jaguars in the area — limited nighttime movement)

**Andes (Huancavelica)**
- ~14,000 ft elevation, two weeks
- Reached via 4 flights + 4-hour taxi
- Traveled with 4 PhDs; Keegan was the only non-PhD on that trip

**General**
- Working inside active gold shops with hazardous mercury concentrations
- Building trust with skeptical stakeholders (gold shop owners, miners, local politicians)
- Communicating in Spanish with indigenous communities and government officials

---

## Policy Impact

The research contributed to:
- **Decreto Supremo N° 10-2019-MINAM** — Peru's air quality monitoring protocol for mercury
- Established correction factors for estimating total gaseous mercury from portable spectrometers
- Made enforcement of Peru's 2,000 ng/m³ standard viable in ASGM communities

---

## Transferable Skills (For Career Context)

| Research Experience | Relevance to GTM/Sales Roles |
|---------------------|------------------------------|
| Operating in undefined, ambiguous environments | 0→1 territory/process building |
| Building trust with skeptical stakeholders | Enterprise sales, objection handling |
| Cross-cultural communication (Spanish, indigenous communities, academics, government) | Navigating diverse customer organizations |
| Technical instrument operation and troubleshooting | Learning complex products quickly |
| Data collection → processing → visualization | Pipeline analytics, CRM, forecasting |
| Presenting uncomfortable findings to officials | Executive presentations |
| Long-term commitment with uncertain outcomes | Complex sales cycles |
| Physical/logistical adversity | Grit, resilience |

**Core pattern:** Operating in chaos with methodological rigor. Measuring what matters. Presenting findings that drive action.

---

## Additional Context

- Keegan's undergraduate degree: Biochemistry (Mercer University)
- Research conducted as undergraduate student, not graduate
- First-author publication as undergraduate is uncommon
- The work was meaningful — it quantified a public health hazard and enabled intervention
- This background informs his "truth over polish" principle in sales work

---

*Last updated: 2026-01-20*
