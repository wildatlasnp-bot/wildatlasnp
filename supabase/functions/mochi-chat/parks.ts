/**
 * Park metadata + knowledge base for the mochi-chat edge function.
 *
 * Each park entry includes:
 *   - NPS code, lat/lon, IANA timezone (used for Current Time grounding)
 *   - parkingContext()  — fresh per-call helper that returns season-aware copy
 *   - knowledge         — long-form markdown injected into the system prompt
 *
 * Pure data + one helper per park. No Supabase calls, no fetch, no Deno APIs
 * — safe to import from tests.
 */

// ── Park configs for live data fetching ─────────────────────────────

export interface ParkMeta {
  name: string;
  npsCode: string;
  lat: number;
  lon: number;
  timezone: string;
  parkingContext: () => string;
  knowledge: string;
}

export const PARK_META: Record<string, ParkMeta> = {
  yosemite: {
    name: "Yosemite National Park",
    npsCode: "yose",
    lat: 37.7456,
    lon: -119.5936,
    timezone: "America/Los_Angeles",
    parkingContext: () => {
      const now = new Date();
      const month = now.getUTCMonth() + 1;
      const isPeak = month >= 5 && month <= 10;
      const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;
      if (!isPeak) return "Off-season (Nov–Apr): Valley parking rarely fills.";
      return `Peak season (May–Oct). Valley lots typically fill by 8:30 AM weekdays, earlier on weekends. ${isWeekend ? "TODAY IS A WEEKEND — expect earlier fill times." : "Weekday — slightly better odds."} Alternatives: YARTS bus from El Portal ($6), Mariposa ($12), Merced ($18). Free Valley shuttle 7 AM–10 PM. Afternoon turnover typically 2–3 PM.`;
    },
    knowledge: `## Parking Knowledge
- Valley lots fill by **8:30 AM** weekdays, **7:30 AM** weekends in peak season (May–Oct)
- YARTS bus: El Portal ($6), Mariposa ($12), Merced ($18) — yarts.com
- Free Valley shuttle: 7 AM–10 PM
- Afternoon turnover window: **2–3 PM**

## Permit Knowledge
- Half Dome pre-season lottery: **March 1–31** at recreation.gov, results mid-April
- Daily lottery: 2 days before hike date
- Wilderness permits: required year-round for overnights, reservable 24 weeks ahead

## Fees (2026)
- US vehicles: **$35**/entry, America the Beautiful Pass: **$80**/yr
- Non-US visitors: **$100**/person (effective Jan 1, 2026)

## Trail Conditions by Season

### Winter (Dec–Mar)
- **Valley floor**: open, flat trails clear. Mirror Lake, Cook's Meadow, Lower Yosemite Fall loop all accessible.
- **Mist Trail**: icy above Vernal Fall footbridge — microspikes recommended.
- **Upper Yosemite Falls**: snow/ice above Columbia Rock — traction devices required.
- **Glacier Point / Panorama Trail**: closed (road gated at Badger Pass).
- **Mariposa Grove**: snowshoe access only, road closed to vehicles.
- Waterfalls: **low flow** Dec–Feb, picking up in March.
- Sunset: ~**5:00 PM**. Plan to finish hikes by **4 PM**.

### Spring (Apr–May)
- **Mist Trail**: open but very wet — waterproof layers essential. Peak waterfall flow **mid-May to early June**.
- **Upper Yosemite Falls**: snow patches above Columbia Rock into May.
- **Valley floor**: all trails open. Wildflowers peak **late April–May**.
- **Glacier Point Road**: typically opens **late May** (weather dependent).
- **Tioga Road**: closed until **late May–June**.
- Sunset: ~**7:30–8:00 PM**.

### Summer (Jun–Sep)
- All trails open. **Half Dome cables up mid-May through mid-Oct** (permit required).
- **Mist Trail**: dry by July, crowded — start by **7 AM**.
- **Tioga Road & Tuolumne Meadows**: open. Great high-country hiking.
- Heat advisory: Valley temps reach **95–105°F** Jul–Aug. Carry 3L water minimum.
- Waterfalls: **dry by August** except Vernal Fall (reduced).
- Sunset: ~**8:30 PM**. Golden hour at Glacier Point starts ~**7 PM**.

### Fall (Oct–Nov)
- **Half Dome cables**: down by **mid-October**.
- Valley trails: open, uncrowded. Fall color peaks **late October**.
- **Glacier Point Road**: closes for season **early November**.
- **Tioga Road**: closes with first major snowfall, usually **late October**.
- Waterfalls: minimal flow. Horsetail Fall "firefall" effect: **mid-February only**.
- Sunset: ~**5:30–6:30 PM**.`,
  },
  rainier: {
    name: "Mount Rainier National Park",
    npsCode: "mora",
    lat: 46.8523,
    lon: -121.7603,
    timezone: "America/Los_Angeles",
    parkingContext: () => {
      const now = new Date();
      const month = now.getUTCMonth() + 1;
      const isPeak = month >= 6 && month <= 9;
      const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;
      if (!isPeak) return "Off-season (Oct–May): Paradise and Sunrise lots rarely fill. Some roads may be closed.";
      return `Peak season (Jun–Sep). Paradise lot fills by 10 AM on weekends, 11 AM weekdays. ${isWeekend ? "TODAY IS A WEEKEND — arrive by 9 AM." : "Weekday — better odds but still fills midday."} No shuttle service — driving is the only option. Timed entry reservations required on peak weekends.`;
    },
    knowledge: `## Parking Knowledge
- Paradise lot fills by **10 AM** weekends, **11 AM** weekdays in peak season (Jun–Sep)
- Sunrise lot fills by **11 AM** on weekends
- No shuttle service available — personal vehicle or carpool only
- Timed entry reservations required on peak summer weekends

## Permit Knowledge
- Wonderland Trail: lottery opens **March 1**, results mid-April. 70% lottery, 30% walk-up
- Camp Muir: no permit required for day hikes, climbing permit required above Muir
- Wilderness Camping: required year-round for backcountry overnights, reservable starting March 1

## Fees (2026)
- US vehicles: **$30**/entry, America the Beautiful Pass: **$80**/yr
- Non-US visitors: **$100**/person (effective Jan 1, 2026)

## Key Routes
- Paradise: most popular, open year-round (chains required in winter)
- Sunrise: highest drive-to point, open Jul–Sep
- Carbon River: rainforest access, limited facilities
- Mowich Lake: primitive camping, no reservations needed

## Trail Conditions by Season

### Winter (Dec–Mar)
- **Paradise trails**: snowshoe/cross-country ski only. Nisqually Vista loop popular.
- **Skyline Trail**: buried under snow — not hikeable.
- **Grove of the Patriarchs**: closed (bridge damage, check NPS for updates).
- **Carbon River Trail**: open for low-elevation rainforest walks.
- Road access: only **Nisqually entrance to Paradise** open (chains required).
- Sunrise, Mowich, Carbon River roads: **closed**.
- Sunset: ~**4:30 PM**. Start snowshoe trips by **1 PM**.

### Spring (Apr–Jun)
- **Paradise**: snow lingers through June. Snowshoes needed until late May.
- **Skyline Trail**: partially snow-covered into **mid-July** most years.
- **Rampart Ridge / Trail of the Shadows**: snow-free by **late April**.
- **Wonderland Trail**: not fully passable until **mid-July**.
- Wildflowers at Paradise: peak **late July–early August** (not spring).
- Sunrise Road: opens **late June–early July**.

### Summer (Jul–Sep)
- All major trails open. **Paradise wildflower meadows peak late July–mid-August**.
- **Skyline Trail**: fully open, best views of Rainier. Start by **8 AM** to beat clouds.
- **Sunrise area**: open Jul–Sep. Burroughs Mountain for alpine tundra.
- **Camp Muir**: snow travel — ice axe and crampons recommended above Muir Snowfield.
- **Wonderland Trail**: full 93-mile loop hikeable. Permit required.
- Heat: rare — temps at Paradise **55–70°F**. Valley temps **80–90°F**.
- Sunset: ~**8:45 PM**. Alpenglow on Rainier starts ~**8 PM**.

### Fall (Oct–Nov)
- **Paradise**: trails open but snow possible by mid-October.
- **Sunrise Road**: closes **early October**.
- Fall color: **late September–mid-October** at lower elevations.
- **Grove of the Patriarchs**: check NPS for bridge status.
- First snow at Paradise: typically **mid-October**.
- Sunset: ~**5:30–6:00 PM**.`,
  },
  glacier: {
    name: "Glacier National Park",
    npsCode: "glac",
    lat: 48.7596,
    lon: -113.787,
    timezone: "America/Denver",
    parkingContext: () => {
      const now = new Date();
      const month = now.getUTCMonth() + 1;
      const isPeak = month >= 6 && month <= 9;
      const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;
      if (!isPeak) return "Off-season (Oct–May): Most parking accessible. Going-to-the-Sun Road closed.";
      return `Peak season (Jun–Sep). Logan Pass lot fills by 8 AM daily. ${isWeekend ? "TODAY IS A WEEKEND — arrive by 7 AM or take shuttle." : "Weekday — still fills early."} Free shuttle from Apgar. Vehicle reservation required for Going-to-the-Sun Road.`;
    },
    knowledge: `## Parking Knowledge
- **Logan Pass** fills by **8 AM** daily in summer
- Free shuttle from **Apgar Transit Center**
- Vehicle reservation required for **Going-to-the-Sun Road** Jun–Sep
- **Many Glacier** lot fills by **9 AM** weekends

## Permit Knowledge
- Backcountry camping: advance reservations open **March 15** at recreation.gov
- 50% of permits held for walk-ups (day before at ranger stations)

## Fees (2026)
- US vehicles: **$35**/entry, America the Beautiful Pass: **$80**/yr
- Non-US visitors: **$100**/person (effective Jan 1, 2026)

## Trail Conditions by Season

### Winter (Dec–Mar)
- **Going-to-the-Sun Road**: closed beyond **Lake McDonald Lodge**
- **Avalanche Lake Trail**: snowshoe access, avalanche risk
- **Trail of the Cedars**: accessible, flat boardwalk
- **Apgar area**: snowshoeing and cross-country skiing
- Sunset: ~**5:00 PM**

### Spring (Apr–May)
- **Going-to-the-Sun Road**: plowing begins April, opens **late June–early July**
- **Avalanche Lake**: snow-covered into June
- **Lake McDonald trails**: snow-free by **late April**
- Bear activity increasing — carry **bear spray**
- Sunset: ~**8:30 PM**

### Summer (Jun–Sep)
- **Going-to-the-Sun Road**: fully open **early July–mid-October**
- **Highline Trail**: start at **Logan Pass** by **8 AM**
- **Grinnell Glacier**: open mid-July, **8 miles RT**
- **Iceberg Lake**: snow-free by **mid-July**
- Afternoon thunderstorms — finish exposed hikes by **2 PM**
- Sunset: ~**9:15 PM**

### Fall (Oct–Nov)
- **Going-to-the-Sun Road**: closes **mid-October**
- **Larch trees**: golden peaks **late September–early October**
- **Many Glacier**: road closes **mid-October**
- Snow possible above **6,000 ft** any time
- Sunset: ~**6:00 PM**`,
  },
  zion: {
    name: "Zion National Park",
    npsCode: "zion",
    lat: 37.2982,
    lon: -113.0263,
    timezone: "America/Denver",
    parkingContext: () => {
      const now = new Date();
      const month = now.getUTCMonth() + 1;
      const isPeak = (month >= 3 && month <= 5) || (month >= 9 && month <= 11);
      const isSummer = month >= 6 && month <= 8;
      const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;
      if (!isPeak && !isSummer) return "Winter (Dec–Feb): Parking available. Shuttle may be reduced.";
      return `${isPeak ? "Peak season" : "Summer"}. Visitor Center lot fills by 9 AM. ${isWeekend ? "TODAY IS A WEEKEND — arrive by 7 AM." : "Weekday — slightly better."} Mandatory shuttle for Zion Canyon Scenic Drive (Mar–Nov).`;
    },
    knowledge: `## Parking Knowledge
- **Visitor Center lot** fills by **9 AM** peak season
- Mandatory shuttle for **Zion Canyon Scenic Drive** (Mar–Nov)
- **Springdale shuttle** connects town to park entrance

## Permit Knowledge
- **Angels Landing**: permit required year-round (lottery at recreation.gov)
- Seasonal lottery: **Jan 1–Feb 15**, results mid-February
- Day-before lottery: apply 2 days before, results **6 PM** day before
- **The Narrows** top-down: wilderness permit required
- **Subway**: permit required, lottery system

## Fees (2026)
- US vehicles: **$35**/entry, America the Beautiful Pass: **$80**/yr
- Non-US visitors: **$100**/person (effective Jan 1, 2026)

## Trail Conditions by Season

### Winter (Dec–Feb)
- **Angels Landing**: open but icy chains — microspikes essential
- **The Narrows**: **CLOSED** — hypothermia risk
- **Emerald Pools**: open, ice on upper trail
- **Pa'rus Trail**: open, paved, easy
- Temps: **40–55°F** days, **20–30°F** nights
- Sunset: ~**5:30 PM**

### Spring (Mar–May)
- **Angels Landing**: best conditions **April–May**
- **The Narrows**: opens when flow drops below **150 cfs** (usually **late May**)
- Flash flood season — check weather before slot canyons
- Temps: **60–80°F**. Best hiking weather
- Sunset: ~**7:30–8:00 PM**

### Summer (Jun–Aug)
- **Extreme heat**: **100–115°F** on canyon floor
- **The Narrows**: best time — warm water, low flow
- Start hikes by **6 AM**. Heat is #1 rescue cause
- **Angels Landing**: dangerously hot midday
- Carry **3L water minimum**
- Sunset: ~**8:30 PM**

### Fall (Sep–Nov)
- **Best season**. Temps: **65–85°F**
- **Angels Landing**: ideal conditions
- **The Narrows**: excellent — low water, warm days
- Fall color: **late October–November**
- Sunset: ~**6:00–7:00 PM**`,
  },
  "rocky_mountain": {
    name: "Rocky Mountain National Park",
    npsCode: "romo",
    lat: 40.3428,
    lon: -105.6836,
    timezone: "America/Denver",
    parkingContext: () => {
      const now = new Date();
      const month = now.getUTCMonth() + 1;
      const isPeak = month >= 6 && month <= 9;
      const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;
      if (!isPeak) return "Off-season (Oct–May): Parking available. Trail Ridge Road closed.";
      return `Peak season (Jun–Sep). Timed entry required. Bear Lake fills by 6:30 AM. ${isWeekend ? "TODAY IS A WEEKEND — arrive by 5:30 AM or use shuttle." : "Weekday — fills by 7 AM."} Free shuttle to Bear Lake corridor.`;
    },
    knowledge: `## Parking Knowledge
- **Bear Lake** fills by **6:30 AM** weekends, **7 AM** weekdays
- Timed entry reservation required **Jun–Sep**
- Free shuttle: **Estes Park → Bear Lake corridor**

## Permit Knowledge
- Backcountry camping: reservations open **March 1** at recreation.gov
- **Longs Peak**: no permit for day hikes
- Timed entry: separate from backcountry permits

## Fees (2026)
- US vehicles: **$30**/entry, America the Beautiful Pass: **$80**/yr
- Non-US visitors: **$100**/person (effective Jan 1, 2026)

## Trail Conditions by Season

### Winter (Dec–Mar)
- **Trail Ridge Road**: closed at **Many Parks Curve**
- **Bear Lake**: snowshoe-friendly. Dream Lake popular
- **Longs Peak**: mountaineering only — ice axe, crampons
- Temps: **20–35°F** days, **-10 to 10°F** at elevation
- Sunset: ~**4:45 PM**

### Spring (Apr–May)
- **Bear Lake trails**: snow into May. Microspikes needed
- **Trail Ridge Road**: opens **late May–early June**
- **Wild Basin**: lower trails by late April
- **Longs Peak**: full winter conditions through May
- Sunset: ~**7:45–8:00 PM**

### Summer (Jun–Sep)
- All trails open. **Trail Ridge Road** open (**12,183 ft**)
- **Longs Peak**: start by **3 AM** for summit
- **Sky Pond**: **9 miles RT**, start by **6 AM**
- Lightning above treeline — **below 12,000 ft by noon**
- Temps: **70–80°F** valleys, **50–60°F** alpine
- Sunset: ~**8:30 PM**

### Fall (Oct–Nov)
- **Elk rut**: late Sep–mid-Oct. Best wildlife viewing
- **Trail Ridge Road**: closes **mid-October**
- Aspens golden **late September**
- **Longs Peak**: technical conditions return after Oct 1
- Sunset: ~**5:30–6:30 PM**`,
  },
  arches: {
    name: "Arches National Park",
    npsCode: "arch",
    lat: 39.7085,
    lon: -109.5925,
    timezone: "America/Denver",
    parkingContext: () => {
      const now = new Date();
      const month = now.getUTCMonth() + 1;
      const isPeak = (month >= 3 && month <= 5) || (month >= 9 && month <= 10);
      const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;
      if (!isPeak) return month >= 6 && month <= 8 ? "Summer: Hot. Start hikes before 8 AM." : "Winter: Parking available. No timed entry.";
      return `Peak season. Timed entry required. ${isWeekend ? "WEEKEND — book timed entry in advance." : "Weekday — still need timed entry."} Devils Garden lot fills by 9 AM.`;
    },
    knowledge: `## Parking Knowledge
- Timed entry required **Apr–Oct**
- **Devils Garden** lot fills by **9 AM** peak season
- **Delicate Arch** trailhead fills by **3 PM** (sunset hikers)

## Permit Knowledge
- **Fiery Furnace**: ranger tour or self-guided permit required (recreation.gov)
- Lottery opens **monthly**, 3 months ahead
- No permits needed for standard trails

## Fees (2026)
- US vehicles: **$30**/entry, America the Beautiful Pass: **$80**/yr
- Non-US visitors: **$100**/person (effective Jan 1, 2026)

## Trail Conditions by Season

### Winter (Dec–Feb)
- All trails open. **Best uncrowded season**
- **Delicate Arch**: icy slickrock — microspikes recommended
- **Devils Garden**: may have ice patches
- **Landscape Arch**: easy 1.6-mile walk
- Temps: **30–45°F** days, **10–20°F** nights
- No timed entry. Sunset: ~**5:15 PM**

### Spring (Mar–May)
- **Best hiking season**. Temps: **55–80°F**
- **Delicate Arch**: ideal. Start **2 hours before sunset**
- **Devils Garden Primitive Loop**: best in spring
- **Fiery Furnace**: tours begin mid-March
- Wind common — bring layers
- Sunset: ~**7:30–8:00 PM**

### Summer (Jun–Aug)
- **Extreme heat**: **95–110°F**
- **Hike before 8 AM or after 6 PM only**
- **Delicate Arch**: sunrise or skip. No shade
- Carry **3L water minimum**
- Timed entry required
- Sunset: ~**8:45 PM**

### Fall (Sep–Nov)
- **Excellent season**. Temps: **60–85°F** Sep, **40–60°F** Nov
- **Delicate Arch**: sunset hike prime
- **Fiery Furnace**: tours through October
- Crowds thin after October
- Sunset: ~**6:00–7:00 PM**`,
  },
  "grand_canyon": {
    name: "Grand Canyon National Park",
    npsCode: "grca",
    lat: 36.0544,
    lon: -112.1401,
    timezone: "America/Phoenix",
    parkingContext: () => {
      const now = new Date();
      const month = now.getUTCMonth() + 1;
      const isPeak = (month >= 3 && month <= 5) || (month >= 9 && month <= 11);
      const isSummer = month >= 6 && month <= 8;
      const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;
      if (!isPeak && !isSummer) return "Winter (Dec–Feb): South Rim open year-round. Parking available. North Rim closed.";
      return `${isPeak ? "Peak season" : "Summer"}. Visitor Center lot fills by 9 AM. ${isWeekend ? "TODAY IS A WEEKEND — arrive by 7 AM or use shuttle." : "Weekday — fills by 9 AM."} Free shuttle required in peak season — personal vehicles restricted on most South Rim roads.`;
    },
    knowledge: `## Parking Knowledge
- **Visitor Center Plaza** fills by **9 AM** peak season
- Free shuttle required Mar–Nov on most South Rim roads
- **Mather Point** lot fills earliest — use shuttle from Visitor Center
- **Desert View** (east entrance): less crowded, separate lot
## Permit Knowledge
- **Bright Angel / North Kaibab overnight**: lottery opens **October 1** for following year at recreation.gov
- Walk-up permits available at Backcountry Information Center day-of (limited)
- **Rim-to-Rim**: permit required for all overnight stays below the rim
- Day hikes to the rim: no permit needed
## Fees (2026)
- US vehicles: **$35**/entry, America the Beautiful Pass: **$80**/yr
- Non-US visitors: **$100**/person (effective Jan 1, 2026)
## Trail Conditions by Season
### Winter (Dec–Feb)
- **South Rim Trail**: open year-round, paved, flat
- **Bright Angel Trail**: upper sections icy — microspikes required below tunnel
- **South Kaibab**: icy and exposed — not recommended in winter
- **North Rim**: closed (road gated at Jacob Lake)
- Temps: **35–45°F** rim, **50–60°F** inner canyon
- Sunset: ~**5:30 PM**. Inner canyon gets dark early — plan accordingly.
### Spring (Mar–May)
- **Best hiking season**. Temps: **60–80°F** rim, **80–95°F** inner canyon
- **Bright Angel**: ideal. Carry **3L water minimum** below the rim
- **South Kaibab**: open, stunning views. No water on trail — carry all you need
- **North Rim**: opens **mid-May**
- Flash flood risk in side canyons — check forecast
- Sunset: ~**7:30–8:00 PM**
### Summer (Jun–Aug)
- **Extreme heat**: inner canyon **105–115°F**. Ranger-enforced turnaround points
- **Hike down in early morning only** — below-rim hiking banned midday in summer
- **Phantom Ranch**: reservations required, books out months ahead
- **South Kaibab**: exposed, no shade — avoid in summer heat
- Carry **4L water minimum** for any below-rim hike
- Sunset: ~**8:00 PM**
### Fall (Sep–Nov)
- **Excellent season**. Temps: **65–85°F** rim, **85–100°F** inner canyon in September
- **Bright Angel**: best fall conditions — water stations open
- **North Rim**: closes **October 15**
- **Rim-to-Rim**: optimal window **late September–mid-October**
- Fall color: limited on rim, but cottonwoods in canyon glow gold
- Sunset: ~**6:00–7:00 PM**`,
  },
  "grand_teton": {
    name: "Grand Teton National Park",
    npsCode: "grte",
    lat: 43.7904,
    lon: -110.6818,
    timezone: "America/Denver",
    parkingContext: () => {
      const now = new Date();
      const month = now.getUTCMonth() + 1;
      const isPeak = month >= 6 && month <= 9;
      const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;
      if (!isPeak) return "Off-season (Oct–May): Most facilities closed. Parking available at plowed areas. Highway 89 may require chains.";
      return `Peak season (Jun–Sep). Jenny Lake lot fills by **8 AM** daily. ${isWeekend ? "TODAY IS A WEEKEND — arrive by 7 AM." : "Weekday — fills by 8:30 AM."} String Lake overflow lot available. No shuttle system — personal vehicle required.`;
    },
    knowledge: `## Parking Knowledge
- **Jenny Lake** fills by **8 AM** peak season
- **String Lake** overflow lot: good backup for Jenny Lake area
- **Lupine Meadows** trailhead: fills by **7:30 AM** weekends
- No shuttle system — personal vehicle required for most trailheads
## Permit Knowledge
- **Backcountry camping**: reservations open **January 5** at recreation.gov
- **Climb permits**: required for all technical routes on the Grand Teton
- Day hiking: no permits needed
- **Paintbrush/Cascade Canyon Loop**: backcountry permit required for overnight
## Fees (2026)
- US vehicles: **$35**/entry, America the Beautiful Pass: **$80**/yr
- Non-US visitors: **$100**/person (effective Jan 1, 2026)
## Trail Conditions by Season
### Winter (Dec–Mar)
- **Highway 89/191**: open year-round but chains required in storms
- **Taggart Lake Trail**: snowshoe access, beautiful and quiet
- **Jenny Lake**: frozen — do not walk on ice
- **Moose–Wilson Road**: closed
- **Jackson Lake Lodge area**: cross-country skiing
- Temps: **15–30°F** days, **-10 to 10°F** nights
- Sunset: ~**5:00 PM**
### Spring (Apr–May)
- **Taggart/Bradley Lakes**: snow-free by **late April**
- **Jenny Lake Loop**: snow patches into May
- **Lupine Meadows**: muddy, passable by **early May**
- **Teton Crest Trail**: snow-covered until **mid-July**
- Wildflowers: peak **late May–June**
- Bear activity high — carry **bear spray**
- Sunset: ~**8:30 PM**
### Summer (Jun–Sep)
- All major trails open. **Jenny Lake Loop**: best views, start by **7 AM**
- **Cascade Canyon**: open mid-June. 9 miles RT to Lake Solitude
- **Grand Teton summit**: permit required, technical climbing
- **Teton Crest Trail**: open **mid-July–September**. 40 miles, 3–5 days
- Wildlife prime: **moose at Oxbow Bend** (dawn/dusk)
- Temps: **70–85°F** valleys, **50–65°F** above 9,000 ft
- Afternoon thunderstorms — off exposed ridges by **2 PM**
- Sunset: ~**8:45 PM**
### Fall (Oct–Nov)
- **Peak wildlife season**: elk rut **mid-September–October**
- **Oxbow Bend**: best fall color **late September–early October**
- **Jenny Lake**: uncrowded, excellent photography
- **Teton Park Road**: closes **November 1** to vehicles
- Snow possible above **7,000 ft** after **mid-October**
- Sunset: ~**6:00–7:00 PM**`,
  },
};


export const DEFAULT_PARK = "yosemite";
