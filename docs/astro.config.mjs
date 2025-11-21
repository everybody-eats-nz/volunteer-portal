// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightSidebarTopics from "starlight-sidebar-topics";
import mermaid from "astro-mermaid";
import vercel from "@astrojs/vercel";

// Get the base URL for the volunteer portal application
// This matches the logic in web/src/lib/utils.ts getBaseUrl()
function getBaseUrl() {
  // Check if we're in the demo environment
  if (process.env.VERCEL_ENV === "preview") {
    return "https://demo.everybody-eats.vercel.app";
  }

  if (process.env.VERCEL_ENV === "production") {
    return "https://volunteers.everybodyeats.nz";
  }

  // For other Vercel deployments or local development
  const vercelUrl = process.env.VERCEL_URL;
  return vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000";
}

const APP_URL = getBaseUrl();

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: vercel(),
  vite: {
    define: {
      "import.meta.env.VOLUNTEER_PORTAL_URL": JSON.stringify(APP_URL),
    },
  },
  integrations: [
    mermaid(),
    starlight({
      plugins: [
        starlightSidebarTopics([
          {
            label: "Admin Guide",
            link: "/",
            icon: "star",
            items: [
              {
                label: "Getting Started",
                items: [
                  { label: "🏠 Overview", link: "/" },
                  {
                    label: "📊 Admin Dashboard",
                    slug: "overview/admin-dashboard",
                  },
                  {
                    label: "👥 User Roles & Permissions",
                    slug: "overview/user-roles",
                  },
                  { label: "🧭 Navigation Guide", slug: "overview/navigation" },
                ],
              },
              {
                label: "System Administration",
                items: [
                  {
                    label: "👨‍👩‍👧‍👦 Parental Consent",
                    slug: "user-management/parental-consent",
                  },
                  {
                    label: "📸 Profile Photos",
                    slug: "user-management/profile-photos",
                    badge: "WIP",
                  },
                  {
                    label: "✉️ Email Verification",
                    slug: "user-management/email-verification",
                    badge: "WIP",
                  },
                  {
                    label: "⌘ Admin Command Palette",
                    slug: "user-management/command-palette",
                    badge: "WIP",
                  },
                ],
              },
              {
                label: "System Overview",
                items: [
                  {
                    label: "📅 Calendar Overview",
                    slug: "shift-management/calendar-overview",
                  },
                  {
                    label: "✍️ Managing Signups",
                    slug: "shift-management/managing-signups",
                  },
                ],
              },
              {
                label: "Troubleshooting",
                items: [
                  {
                    label: "🛠️ Common Issues",
                    slug: "troubleshooting/common-issues",
                  },
                  {
                    label: "🆘 Helping Volunteers",
                    slug: "troubleshooting/user-problems",
                  },
                  {
                    label: "⚠️ System Errors",
                    slug: "troubleshooting/system-errors",
                  },
                ],
              },
            ],
          },
          {
            label: "Restaurant Managers",
            link: "/restaurant-managers/",
            icon: "open-book",
            items: [
              {
                label: "Getting Started",
                items: [
                  {
                    label: "🏢 Multi-Location Features",
                    slug: "location-management/location-filtering",
                  },
                  {
                    label: "🔌 Restaurant Manager API",
                    slug: "location-management/restaurant-manager-api",
                  },
                ],
              },
              {
                label: "Volunteer Management",
                items: [
                  {
                    label: "👀 Viewing Volunteers",
                    slug: "user-management/viewing-volunteers",
                  },
                  {
                    label: "👤 Volunteer Profiles",
                    slug: "user-management/volunteer-profiles",
                  },
                  {
                    label: "📝 Admin Notes",
                    slug: "user-management/admin-notes",
                  },
                  {
                    label: "🏷️ Volunteer Labels",
                    slug: "user-management/volunteer-labels",
                    badge: "WIP",
                  },
                  {
                    label: "⭐ Volunteer Grading System",
                    slug: "user-management/volunteer-grading",
                    badge: "WIP",
                  },
                  {
                    label: "🔄 Regular Volunteers",
                    slug: "user-management/regular-volunteers",
                    badge: "WIP",
                  },
                  {
                    label: "👥 Friend System",
                    slug: "user-management/friend-system",
                    badge: "WIP",
                  },
                  {
                    label: "🔔 Notification System",
                    slug: "user-management/notification-system",
                    badge: "WIP",
                  },
                ],
              },
              {
                label: "Shift Management",
                items: [
                  {
                    label: "➕ Creating Shifts",
                    slug: "shift-management/creating-shifts",
                  },
                  {
                    label: "👨‍👩‍👧‍👦 Group Bookings",
                    slug: "shift-management/group-bookings",
                  },
                  {
                    label: "✅ Attendance Tracking",
                    slug: "shift-management/attendance-tracking",
                  },
                  {
                    label: "❌ Shift Cancellation Notifications",
                    slug: "shift-management/shift-cancellation-notifications",
                    badge: "WIP",
                  },
                  {
                    label: "🎯 Volunteer Selection",
                    slug: "shift-management/volunteer-selection",
                    badge: "WIP",
                  },
                  {
                    label: "🌅 Day and Evening Periods",
                    slug: "shift-management/period-separation",
                    badge: "WIP",
                  },
                  {
                    label: "📋 Shift Templates",
                    slug: "shift-management/shift-templates",
                    badge: "WIP",
                  },
                  {
                    label: "⚡ Auto-Accept Rules",
                    slug: "shift-management/auto-accept-rules",
                    badge: "WIP",
                  },
                  {
                    label: "📍 Volunteer Placement",
                    slug: "shift-management/volunteer-placement",
                    badge: "WIP",
                  },
                  {
                    label: "✏️ Editing and Deleting Shifts",
                    slug: "shift-management/shift-editing",
                    badge: "WIP",
                  },
                  {
                    label: "🏢 Location Configuration",
                    slug: "shift-management/location-configuration",
                    badge: "WIP",
                  },
                  {
                    label: "📧 Email Confirmations",
                    slug: "shift-management/email-confirmations",
                    badge: "WIP",
                  },
                ],
              },
              {
                label: "Reports & Analytics",
                items: [
                  {
                    label: "📊 Dashboard Metrics",
                    slug: "reports-analytics/dashboard-metrics",
                  },
                  {
                    label: "📈 Volunteer Activity",
                    slug: "reports-analytics/volunteer-activity",
                  },
                  {
                    label: "📉 Shift Analytics",
                    slug: "reports-analytics/shift-analytics",
                  },
                ],
              },
            ],
          },
          {
            label: "Developer Reference",
            link: "/developers/",
            icon: "laptop",
            items: [
              {
                label: "Getting Started",
                items: [
                  {
                    label: "🔑 Developer Access Guide",
                    slug: "developers/developer-access-guide",
                  },
                  {
                    label: "⚙️ Technology Stack",
                    slug: "developers/tech-stack",
                  },
                  {
                    label: "🏗️ Hosting & Infrastructure",
                    slug: "developers/hosting-infrastructure",
                  },
                ],
              },
              {
                label: "Authentication & Authorization",
                items: [
                  {
                    label: "🔐 Authentication & Authorization",
                    slug: "developers/authentication-authorization",
                  },
                  {
                    label: "🌐 OAuth Authentication",
                    slug: "developers/oauth-authentication",
                  },
                  {
                    label: "🔑 Admin Permissions",
                    slug: "reference/permissions",
                  },
                ],
              },
              {
                label: "System Integration",
                items: [
                  {
                    label: "📧 Email Systems",
                    slug: "developers/email-systems",
                  },
                  {
                    label: "📊 Analytics Integration",
                    slug: "developers/analytics-integration",
                  },
                  {
                    label: "🔄 Data Migration",
                    slug: "developers/data-migration",
                  },
                  {
                    label: "🌍 Environment Configuration",
                    slug: "developers/environment-configuration",
                  },
                ],
              },
              {
                label: "Development",
                items: [
                  {
                    label: "🎨 UI Components System",
                    slug: "developers/ui-components-system",
                  },
                  {
                    label: "🧪 Testing Framework",
                    slug: "developers/testing-framework",
                  },
                  {
                    label: "🕐 Timezone Handling",
                    slug: "developers/timezone-handling",
                  },
                ],
              },
            ],
          },
        ]),
      ],
      title: "Everybody Eats Admin Guide",
      description: "Administrator documentation for the volunteer portal",
      customCss: ["./src/styles/custom.css"],
      editLink: {
        baseUrl:
          "https://github.com/everybody-eats-nz/volunteer-portal/edit/main/docs/",
      },
      head: [
        {
          tag: "script",
          content: `
            // Wait for DOM and handle dynamic content
            function initImageZoom() {
              // Create modal elements if not exists
              if (document.querySelector('.image-modal')) return;
              
              const modal = document.createElement('div');
              modal.className = 'image-modal';
              modal.innerHTML = \`
                <button class="image-modal-close" aria-label="Close fullscreen image">×</button>
                <img src="" alt="" />
              \`;
              document.body.appendChild(modal);

              const modalImg = modal.querySelector('img');
              const closeBtn = modal.querySelector('.image-modal-close');

              // Add click listeners to all content images
              const setupImageListeners = () => {
                const images = document.querySelectorAll('main img, .content img, [class*="content"] img');
                console.log('Found images:', images.length);
                
                images.forEach((img, index) => {
                  // Skip logo and other non-content images
                  if (img.closest('.site-title') || img.closest('nav') || img.closest('header')) {
                    console.log('Skipping image', index, 'in header/nav');
                    return;
                  }
                  
                  console.log('Adding click listener to image', index, img.src);
                  img.style.cursor = 'pointer';
                  
                  // Remove existing listeners
                  img.removeEventListener('click', img._zoomHandler);
                  
                  img._zoomHandler = (e) => {
                    console.log('Image clicked:', img.src);
                    e.preventDefault();
                    e.stopPropagation();
                    modalImg.src = img.src;
                    modalImg.alt = img.alt;
                    modal.classList.add('active');
                    document.body.style.overflow = 'hidden';
                  };
                  
                  img.addEventListener('click', img._zoomHandler);
                });
              };

              // Close modal functionality
              const closeModal = () => {
                modal.classList.remove('active');
                document.body.style.overflow = '';
              };

              closeBtn.addEventListener('click', closeModal);
              
              // Close on click outside image
              modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                  closeModal();
                }
              });

              // Close on escape key
              document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('active')) {
                  closeModal();
                }
              });
              
              // Setup listeners immediately and on content changes
              setupImageListeners();
              
              // Also setup listeners when content changes (for SPA navigation)
              const observer = new MutationObserver(() => {
                setTimeout(setupImageListeners, 100);
              });
              
              observer.observe(document.body, { childList: true, subtree: true });
            }
            
            // Initialize when DOM is ready
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', initImageZoom);
            } else {
              initImageZoom();
            }
            
            // Also initialize after view transitions (Starlight SPA navigation)
            document.addEventListener('astro:page-load', initImageZoom);
          `,
        },
      ],
      components: {
        Footer: "./src/components/Footer.astro",
      },
      logo: {
        src: "./src/assets/logo.svg",
        replacesTitle: true,
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/everybody-eats-nz/volunteer-portal",
        },
      ],
    }),
  ],
});
