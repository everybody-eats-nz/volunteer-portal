import { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/shifts"],
        disallow: [
          "/api/",
          "/dashboard",
          "/dashboard/*",
          "/profile",
          "/profile/*",
          "/achievements",
          "/friends",
          "/friends/*",
          "/resources",
          "/admin",
          "/admin/*",
          "/group-bookings/*",
          "/group-invitations/*",
          "/verify-email",
          "/reset-password",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
