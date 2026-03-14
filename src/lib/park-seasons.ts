import {
  Flame, Droplets, Mountain, Camera, AlertTriangle,
  Snowflake, Sun, Leaf, Flower2, Car, MapPin, TreePine, Hotel,
  Footprints, Wind, CloudRain, Tent, ThermometerSun, type LucideIcon
} from "lucide-react";

export type Season = "spring" | "summer" | "fall" | "winter";

export interface TipSignal {
  label: string;
  value: string;
}

export interface Tip {
  id: number;
  icon: LucideIcon;
  title: string;
  body: string;
  signals?: TipSignal[];
}

export interface SeasonData {
  label: string;
  icon: LucideIcon;
  mochiTip: { title: string; body: string };
  tips: Tip[];
}

export const seasons: Season[] = ["spring", "summer", "fall", "winter"];

export function getCurrentSeason(): Season {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

/* ── Yosemite ── */

const yosemiteSeasons: Record<Season, SeasonData> = {
  spring: {
    label: "Spring", icon: Flower2,
    mochiTip: { title: "🐻 Mochi's Spring Tip", body: "Waterfalls peak in May — Yosemite Falls and Bridalveil are thundering. Don't miss Firefall in February if you're early-season!" },
    tips: [
      { id: 1, icon: Droplets, title: "Waterfall Season", body: "Peak flow in May. Yosemite Falls drops 2,425 ft — the tallest in North America.", signals: [{ label: "Peak Flow", value: "May" }, { label: "Top Spot", value: "Yosemite Falls (2,425 ft)" }] },
      { id: 2, icon: Flame, title: "Firefall Window", body: "Mid-to-late February at Horsetail Fall. Arrive by 4 PM for a spot at El Capitan Picnic Area.", signals: [{ label: "Best Time", value: "Mid–Late February" }, { label: "Arrive Before", value: "4 PM" }] },
      { id: 3, icon: Mountain, title: "Trail Conditions", body: "Upper trails may have snow patches through May. Check conditions before heading above 7,000 ft.", signals: [{ label: "Snow Until", value: "May" }, { label: "Check Above", value: "7,000 ft" }] },
      { id: 4, icon: Camera, title: "Wildflower Bloom", body: "Valley meadows bloom March–May. Sentinel Meadow and Cook's Meadow are prime spots.", signals: [{ label: "Peak Season", value: "March–May" }, { label: "Best Areas", value: "Sentinel & Cook's Meadow" }] },
    ],
  },
  summer: {
    label: "Summer", icon: Sun,
    mochiTip: { title: "🐻 Mochi's Summer Warning", body: "**Valley lots fill by 8:30 AM.** Enter through the gate before 7:30 AM or take YARTS from Merced. Half Dome permits are required — lottery closed March 31." },
    tips: [
      { id: 1, icon: AlertTriangle, title: "8:30 AM Parking", body: "Valley lots full by 8:30 AM. Gate entry recommended before 7:30 AM.", signals: [{ label: "Lots Full By", value: "8:30 AM" }, { label: "Enter Before", value: "7:30 AM" }] },
      { id: 2, icon: Mountain, title: "Half Dome Permits", body: "Daily lottery available at recreation.gov. Check 2 days before your planned hike.", signals: [{ label: "Permit Type", value: "Daily lottery" }, { label: "Check", value: "2 days before hike" }] },
      { id: 3, icon: Flame, title: "Fire Safety", body: "Campfires only in designated fire rings. Always drown, stir, feel.", signals: [{ label: "Fires Allowed", value: "Designated rings only" }, { label: "Rule", value: "Drown, stir, feel" }] },
      { id: 4, icon: Camera, title: "Golden Hour", body: "Tunnel View at sunset is unbeatable. Arrive 30 min early for a spot.", signals: [{ label: "Best Spot", value: "Tunnel View" }, { label: "Arrive", value: "30 min before sunset" }] },
    ],
  },
  fall: {
    label: "Fall", icon: Leaf,
    mochiTip: { title: "🐻 Mochi's Fall Tip", body: "Crowds thin dramatically after Labor Day. Midweek visits mean near-empty trails and cozy lodges. Book the Ahwahnee now!" },
    tips: [
      { id: 1, icon: TreePine, title: "Quiet Trails", body: "Valley Loop Trail and Lower Yosemite Fall are peaceful midweek. Expect fewer than 50 hikers.", signals: [{ label: "Best Trails", value: "Valley Loop, Lower Falls" }, { label: "Midweek Hikers", value: "< 50" }] },
      { id: 2, icon: Hotel, title: "Lodge Availability", body: "Fall has the best availability. Curry Village tents close mid-Oct, but cabins stay open.", signals: [{ label: "Best Availability", value: "Fall" }, { label: "Tents Close", value: "Mid-October" }] },
      { id: 3, icon: Mountain, title: "Last Chance Hikes", body: "Glacier Point Road closes in November. Hike Sentinel Dome before snow arrives.", signals: [{ label: "Road Closes", value: "November" }, { label: "Must-Do", value: "Sentinel Dome" }] },
      { id: 4, icon: Leaf, title: "Wildlife Activity", body: "Bears are fattening for winter. Secure all food in bear lockers — it's the law.", signals: [{ label: "Activity", value: "Bears foraging" }, { label: "Rule", value: "Bear lockers required" }] },
    ],
  },
  winter: {
    label: "Winter", icon: Snowflake,
    mochiTip: { title: "🐻 Mochi's Winter Alert", body: "Snow chains are REQUIRED on Hwy 41 and 140 Nov–April. Tioga Road and Glacier Point Road are closed. The Valley is serene — and uncrowded." },
    tips: [
      { id: 1, icon: Car, title: "Chain Requirements", body: "R2 chain controls frequent. Carry chains fitted to your tires — practice installing before your trip.", signals: [{ label: "Controls", value: "R2 frequent" }, { label: "Prep", value: "Practice installing chains" }] },
      { id: 2, icon: MapPin, title: "Tioga Road Closed", body: "Tioga Pass (Hwy 120) is closed Nov–May. Glacier Point Road closes similarly.", signals: [{ label: "Tioga Closed", value: "Nov–May" }, { label: "Glacier Pt", value: "Also closed" }] },
      { id: 3, icon: Snowflake, title: "Snow Activities", body: "Badger Pass ski area opens December. Ranger-led snowshoe walks on weekends.", signals: [{ label: "Ski Opens", value: "December" }, { label: "Snowshoe", value: "Weekends (ranger-led)" }] },
      { id: 4, icon: Camera, title: "Winter Magic", body: "Snow-dusted El Capitan is breathtaking. Valley is nearly empty — perfect for photography.", signals: [{ label: "Best Subject", value: "El Capitan in snow" }, { label: "Crowds", value: "Nearly empty" }] },
    ],
  },
};

/* ── Rainier ── */

const rainierSeasons: Record<Season, SeasonData> = {
  spring: {
    label: "Spring", icon: Flower2,
    mochiTip: { title: "🐻 Mochi's Spring Tip", body: "Snow still blankets higher elevations through June. Paradise road may be closed weekdays — check WSDOT alerts before driving up." },
    tips: [
      { id: 1, icon: CloudRain, title: "Avalanche Season", body: "Backcountry avalanche risk remains high through May. Check NWAC forecasts before venturing above treeline.", signals: [{ label: "Risk Level", value: "High through May" }, { label: "Check", value: "NWAC forecasts" }] },
      { id: 2, icon: Flower2, title: "Early Wildflowers", body: "Lower elevation meadows around Longmire start blooming in May. Peak bloom at Paradise comes later in July.", signals: [{ label: "Early Bloom", value: "May (Longmire)" }, { label: "Peak Bloom", value: "July (Paradise)" }] },
      { id: 3, icon: Car, title: "Road Openings", body: "Sunrise Road typically opens late June. Paradise Road is open year-round but may close for storms.", signals: [{ label: "Sunrise Rd", value: "Opens late June" }, { label: "Paradise Rd", value: "Year-round" }] },
      { id: 4, icon: Mountain, title: "Climbing Season Prep", body: "Summit attempts begin in May. Register at the climbing ranger station and carry a WAG bag.", signals: [{ label: "Season Start", value: "May" }, { label: "Required", value: "Registration + WAG bag" }] },
    ],
  },
  summer: {
    label: "Summer", icon: Sun,
    mochiTip: { title: "🐻 Mochi's Summer Warning", body: "**Wonderland Trail permits sell out in minutes.** Wilderness permits are required May 15–Oct 15. Camp Muir fills fast on clear weekends — start early." },
    tips: [
      { id: 1, icon: Footprints, title: "Wonderland Trail", body: "93 miles around the mountain. Permits released March 1 — set your alarm. Cancellations appear on Recreation.gov.", signals: [{ label: "Distance", value: "93 miles" }, { label: "Permits Drop", value: "March 1" }] },
      { id: 2, icon: Mountain, title: "Camp Muir", body: "10,080 ft base camp for summit attempts. Start from Paradise by 5 AM. Bring crampons and an ice axe.", signals: [{ label: "Elevation", value: "10,080 ft" }, { label: "Start By", value: "5 AM from Paradise" }] },
      { id: 3, icon: Tent, title: "Wilderness Camping", body: "138 backcountry camps. Popular sites like Indian Bar and Summerland book months ahead.", signals: [{ label: "Total Camps", value: "138" }, { label: "Top Sites", value: "Indian Bar, Summerland" }] },
      { id: 4, icon: ThermometerSun, title: "Paradise Crowds", body: "Paradise parking fills by 10 AM on weekends. Arrive before 8 AM or visit midweek.", signals: [{ label: "Fills By", value: "10 AM weekends" }, { label: "Arrive Before", value: "8 AM" }] },
    ],
  },
  fall: {
    label: "Fall", icon: Leaf,
    mochiTip: { title: "🐻 Mochi's Fall Tip", body: "September is Rainier's secret weapon — clear skies, thin crowds, and stunning larch trees turning gold at higher elevations. Last call for Wonderland!" },
    tips: [
      { id: 1, icon: Leaf, title: "Larch Season", body: "Subalpine larches turn brilliant gold in late September. Best viewed along the Naches Peak Loop trail.", signals: [{ label: "Peak Color", value: "Late September" }, { label: "Best Trail", value: "Naches Peak Loop" }] },
      { id: 2, icon: TreePine, title: "Quiet Backcountry", body: "Permit availability opens up dramatically after Labor Day. Great time for spontaneous Wonderland sections.", signals: [{ label: "Permits Open", value: "After Labor Day" }, { label: "Best For", value: "Spontaneous trips" }] },
      { id: 3, icon: Wind, title: "Weather Shifts", body: "Pacific storms arrive by October. Bring rain gear and check forecasts — conditions change fast above 6,000 ft.", signals: [{ label: "Storms Start", value: "October" }, { label: "Gear", value: "Rain gear essential" }] },
      { id: 4, icon: Camera, title: "Photo Season", body: "Clear fall mornings offer the best views of the summit. Reflection Lakes at sunrise is iconic.", signals: [{ label: "Best Spot", value: "Reflection Lakes" }, { label: "Best Time", value: "Sunrise" }] },
    ],
  },
  winter: {
    label: "Winter", icon: Snowflake,
    mochiTip: { title: "🐻 Mochi's Winter Alert", body: "Paradise averages **640 inches of snow per year** — one of the snowiest places on Earth. Only the Nisqually entrance to Paradise is open. Tire chains required." },
    tips: [
      { id: 1, icon: Snowflake, title: "Epic Snowfall", body: "Paradise holds the world record for annual snowfall (1,122 inches in 1971–72). Snowshoeing and cross-country skiing are prime.", signals: [{ label: "Record", value: "1,122 inches (1971–72)" }, { label: "Activities", value: "Snowshoe, XC ski" }] },
      { id: 2, icon: Car, title: "Limited Access", body: "Only Nisqually–Paradise road is plowed. Sunrise, Carbon River, and Mowich are closed November–June.", signals: [{ label: "Open Road", value: "Nisqually–Paradise only" }, { label: "Closed", value: "Nov–June (most roads)" }] },
      { id: 3, icon: AlertTriangle, title: "Avalanche Danger", body: "Backcountry travel requires avalanche training and gear. Check NWAC daily before heading out.", signals: [{ label: "Required", value: "Avy training + gear" }, { label: "Check", value: "NWAC daily" }] },
      { id: 4, icon: Mountain, title: "Winter Climbing", body: "Winter summit attempts are expert-only. Extreme cold, high winds, and whiteout conditions are common above 10,000 ft.", signals: [{ label: "Difficulty", value: "Expert-only" }, { label: "Hazards", value: "Cold, wind, whiteout" }] },
    ],
  },
};

/* ── Zion ── */

const zionSeasons: Record<Season, SeasonData> = {
  spring: {
    label: "Spring", icon: Flower2,
    mochiTip: { title: "🐻 Mochi's Spring Tip", body: "Spring runoff makes the Narrows impassable in April–May. Check Virgin River flow rates at the visitor center before attempting any canyon hike." },
    tips: [
      { id: 1, icon: Droplets, title: "River Flow Warning", body: "Virgin River peaks 200+ CFS in spring. The Narrows closes when flow exceeds 150 CFS — check daily.", signals: [{ label: "Peak Flow", value: "200+ CFS" }, { label: "Narrows Closes", value: "Above 150 CFS" }] },
      { id: 2, icon: Flower2, title: "Desert Bloom", body: "Wildflowers carpet the canyon floor March–May. Watchman Trail and Pa'rus Trail are prime viewing spots.", signals: [{ label: "Peak Season", value: "March–May" }, { label: "Best Trails", value: "Watchman, Pa'rus" }] },
      { id: 3, icon: Mountain, title: "Angels Landing", body: "Permits required year-round. Spring lottery opens January. Chains on the final stretch can be icy early season.", signals: [{ label: "Permits", value: "Year-round required" }, { label: "Lottery Opens", value: "January" }] },
      { id: 4, icon: Car, title: "Shuttle Season Starts", body: "The Zion Canyon shuttle runs March–November. Private vehicles are restricted on Scenic Drive during this period.", signals: [{ label: "Shuttle Runs", value: "March–November" }, { label: "Private Cars", value: "Restricted" }] },
    ],
  },
  summer: {
    label: "Summer", icon: Sun,
    mochiTip: { title: "🐻 Mochi's Summer Warning", body: "**Temperatures exceed 105°F in the canyon.** Carry 1 liter of water per hour of hiking. Flash flood risk peaks July–September during monsoon season." },
    tips: [
      { id: 1, icon: ThermometerSun, title: "Extreme Heat", body: "Canyon floor regularly hits 105°F+. Start hikes before 7 AM and avoid exposed trails midday.", signals: [{ label: "Temps", value: "105°F+" }, { label: "Start Before", value: "7 AM" }] },
      { id: 2, icon: AlertTriangle, title: "Flash Flood Risk", body: "Monsoon season July–Sept. Never enter slot canyons when storms are forecast — water rises in minutes.", signals: [{ label: "Monsoon", value: "July–September" }, { label: "Rule", value: "No slot canyons in storms" }] },
      { id: 3, icon: Droplets, title: "Narrows Season", body: "Late June–September is prime for the Narrows. Rent canyoneering shoes at Zion Outfitter. Water temps are refreshing!", signals: [{ label: "Best Window", value: "Late June–September" }, { label: "Gear Rental", value: "Zion Outfitter" }] },
      { id: 4, icon: Camera, title: "Night Sky", body: "Zion is a Dark Sky Park. Summer Milky Way is spectacular from the Canyon Overlook or Lava Point.", signals: [{ label: "Designation", value: "Dark Sky Park" }, { label: "Best Views", value: "Canyon Overlook, Lava Pt" }] },
    ],
  },
  fall: {
    label: "Fall", icon: Leaf,
    mochiTip: { title: "🐻 Mochi's Fall Tip", body: "October–November is Zion's sweet spot — cooler temps, fall color in the cottonwoods, and the Narrows at perfect flow. Crowds drop 40% after Labor Day." },
    tips: [
      { id: 1, icon: Leaf, title: "Fall Foliage", body: "Fremont cottonwoods turn gold along the Virgin River in late October. The Riverwalk is stunning.", signals: [{ label: "Peak Color", value: "Late October" }, { label: "Best Walk", value: "Riverwalk" }] },
      { id: 2, icon: Footprints, title: "Ideal Hiking", body: "Temps in the 60s–70s make Observation Point and West Rim Trail comfortable all day.", signals: [{ label: "Temps", value: "60s–70s" }, { label: "Top Trails", value: "Observation Pt, West Rim" }] },
      { id: 3, icon: Tent, title: "Camping Availability", body: "Watchman Campground stays open year-round. South Campground closes late November. Book early for October weekends.", signals: [{ label: "Year-Round", value: "Watchman Campground" }, { label: "South Closes", value: "Late November" }] },
      { id: 4, icon: Mountain, title: "Canyoneering Season", body: "Fall is prime for technical canyons like Mystery Canyon and Orderville. Permits required — check recreation.gov.", signals: [{ label: "Best Canyons", value: "Mystery, Orderville" }, { label: "Permits", value: "Required" }] },
    ],
  },
  winter: {
    label: "Winter", icon: Snowflake,
    mochiTip: { title: "🐻 Mochi's Winter Alert", body: "Zion's canyon floor rarely freezes, but Angels Landing chains ice over frequently. Micro-spikes are essential Dec–Feb. The shuttle doesn't run — you can drive Scenic Drive!" },
    tips: [
      { id: 1, icon: Car, title: "Drive Scenic Drive", body: "No shuttle December–February means you can drive the full Scenic Drive. Parking still fills by 10 AM on holidays.", signals: [{ label: "Private Cars", value: "Allowed Dec–Feb" }, { label: "Fills By", value: "10 AM on holidays" }] },
      { id: 2, icon: Snowflake, title: "Ice on Chains", body: "Angels Landing's chain section is treacherous when icy. Micro-spikes and trekking poles are must-haves.", signals: [{ label: "Hazard", value: "Icy chain section" }, { label: "Gear", value: "Micro-spikes + poles" }] },
      { id: 3, icon: Camera, title: "Winter Light", body: "Low winter sun creates dramatic shadows in the canyon. Afternoon light on the Watchman is magical.", signals: [{ label: "Best Light", value: "Afternoon" }, { label: "Best Subject", value: "The Watchman" }] },
      { id: 4, icon: TreePine, title: "Solitude", body: "Visitor numbers drop 80% in January. Popular trails feel private — the Emerald Pools are nearly empty.", signals: [{ label: "Crowds Drop", value: "80% in January" }, { label: "Empty Trail", value: "Emerald Pools" }] },
    ],
  },
};

/* ── Glacier ── */

const glacierSeasons: Record<Season, SeasonData> = {
  spring: {
    label: "Spring", icon: Flower2,
    mochiTip: { title: "🐻 Mochi's Spring Tip", body: "Going-to-the-Sun Road won't fully open until late June or early July. Lower elevation trails around Lake McDonald are your best bet in spring." },
    tips: [
      { id: 1, icon: Car, title: "Road Closures", body: "Going-to-the-Sun Road is closed at Avalanche Creek until plowing finishes — usually late June. Check NPS for updates.", signals: [{ label: "Closed Until", value: "Late June" }, { label: "Check", value: "NPS updates" }] },
      { id: 2, icon: Droplets, title: "Snowmelt & Waterfalls", body: "Spring runoff creates spectacular waterfalls. Bird Woman Falls and Weeping Wall peak in May–June.", signals: [{ label: "Peak Falls", value: "May–June" }, { label: "Top Spots", value: "Bird Woman, Weeping Wall" }] },
      { id: 3, icon: AlertTriangle, title: "Bear Activity", body: "Grizzlies emerge from dens in April. Carry bear spray and make noise. Trail closures are common.", signals: [{ label: "Active From", value: "April" }, { label: "Required", value: "Bear spray" }] },
      { id: 4, icon: Flower2, title: "Wildflower Preview", body: "Lower valleys see early beargrass and glacier lilies in May. Peak alpine bloom comes later in July.", signals: [{ label: "Early Bloom", value: "May (valleys)" }, { label: "Alpine Peak", value: "July" }] },
    ],
  },
  summer: {
    label: "Summer", icon: Sun,
    mochiTip: { title: "🐻 Mochi's Summer Warning", body: "**Vehicle reservations required to enter Going-to-the-Sun Road corridor 6 AM–3 PM.** Book at recreation.gov when they drop — they sell out in minutes." },
    tips: [
      { id: 1, icon: Car, title: "Entry Reservations", body: "Required May 23–Sept 8 for the Sun Road corridor. $2/vehicle. Reservations release 120 days ahead." },
      { id: 2, icon: Mountain, title: "Highline Trail", body: "Glacier's most iconic hike. 11.8 miles along the Continental Divide. Start at Logan Pass — arrive by 7 AM." },
      { id: 3, icon: Tent, title: "Backcountry Permits", body: "Advance permits open March 15. Walk-up permits available 24 hours ahead but go fast for popular zones." },
      { id: 4, icon: Camera, title: "Glaciers Vanishing", body: "Only 25 named glaciers remain (down from 150 in 1850). Grinnell Glacier trail is a must-see while they last." },
    ],
  },
  fall: {
    label: "Fall", icon: Leaf,
    mochiTip: { title: "🐻 Mochi's Fall Tip", body: "Larch trees turn gold in late September — the Larch Valley near Siyeh Pass is unforgettable. Going-to-the-Sun Road closes mid-October." },
    tips: [
      { id: 1, icon: Leaf, title: "Larch Season", body: "Western larches blaze gold late September. Hike to Ptarmigan Tunnel or Siyeh Pass for the best groves." },
      { id: 2, icon: MapPin, title: "Road Closing Soon", body: "Going-to-the-Sun Road closes to vehicles mid-October. Bike it car-free in the shoulder season!" },
      { id: 3, icon: Wind, title: "Weather Changes Fast", body: "Snow can hit Logan Pass by late September. Layer up and pack emergency gear for any high-altitude hike." },
      { id: 4, icon: TreePine, title: "Wildlife Watching", body: "Elk rut in September and bighorn sheep descend. Many Glacier valley is prime for spotting." },
    ],
  },
  winter: {
    label: "Winter", icon: Snowflake,
    mochiTip: { title: "🐻 Mochi's Winter Alert", body: "Most of Glacier is inaccessible in winter. Only the Apgar area and Lake McDonald Lodge road are plowed. Cross-country skiing and snowshoeing are world-class." },
    tips: [
      { id: 1, icon: Snowflake, title: "Deep Snow", body: "Logan Pass receives 30+ feet of snow. Going-to-the-Sun Road becomes a ski/snowshoe route beyond Lake McDonald." },
      { id: 2, icon: Car, title: "Limited Access", body: "Only the west entrance (Apgar) is accessible. North Fork and Many Glacier roads close by November." },
      { id: 3, icon: AlertTriangle, title: "Avalanche Terrain", body: "Backcountry avalanche danger is severe. Take an AIARE course and carry rescue gear if venturing off-trail." },
      { id: 4, icon: Camera, title: "Frozen Lakes", body: "Lake McDonald's famous colored rocks are visible through crystal-clear ice in January. A photographer's dream." },
    ],
  },
};

/* ── Rocky Mountain ── */

const rockyMountainSeasons: Record<Season, SeasonData> = {
  spring: {
    label: "Spring", icon: Flower2,
    mochiTip: { title: "🐻 Mochi's Spring Tip", body: "Trail Ridge Road usually opens Memorial Day weekend, but snow can delay it. Lower elevations like Moraine Park are accessible and teeming with elk calves." },
    tips: [
      { id: 1, icon: Car, title: "Trail Ridge Road", body: "America's highest continuous road (12,183 ft) opens late May. Check NPS for exact opening dates — storms cause delays." },
      { id: 2, icon: Flower2, title: "Elk Calving Season", body: "Cow elk give birth in Moraine Park and Horseshoe Park in May–June. Keep 75 ft distance — mothers are protective." },
      { id: 3, icon: Droplets, title: "Snowmelt Streams", body: "Alberta Falls and Ouzel Falls run strong in May. Spring runoff makes creek crossings tricky on backcountry trails." },
      { id: 4, icon: Mountain, title: "Acclimate First", body: "Estes Park sits at 7,522 ft. Spend a day at elevation before attempting high-altitude hikes to avoid altitude sickness." },
    ],
  },
  summer: {
    label: "Summer", icon: Sun,
    mochiTip: { title: "🐻 Mochi's Summer Warning", body: "**Timed entry reservations required.** Two permits needed: one for Bear Lake Road corridor, another for the rest of the park. Afternoon thunderstorms hit like clockwork — be below treeline by noon." },
    tips: [
      { id: 1, icon: AlertTriangle, title: "Timed Entry Required", body: "Reservations required May 24–Oct 19. Bear Lake corridor is the hardest to get. Book at recreation.gov." },
      { id: 2, icon: ThermometerSun, title: "Lightning Danger", body: "Thunderstorms develop by noon daily. Summit Longs Peak by 11 AM or turn back. Lightning kills above treeline." },
      { id: 3, icon: Mountain, title: "Longs Peak", body: "14,259 ft — Colorado's most iconic summit. Keyhole Route is Class 3 scrambling. Start by 3 AM for a safe window." },
      { id: 4, icon: Tent, title: "Backcountry Camping", body: "Wilderness permits required May–October. Popular sites near Odessa Lake and Thunder Lake book months ahead." },
    ],
  },
  fall: {
    label: "Fall", icon: Leaf,
    mochiTip: { title: "🐻 Mochi's Fall Tip", body: "Elk rut in September is RMNP's signature event. Bulls bugle at dawn and dusk in Moraine Park. Stay in your car — they're unpredictable during rut." },
    tips: [
      { id: 1, icon: Leaf, title: "Elk Rut Season", body: "Bull elk bugle September–October. Moraine Park and Horseshoe Park at dawn are the best viewing spots." },
      { id: 2, icon: TreePine, title: "Aspen Gold", body: "Golden aspens peak late September. Bear Lake Road and the Colorado River Trail on the west side are stunning." },
      { id: 3, icon: MapPin, title: "Trail Ridge Closing", body: "Trail Ridge Road closes mid-October (weather dependent). Last chance for the Alpine Visitor Center at 11,796 ft." },
      { id: 4, icon: Camera, title: "Photo Conditions", body: "Crisp fall air means incredible visibility. Sunrise at Sprague Lake with Hallett Peak reflection is iconic." },
    ],
  },
  winter: {
    label: "Winter", icon: Snowflake,
    mochiTip: { title: "🐻 Mochi's Winter Alert", body: "Trail Ridge Road closes October–Memorial Day. Bear Lake Road stays open but requires 4WD/chains after storms. Snowshoeing to Emerald Lake is magical." },
    tips: [
      { id: 1, icon: Snowflake, title: "Snowshoeing Paradise", body: "Bear Lake to Emerald Lake is perfect for snowshoeing. Rentals available in Estes Park. Trails are well-marked." },
      { id: 2, icon: Car, title: "Winter Road Access", body: "Bear Lake Road is plowed but icy. Trail Ridge and Old Fall River Road are closed. Check conditions daily." },
      { id: 3, icon: Wind, title: "Extreme Wind", body: "Winds above treeline regularly exceed 100 mph. Winter summit attempts on Longs Peak are expert-only." },
      { id: 4, icon: TreePine, title: "Elk in Town", body: "Elk herds winter in Estes Park itself. They graze on lawns and block traffic — a uniquely RMNP experience." },
    ],
  },
};

/* ── Arches ── */

const archesSeasons: Record<Season, SeasonData> = {
  spring: {
    label: "Spring", icon: Flower2,
    mochiTip: { title: "🐻 Mochi's Spring Tip", body: "Spring is Arches' most popular season — timed entry is required April–October. Temperatures are perfect (60s–80s) but Delicate Arch at sunset draws hundreds." },
    tips: [
      { id: 1, icon: Car, title: "Timed Entry Required", body: "Reservations required April 1–October 31, 7 AM–4 PM. Book at recreation.gov — they release 3 months ahead." },
      { id: 2, icon: Flower2, title: "Desert Wildflowers", body: "Desert paintbrush and evening primrose bloom March–May. Best seen along the Park Avenue trail and Windows section." },
      { id: 3, icon: ThermometerSun, title: "Ideal Hiking Temps", body: "Highs in the 60s–70s. Perfect for Delicate Arch (3 miles RT, 480 ft gain) and Devils Garden Loop." },
      { id: 4, icon: Camera, title: "Sunrise at Mesa Arch", body: "Technically in nearby Canyonlands, but Mesa Arch sunrise is a can't-miss pairing. Arrive 45 min before dawn." },
    ],
  },
  summer: {
    label: "Summer", icon: Sun,
    mochiTip: { title: "🐻 Mochi's Summer Warning", body: "**Surface temps on slickrock exceed 140°F.** Carry 2+ liters of water for any hike. Delicate Arch has zero shade — hike at sunrise or sunset only." },
    tips: [
      { id: 1, icon: ThermometerSun, title: "Deadly Heat", body: "Air temps hit 105°F+, rock surface 140°F. Heat stroke is real — 17 rescues per summer. Hike before 8 AM." },
      { id: 2, icon: Flame, title: "Fiery Furnace Permits", body: "Ranger-led tours book months ahead. Self-guided permits available but the maze is genuinely disorienting." },
      { id: 3, icon: Droplets, title: "Carry Extra Water", body: "No water sources in the park. Carry minimum 1 liter per hour of hiking. Refill at the visitor center." },
      { id: 4, icon: Camera, title: "Night Photography", body: "Arches is a certified Dark Sky Park. Milky Way arching over Balanced Rock is a bucket-list shot." },
    ],
  },
  fall: {
    label: "Fall", icon: Leaf,
    mochiTip: { title: "🐻 Mochi's Fall Tip", body: "October is Arches at its best — timed entry ends November 1, temps cool to the 70s, and fall light paints the red rock in deep amber. Book Fiery Furnace now!" },
    tips: [
      { id: 1, icon: Leaf, title: "Perfect Season", body: "Highs in the 60s–70s, crowds thin after Labor Day. October is the sweet spot for comfortable all-day exploring." },
      { id: 2, icon: Footprints, title: "Devils Garden", body: "7.9-mile full loop past 8 arches including Landscape Arch (306 ft span — the longest in North America)." },
      { id: 3, icon: Mountain, title: "Tower Arch", body: "Remote and uncrowded. 2.4-mile trail through the Klondike Bluffs. 4WD recommended for the Salt Valley road." },
      { id: 4, icon: Camera, title: "Golden Light", body: "Low autumn sun turns Entrada sandstone deep red-orange. Sunset at Delicate Arch is peak fall experience." },
    ],
  },
  winter: {
    label: "Winter", icon: Snowflake,
    mochiTip: { title: "🐻 Mochi's Winter Alert", body: "No timed entry required November–March! Snow-dusted arches are breathtaking but rare. Roads can ice over — check conditions before driving to Devils Garden." },
    tips: [
      { id: 1, icon: Car, title: "No Reservations Needed", body: "Free entry without timed tickets November–March. Parking is easy, trails are empty. Best time for solitude." },
      { id: 2, icon: Snowflake, title: "Snow on Arches", body: "Rare dustings of snow on red rock create iconic photo ops. Follow @ArchesNPS for snow alerts." },
      { id: 3, icon: AlertTriangle, title: "Icy Trails", body: "Delicate Arch trail and Devils Garden have exposed slickrock that ices over. Micro-spikes recommended Dec–Feb." },
      { id: 4, icon: Camera, title: "Clear Skies", body: "Winter has the driest, clearest air. Astrophotography conditions are at their peak — minimal light pollution." },
    ],
  },
};

/* ── Exported map ── */

export const parkSeasons: Record<string, Record<Season, SeasonData>> = {
  yosemite: yosemiteSeasons,
  rainier: rainierSeasons,
  zion: zionSeasons,
  glacier: glacierSeasons,
  rocky_mountain: rockyMountainSeasons,
  arches: archesSeasons,
};
