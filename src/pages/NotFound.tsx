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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        className="text-center w-full"
        style={{ maxWidth: 420 }}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <img
          src="/mochi-worried.png"
          alt="Mochi worried"
          className="w-24 h-24 object-contain mx-auto mb-5"
          loading="lazy"
        />
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 300, fontSize: 15, color: 'rgba(26,24,20,0.4)', marginBottom: 8 }}>
          Even Mochi got turned around.
        </p>
        <h1 className="text-xl font-heading font-bold text-foreground mb-2">
          Trail not found
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Looks like this path doesn't lead anywhere. Let's get you back to camp.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <Link
            to="/"
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-full px-7 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
          <Link
            to="/discover"
            className="w-full inline-flex items-center justify-center hover:opacity-80 transition-opacity"
            style={{ background: 'transparent', border: '1.5px solid rgba(47,111,78,0.4)', color: '#2F6F4E', borderRadius: 999, padding: '12px 28px', fontFamily: "'DM Sans', sans-serif", fontSize: 15 }}
          >
            Browse Parks
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
