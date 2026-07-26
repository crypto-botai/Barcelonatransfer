import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        gold: {
          DEFAULT: "#c9a84c",
          50:  "#fdf8ed",
          100: "#faf0d4",
          200: "#f5e0a9",
          300: "#edc96e",
          400: "#e4b243",
          500: "#c9a84c",
          600: "#b8960c",
          700: "#956f0a",
          800: "#734e0f",
          900: "#5e3f12",
        },
        dark: {
          DEFAULT: "#0a0a0a",
          50:  "#f8f8f8",
          100: "#f0f0f0",
          200: "#e4e4e4",
          300: "#c8c8c8",
          400: "#9a9a9a",
          500: "#6b6b6b",
          600: "#3d3d3d",
          700: "#282828",
          800: "#1a1a1a",
          900: "#111111",
          950: "#0a0a0a",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #c9a84c 0%, #f5e0a9 50%, #c9a84c 100%)",
        "gold-shimmer": "linear-gradient(90deg, transparent 0%, #c9a84c40 50%, transparent 100%)",
        "dark-gradient": "linear-gradient(180deg, #0a0a0a 0%, #111111 100%)",
        "hero-gradient": "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.85) 100%)",
      },
      boxShadow: {
        gold: "0 0 20px rgba(201,168,76,0.25)",
        "gold-lg": "0 0 40px rgba(201,168,76,0.35)",
        glass: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
        luxury: "0 25px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(201,168,76,0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out",
        "slide-up": "slideUp 0.6s ease-out",
        "gold-shimmer": "goldShimmer 3s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
        "pulse-gold": "pulseGold 2s ease-in-out infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(24px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        goldShimmer: {
          "0%, 100%": { backgroundPosition: "200% center" },
          "50%": { backgroundPosition: "-200% center" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        pulseGold: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(201,168,76,0.4)" },
          "50%": { boxShadow: "0 0 0 12px rgba(201,168,76,0)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
};

export default config;
