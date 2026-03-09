import mochiV1 from "@/assets/mochi-icon.png";
import mochiV2 from "@/assets/mochi-icon-v2.png";
import mochiV3 from "@/assets/mochi-icon-v3.png";
import mochiV4 from "@/assets/mochi-icon-v4.png";
import owl from "@/assets/mochi-owl-v1.png";
import fox from "@/assets/mochi-fox-v1.png";
import foxRefined from "@/assets/mascot-fox-refined.png";
import foxWarm from "@/assets/mascot-fox-warm.png";
import foxCool from "@/assets/mascot-fox-cool.png";
import goat from "@/assets/mascot-goat.png";
import elk from "@/assets/mascot-elk.png";
import marten from "@/assets/mascot-marten.png";

const mascots = [
  { label: "Fox Refined", src: foxRefined },
  { label: "Fox Warm", src: foxWarm },
  { label: "Fox Cool", src: foxCool },
  { label: "Mochi Bear V1", src: mochiV1 },
  { label: "Mochi Bear V2", src: mochiV2 },
  { label: "Mochi Bear V3", src: mochiV3 },
  { label: "Mochi Bear V4", src: mochiV4 },
  { label: "Ranger Owl", src: owl },
  { label: "Ranger Fox", src: fox },
  { label: "Ranger Goat", src: goat },
  { label: "Ranger Elk", src: elk },
  { label: "Ranger Marten", src: marten },
];

export default function MascotGallery() {
  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-1">Wild Atlas</p>
      <h1 className="text-2xl font-bold text-foreground mb-8">Mascot Designs</h1>
      <div className="grid grid-cols-3 gap-5">
        {mascots.map(({ label, src }) => (
          <div key={label} className="flex flex-col items-center gap-3">
            <div className="w-full aspect-square rounded-2xl border border-border/40 bg-card flex items-center justify-center p-4 shadow-sm">
              <img src={src} alt={label} className="w-full h-full object-contain" />
            </div>
            <span className="text-[12px] font-medium text-muted-foreground text-center">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
