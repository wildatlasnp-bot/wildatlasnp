import foxRefined from "@/assets/mascot-fox-refined.png";
import foxWarm from "@/assets/mascot-fox-warm.png";
import foxCool from "@/assets/mascot-fox-cool.png";
import foxMinimal from "@/assets/mascot-fox-minimal.png";
import bearRefined from "@/assets/mascot-bear-refined.png";
import deer from "@/assets/mascot-deer.png";
import raccoon from "@/assets/mascot-raccoon.png";
import owl from "@/assets/mochi-owl-v1.png";
import goat from "@/assets/mascot-goat.png";
import elk from "@/assets/mascot-elk.png";
import marten from "@/assets/mascot-marten.png";

const mascots = [
  { label: "Fox Warm", src: foxWarm },
  { label: "Fox Refined", src: foxRefined },
  { label: "Fox Cool", src: foxCool },
  { label: "Fox Minimal", src: foxMinimal },
  { label: "Bear Refined", src: bearRefined },
  { label: "Ranger Deer", src: deer },
  { label: "Ranger Raccoon", src: raccoon },
  { label: "Ranger Owl", src: owl },
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
