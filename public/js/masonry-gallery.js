jQuery(document).ready(function ($) {
  class ClearPHGallery {
    constructor(element) {
      this.gallery = $(element)
      this.isMasonry = this.gallery.data("masonry") === "true"
      this.columns = parseInt(this.gallery.data("columns")) || 4
      this.objectFit = this.gallery.data("object-fit") || "cover"
      this.lightboxEnabled = this.gallery.data("lightbox") === "true"
      this.galleryGroup = this.gallery.data("gallery-group")

      this.init()
    }

    init() {
      this.setupLazyLoading()
      this.setupVideoPlayback()
      this.initAnimations()
    }

    setupLazyLoading() {
      const images = this.gallery.find(".lazy-image")

      if (!("IntersectionObserver" in window)) {
        // Fallback for older browsers - all images should already be loaded with src
        images.each((index, img) => {
          const $img = $(img)
          // Since we're using wp_get_attachment_image, images already have src
          if (img.complete && img.naturalHeight > 0) {
            $img.addClass("loaded")
          } else {
            $img.on("load", function () {
              $(this).addClass("loaded")
            })
          }
        })
        return
      }

      const imageObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target

              // Since we're using wp_get_attachment_image, check if image is loaded
              if (img.complete && img.naturalHeight > 0) {
                img.classList.add("loaded")
              } else {
                img.addEventListener(
                  "load",
                  () => {
                    img.classList.add("loaded")
                  },
                  { once: true }
                )
              }

              imageObserver.unobserve(img)
            }
          })
        },
        {
          threshold: 0.1,
          rootMargin: "100px", // Start loading 100px before image enters viewport
        }
      )

      images.each((index, img) => {
        imageObserver.observe(img)
      })
    }

    setupVideoPlayback() {
      const videoItems = this.gallery.find(".gallery-item--video")

      videoItems.each((index, item) => {
        const $item = $(item)
        const video = $item.find("video")[0]
        if (!video) return

        const autoplayMode = video.getAttribute("data-autoplay") || "hover"

        if (autoplayMode === "always") {
          // Ensure autoplay starts (browsers may block it)
          video.play().catch(() => {})
        } else {
          // Play on hover, pause on leave
          $item.on("mouseenter", () => {
            video.play().catch(() => {})
          })

          $item.on("mouseleave", () => {
            video.pause()
          })
        }
      })
    }

    initAnimations() {
      // Check if GSAP is available
      if (typeof gsap !== "undefined") {
        this.setupOptimizedGSAPAnimations()
      } else {
        // Fallback CSS animations
        this.setupFallbackAnimations()
      }
    }

    setupOptimizedGSAPAnimations() {
      const items = this.gallery.find(".gallery-item")

      // Set initial state - all images start invisible and shifted down
      gsap.set(items, {
        opacity: 0,
        y: 30,
        scale: 0.95,
      })

      // Setup Intersection Observer for viewport-based animations
      this.setupViewportAnimations(items)

      // Optimized hover animations - use will-change and transform3d
      items.each((index, item) => {
        const $item = $(item)

        // Skip hover-zoom for video items
        if ($item.data("type") === "video") return

        const $img = $item.find("img")

        // Set up for hardware acceleration
        gsap.set($img, {
          transformOrigin: "center center",
          force3D: true,
        })

        $item.on("mouseenter", () => {
          gsap.to($img, {
            scale: 1.1,
            duration: 0.4,
            ease: "power2.out",
            force3D: true,
          })
        })

        $item.on("mouseleave", () => {
          gsap.to($img, {
            scale: 1,
            duration: 0.4,
            ease: "power2.out",
            force3D: true,
          })
        })
      })
    }

    setupViewportAnimations(items) {
      if (!("IntersectionObserver" in window)) {
        // Fallback for older browsers
        items.each((index, item) => {
          setTimeout(() => {
            gsap.to(item, {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.6,
              ease: "power2.out",
            })
          }, index * 100)
        })
        return
      }

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const item = entry.target

              // Animate item into view with fadeUp effect
              gsap.to(item, {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.8,
                ease: "power2.out",
                delay: 0.1,
              })

              // Stop observing this item
              observer.unobserve(item)
            }
          })
        },
        {
          threshold: 0.1, // Trigger when 10% of item is visible
          rootMargin: "50px", // Start animation 50px before item enters viewport
        }
      )

      // Observe all gallery items
      items.each((index, item) => {
        observer.observe(item)
      })
    }

    setupFallbackAnimations() {
      // CSS-based animations when GSAP isn't available
      const items = this.gallery.find(".gallery-item")

      if (!("IntersectionObserver" in window)) {
        // Simple time-based fallback for older browsers
        items.each((index, item) => {
          setTimeout(() => {
            $(item).addClass("animate-in")
          }, index * 100)
        })
        return
      }

      // Use Intersection Observer for viewport-based animations
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const item = entry.target
              setTimeout(() => {
                $(item).addClass("animate-in")
              }, 100)
              observer.unobserve(item)
            }
          })
        },
        {
          threshold: 0.1,
          rootMargin: "50px",
        }
      )

      items.each((index, item) => {
        observer.observe(item)
      })
    }
  }

  // Initialize galleries with slight delay to avoid blocking
  setTimeout(() => {
    $(".clearph-gallery").each(function () {
      new ClearPHGallery(this)
    })

    // Pre-filter from URL: ?filter=CategoryName or #filter-CategoryName
    var preFilter =
      new URLSearchParams(window.location.search).get("filter") ||
      (window.location.hash.match(/^#filter-(.+)/) || [])[1]
    if (preFilter) {
      preFilter = decodeURIComponent(preFilter)
      $(".clearph-gallery-filters .filter-btn").each(function () {
        if ($(this).data("filter") === preFilter) {
          $(this).trigger("click")
          return false
        }
      })
    }
  }, 100)

  // Category filtering
  $(document).on("click", ".clearph-gallery-filters .filter-btn", function (e) {
    e.preventDefault()
    const $btn = $(this)
    const $filters = $btn.closest(".clearph-gallery-filters")
    const galleryId = $filters.data("gallery-id")
    const $gallery = $('.clearph-gallery[data-gallery-id="' + galleryId + '"]')
    const filter = $btn.data("filter")

    if (!$gallery.length) return

    // Update active state
    $filters.find(".filter-btn").removeClass("active")
    $btn.addClass("active")

    // Filter gallery items
    $gallery.find(".gallery-item").each(function () {
      const $item = $(this)
      const category = $item.data("category") || ""

      const show = filter === "*" || category === filter

      if (show) {
        $item.css("display", "")

        if (typeof gsap !== "undefined") {
          gsap.fromTo(
            $item[0],
            { opacity: 0, y: 20, scale: 0.95 },
            { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power2.out" }
          )
        } else {
          $item.addClass("animate-in")
        }
      } else {
        $item.css("display", "none")
      }
    })
  })
})
