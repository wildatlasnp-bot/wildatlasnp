const mascots = [
  { label: "Bear — Celebrating", src: "/assets/mochi/poses/mochi-celebrating.png" },
  { label: "Bear — Chilling", src: "/assets/mochi/poses/mochi-chilling.png" },
  { label: "Bear — Pointing", src: "/assets/mochi/poses/mochi-pointing.png" },
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
