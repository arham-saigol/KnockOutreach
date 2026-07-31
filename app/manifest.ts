import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Knock",
    short_name: "Knock",
    description: "Thoughtful Product Hunt outreach, reviewed by a human.",
    start_url: "/app",
    display: "standalone",
    background_color: "#FAFAFA",
    theme_color: "#0044FF",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
