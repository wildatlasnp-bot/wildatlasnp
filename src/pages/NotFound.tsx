import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-xs w-full">
        <img
          src="/mochi-worried.png"
          alt="Mochi worried"
          className="w-24 h-24 object-contain mx-auto mb-5"
        />
        <h1 className="text-xl font-heading font-bold text-foreground mb-2">
          🐻 Trail not found
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Looks like this path doesn't lead anywhere. Let's get you back to camp.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
