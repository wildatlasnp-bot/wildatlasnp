import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const ease = [0.25, 0.1, 0.25, 1] as const;
  const item = {
    hidden: { opacity: 0, y: 14 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease, delay: i * 0.12 },
    }),
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center w-full" style={{ maxWidth: 420 }}>
        <motion.img
          src="/mochi-worried.png"
          alt="Poko worried"
          className="object-contain mx-auto mb-5"
          style={{ width: 136, height: 136 }}
          loading="lazy"
          variants={item}
          initial="hidden"
          animate="show"
          custom={0}
        />
        <motion.p
          style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 300, fontSize: 15, color: 'rgba(26,24,20,0.4)', marginBottom: 8 }}
          variants={item}
          initial="hidden"
          animate="show"
          custom={1}
        >
          Even Poko got turned around.
        </motion.p>
        <motion.h1
          className="text-xl font-heading font-bold text-foreground mb-2"
          style={{ marginTop: 8 }}
          variants={item}
          initial="hidden"
          animate="show"
          custom={2}
        >
          Trail not found
        </motion.h1>
        <motion.p
          className="text-sm text-muted-foreground leading-relaxed mb-6"
          variants={item}
          initial="hidden"
          animate="show"
          custom={3}
        >
          Looks like this path doesn't lead anywhere. Let's get you back to camp.
        </motion.p>
        <motion.div
          className="flex flex-col items-center"
          variants={item}
          initial="hidden"
          animate="show"
          custom={4}
        >
          <Link
            to="/"
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-full px-7 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
          <Link
            to="/discover"
            className="inline-flex items-center justify-center hover:opacity-70 transition-opacity"
            style={{ background: 'none', border: 'none', color: '#2F6F4E', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, marginTop: 16 }}
          >
            Browse Parks →
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
